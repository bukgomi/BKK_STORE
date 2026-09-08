import { prisma } from "@/lib/prisma";
import { getLowStockThreshold, notifyAdmin, notifyAdminOrderReceived } from "@/lib/notify";
import { notifyOrderPaid } from "@/lib/alimtalk";
import { Prisma } from "@prisma/client";

/**
 * 주문 결제 완료 처리 (race-condition safe):
 * - 주문 상태 PAID
 * - 옵션(variant) 또는 상품 재고 차감 — 조건부 updateMany 로 oversell 방지
 * - 쿠폰 사용 마킹 (예약된 쿠폰 → 사용)
 * - 적립금 사용 차감 + 적립
 *
 * 재고 부족시 throw → 트랜잭션 롤백, 호출측에서 망취소 처리해야 함
 */
export class OutOfStockError extends Error {
  constructor(public productName: string) {
    super(`재고 부족: ${productName}`);
    this.name = "OutOfStockError";
  }
}

export async function finalizeOrderPayment(args: {
  orderId: string;
  providerTxnId: string;
}): Promise<void> {
  const { orderId, providerTxnId } = args;

  const productIdsForCheck = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, coupon: true },
    });
    if (!order) throw new Error("주문을 찾을 수 없습니다.");
    if (order.status !== "PENDING") return [] as string[];

    // 1) 재고 차감 (조건부 updateMany — 동시성 안전)
    const productIds: string[] = [];
    for (const it of order.items) {
      if (it.variantId) {
        const r = await tx.productVariant.updateMany({
          where: { id: it.variantId, stock: { gte: it.quantity } },
          data: { stock: { decrement: it.quantity } },
        });
        if (r.count === 0) throw new OutOfStockError(`${it.name} - ${it.variantName}`);
      } else {
        const r = await tx.product.updateMany({
          where: { id: it.productId, stock: { gte: it.quantity } },
          data: { stock: { decrement: it.quantity } },
        });
        if (r.count === 0) throw new OutOfStockError(it.name);
      }
      productIds.push(it.productId);
    }

    // 2) 주문 상태 변경
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", providerTxnId, paidAt: new Date(), expiresAt: null },
    });

    // 3) 쿠폰 사용 마킹 (예약된 쿠폰 → used)
    if (order.couponId && order.userId) {
      await tx.userCoupon.updateMany({
        where: {
          userId: order.userId,
          couponId: order.couponId,
          OR: [{ reservedOrderId: order.id }, { usedAt: null }],
        },
        data: {
          usedAt: new Date(),
          orderId: order.id,
          reservedOrderId: null,
          reservedAt: null,
        },
      });
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    // 4) 적립금 사용 차감
    if (order.userId && order.pointUsed > 0) {
      // 회원 잔액이 충분한지 다시 검증
      const r = await tx.user.updateMany({
        where: { id: order.userId, pointBalance: { gte: order.pointUsed } },
        data: { pointBalance: { decrement: order.pointUsed } },
      });
      if (r.count === 0) throw new Error("적립금 잔액이 부족합니다.");

      await tx.pointHistory.create({
        data: {
          userId: order.userId,
          amount: -order.pointUsed,
          reason: "주문 적립금 사용",
          orderId: order.id,
        },
      });
    }

    // 5) 적립금 적립 (1년 유효)
    if (order.userId && order.pointEarned > 0) {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await tx.user.update({
        where: { id: order.userId },
        data: { pointBalance: { increment: order.pointEarned } },
      });
      await tx.pointHistory.create({
        data: {
          userId: order.userId,
          amount: order.pointEarned,
          reason: "주문 결제 적립",
          orderId: order.id,
          expiresAt,
        },
      });
    }

    // 6) 회원 등급 산정용 누적 결제액 가산 (배송비 제외, 쿠폰/적립 차감 후 결제 본액)
    if (order.userId) {
      const lifetimeIncrement = Math.max(0, order.totalAmount - order.shippingFee);
      if (lifetimeIncrement > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { lifetimeAmount: { increment: lifetimeIncrement } },
        });
      }
    }

    return productIds;
  }, {
    // 동시성 강화: Repeatable Read 격리 수준
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    timeout: 15_000,
  });

  // 트랜잭션 완료 후 비동기 작업 (실패해도 결제 흐름 영향 없음)
  void checkAndNotifyLowStock(productIdsForCheck).catch(() => {});
  void sendOrderPaidAlimtalk(orderId).catch(() => {});
  void sendAdminNewOrderAlert(orderId).catch(() => {});
}

/**
 * 관리자에게 신규 주문 알림 (알림톡 + SMS + 이메일 + Slack)
 */
async function sendAdminNewOrderAlert(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderNo: true, recipient: true,
      totalAmount: true, provider: true,
      items: { select: { name: true, variantName: true, quantity: true } },
    },
  });
  if (!order) return;

  const PROVIDER_LABEL: Record<string, string> = {
    TOSS: "토스페이먼츠", INICIS: "KG이니시스", NAVERPAY: "네이버페이",
  };

  const first = order.items[0];
  const summary = first
    ? `${first.name}${first.variantName ? `(${first.variantName})` : ""}` +
      (order.items.length > 1 ? ` 외 ${order.items.length - 1}건` : "")
    : "상품 없음";

  await notifyAdminOrderReceived({
    orderId: order.id,
    orderNo: order.orderNo,
    recipient: order.recipient,
    totalAmount: order.totalAmount,
    productSummary: summary,
    method: order.provider ? PROVIDER_LABEL[order.provider] || order.provider : "결제",
    itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
  });
}

/**
 * 주문 취소/환불시 재고 복원 (옵션 / 상품 모두 처리)
 * 복원한 수량은 refundedQuantity 에 기록해 두 번 복원되지 않게 한다.
 */
export async function restoreOrderStock(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const it of items) {
      const restoreQty = it.quantity - it.refundedQuantity;
      if (restoreQty <= 0) continue;
      if (it.variantId) {
        await tx.productVariant.update({
          where: { id: it.variantId },
          data: { stock: { increment: restoreQty } },
        });
      } else {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: restoreQty } },
        });
      }
      await tx.orderItem.update({
        where: { id: it.id },
        data: { refundedQuantity: it.quantity },
      });
    }
  });
}

/**
 * 결제 전(PENDING) 주문 취소.
 * 상태를 CANCELLED 로 바꾸고, 주문 생성 시 hold 해 둔 쿠폰 reservation 을 풀어준다.
 * 이미 PENDING 이 아니면 아무것도 하지 않고 false 반환.
 */
export async function cancelPendingOrder(orderId: string, adminMemo?: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: new Date(), ...(adminMemo ? { adminMemo } : {}) },
    });
    if (r.count === 0) return false;
    await tx.userCoupon.updateMany({
      where: { reservedOrderId: orderId },
      data: { reservedOrderId: null, reservedAt: null },
    });
    return true;
  });
}

async function sendOrderPaidAlimtalk(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNo: true, recipient: true, phone: true,
      totalAmount: true, provider: true,
    },
  });
  if (!order || !order.phone) return;

  const PROVIDER_LABEL: Record<string, string> = {
    TOSS: "토스페이먼츠", INICIS: "신용카드", NAVERPAY: "네이버페이",
  };

  await notifyOrderPaid({
    orderNo: order.orderNo,
    recipient: order.recipient,
    phone: order.phone,
    totalAmount: order.totalAmount,
    provider: order.provider ? PROVIDER_LABEL[order.provider] || order.provider : null,
  });
}

async function checkAndNotifyLowStock(productIds: string[]) {
  if (productIds.length === 0) return;
  const threshold = getLowStockThreshold();

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true, name: true, sku: true, stock: true, lowStockThreshold: true,
      variants: { select: { name: true, stock: true } },
    },
  });

  type Triggered = { name: string; sku: string; stock: number };
  const triggered: Triggered[] = [];

  for (const p of products) {
    const limit = p.lowStockThreshold ?? threshold;
    if (p.variants.length > 0) {
      for (const v of p.variants) {
        if (v.stock <= limit) {
          triggered.push({ name: `${p.name} - ${v.name}`, sku: p.sku, stock: v.stock });
        }
      }
    } else if (p.stock <= limit) {
      triggered.push({ name: p.name, sku: p.sku, stock: p.stock });
    }
  }

  if (triggered.length === 0) return;

  const lines = triggered.map((p) => `- ${p.name} (SKU ${p.sku}) — 잔여 ${p.stock}개`);
  const text = `결제 완료 후 재고 임계치 도달:\n\n${lines.join("\n")}`;
  const html = `
    <div style="font-family: sans-serif; font-size: 14px;">
      <h2>⚠️ 재고 임계치 도달</h2>
      <p>방금 결제 완료된 주문으로 인해 다음 ${triggered.length}건이 임계치(${threshold}) 이하로 떨어졌습니다.</p>
      <ul>${triggered.map((p) => `<li>${p.name} (SKU ${p.sku}) — 잔여 ${p.stock}개</li>`).join("")}</ul>
    </div>
  `;

  await notifyAdmin({
    subject: `[낚시몰] 재고 임계치 도달 (${triggered.length}건)`,
    html, text,
  });
}

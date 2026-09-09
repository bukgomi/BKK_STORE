import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelPendingOrder, finalizeOrderPayment, OutOfStockError } from "@/lib/stock";
import { cancelTossPayment } from "@/lib/payments/refund";
import { logger } from "@/lib/logger";

// 토스페이먼츠 successUrl 콜백
// 클라이언트에서 결제 승인되면 paymentKey, orderId, amount 가 쿼리로 전달됨
// 서버에서 시크릿키로 결제 승인 API 호출하여 최종 승인 처리

const PAID_STATUSES = new Set(["PAID", "PREPARING", "SHIPPED", "DELIVERED"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId"); // = orderNo
  const amount = Number(searchParams.get("amount"));

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/checkout/fail?reason=${encodeURIComponent(reason)}`, req.url));

  if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
    return fail("invalid");
  }

  // 1. DB의 주문과 금액이 일치하는지 검증 (위변조 방어)
  const order = await prisma.order.findUnique({ where: { orderNo: orderId } });
  if (!order || order.totalAmount !== amount) {
    return fail("mismatch");
  }

  // 멱등성: 이미 처리된 주문은 승인 API 를 다시 호출하지 않음
  if (order.status !== "PENDING") {
    if (PAID_STATUSES.has(order.status)) {
      return NextResponse.redirect(new URL(`/checkout/success?orderNo=${order.orderNo}`, req.url));
    }
    return fail("order_closed");
  }

  // 2. 토스페이먼츠 승인 API 호출
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    logger.error("toss.confirm.no_secret", { orderNo: order.orderNo });
    return fail("toss_unconfigured");
  }
  const basicAuth = Buffer.from(secretKey + ":").toString("base64");

  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    await cancelPendingOrder(order.id, `토스 승인 실패: ${data?.code || res.status}`);
    return fail(data?.message || "승인실패");
  }

  // 3. 주문 상태 PAID 로 변경 + 재고 차감 + 임계치 알림
  try {
    await finalizeOrderPayment({ orderId: order.id, providerTxnId: paymentKey });
  } catch (e) {
    // 승인은 됐지만 재고가 없음 → 결제 취소 후 주문 취소
    const reason = e instanceof OutOfStockError ? "재고 부족" : "주문 확정 실패";
    logger.error("toss.confirm.finalize_failed", { orderNo: order.orderNo, error: (e as Error).message });
    const cancel = await cancelTossPayment({ paymentKey, cancelReason: reason });
    if (!cancel.ok) {
      logger.error("toss.confirm.cancel_failed", { orderNo: order.orderNo, error: cancel.error });
    }
    await cancelPendingOrder(order.id, `${reason} — 결제 자동취소${cancel.ok ? "" : " 실패(수동 확인 필요)"}`);
    return fail(e instanceof OutOfStockError ? "out_of_stock" : "finalize_failed");
  }

  return NextResponse.redirect(new URL(`/checkout/success?orderNo=${order.orderNo}`, req.url));
}

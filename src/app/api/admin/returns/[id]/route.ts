import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertStaffApi } from "@/lib/admin-guard";
import { logger } from "@/lib/logger";
import { cancelByProvider } from "@/lib/payments/refund";

/**
 * 반품/교환 요청 처리 (관리자)
 *
 * 상태 전환:
 *   REQUESTED → APPROVED (관리자 승인 + 회수 라벨 입력)
 *   APPROVED → PICKED_UP (회수 완료)
 *   PICKED_UP → COMPLETED (검수 후 환불/교환 완료)
 *   REQUESTED/APPROVED → REJECTED
 *
 * RETURN 완료 시 PG 부분/전액 환불을 실제로 호출하고 RefundRequest 를 남긴다
 * (별도 /api/admin/refunds 로 다시 환불하면 이중 환불이 되므로 여기서 끝낸다).
 */

const Schema = z.object({
  status: z.enum(["APPROVED", "PICKED_UP", "COMPLETED", "REJECTED"]),
  pickupCourier: z.string().nullable().optional(),
  pickupTrackingNo: z.string().nullable().optional(),
  adminMemo: z.string().max(500).optional(),
  /** PG 호출 없이 DB만 갱신 (이미 PG 콘솔에서 환불한 경우 등) */
  skipPgCall: z.boolean().default(false),
});

const ALLOWED_TRANSITION: Record<string, string[]> = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED:  ["PICKED_UP", "REJECTED"],
  PICKED_UP: ["COMPLETED", "REJECTED"],
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await assertStaffApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const data = Schema.parse(await req.json());

    const rr = await prisma.returnRequest.findUnique({
      where: { id: params.id },
      include: { items: { include: { orderItem: true } }, order: true },
    });
    if (!rr) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });

    const allowed = ALLOWED_TRANSITION[rr.status] || [];
    if (!allowed.includes(data.status)) {
      return NextResponse.json({ error: `${rr.status} → ${data.status} 전환은 허용되지 않습니다.` }, { status: 400 });
    }

    if (data.status === "APPROVED" && !data.pickupTrackingNo) {
      return NextResponse.json({ error: "회수 송장번호를 입력해주세요." }, { status: 400 });
    }

    const isReturnComplete = data.status === "COMPLETED" && rr.type === "RETURN";
    const refundAmount = Math.min(rr.refundAmount, rr.order.totalAmount - rr.order.refundedAmount);
    const isFullRefund = isReturnComplete && refundAmount + rr.order.refundedAmount >= rr.order.totalAmount;

    // PG 환불은 DB 변경 전에 호출 — 실패하면 상태를 바꾸지 않는다
    if (isReturnComplete && refundAmount > 0 && !data.skipPgCall) {
      if (!rr.order.providerTxnId || !rr.order.provider) {
        return NextResponse.json({
          error: "결제 정보가 없어 PG 환불을 호출할 수 없습니다. 이미 환불했다면 skipPgCall 을 사용하세요.",
        }, { status: 400 });
      }
      const pg = await cancelByProvider({
        provider: rr.order.provider,
        providerTxnId: rr.order.providerTxnId,
        reason: `반품 환불 (${rr.reason})`,
        amount: refundAmount,
      });
      if (!pg.ok) {
        logger.error("admin.return.pg_failed", { id: rr.id, orderId: rr.orderId, error: pg.error });
        return NextResponse.json({ error: `PG 환불 실패: ${pg.error}` }, { status: 502 });
      }
    }

    await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: data.status,
        adminMemo: data.adminMemo ?? rr.adminMemo,
      };
      if (data.pickupCourier !== undefined) updateData.pickupCourier = data.pickupCourier;
      if (data.pickupTrackingNo !== undefined) updateData.pickupTrackingNo = data.pickupTrackingNo;

      await tx.returnRequest.update({ where: { id: rr.id }, data: updateData });

      // COMPLETED: 환불 + 재고 복원 (RETURN 만, EXCHANGE 는 별도 발송)
      if (isReturnComplete) {
        // 1) 각 아이템의 refundedQuantity 증가 + 재고 복원
        for (const it of rr.items) {
          await tx.orderItem.update({
            where: { id: it.orderItemId },
            data: { refundedQuantity: { increment: it.quantity } },
          });
          if (it.orderItem.variantId) {
            await tx.productVariant.update({
              where: { id: it.orderItem.variantId },
              data: { stock: { increment: it.quantity } },
            });
          } else {
            await tx.product.update({
              where: { id: it.orderItem.productId },
              data: { stock: { increment: it.quantity } },
            });
          }
        }

        // 2) 환불 금액 누적 + 환불 이력
        await tx.order.update({
          where: { id: rr.orderId },
          data: {
            refundedAmount: { increment: refundAmount },
            status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
            cancelledAt: isFullRefund ? new Date() : rr.order.cancelledAt,
          },
        });
        await tx.refundRequest.create({
          data: {
            orderId: rr.orderId,
            userId: rr.order.userId,
            amount: refundAmount,
            reason: `반품 완료 (${rr.reason})`,
            status: "COMPLETED",
            adminMemo: data.skipPgCall ? "PG 호출 생략" : null,
            processedAt: new Date(),
          },
        });

        // 3) 전액 환불이면 적립금 정산 (사용분 복구, 적립분 회수)
        if (isFullRefund && rr.order.userId) {
          if (rr.order.pointUsed > 0) {
            await tx.user.update({
              where: { id: rr.order.userId },
              data: { pointBalance: { increment: rr.order.pointUsed } },
            });
            await tx.pointHistory.create({
              data: { userId: rr.order.userId, amount: rr.order.pointUsed, reason: "반품 환불 적립금 복구", orderId: rr.orderId },
            });
          }
          if (rr.order.pointEarned > 0) {
            await tx.user.update({
              where: { id: rr.order.userId },
              data: { pointBalance: { decrement: rr.order.pointEarned } },
            });
            await tx.pointHistory.create({
              data: { userId: rr.order.userId, amount: -rr.order.pointEarned, reason: "반품 환불로 적립금 회수", orderId: rr.orderId },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: guard.session?.user?.id || null,
          actorEmail: guard.session?.user?.email || null,
          action: `return.${data.status.toLowerCase()}`,
          targetType: "ReturnRequest",
          targetId: rr.id,
          metadata: { orderId: rr.orderId, type: rr.type, refundAmount, pgCalled: isReturnComplete && !data.skipPgCall },
        },
      });
    });

    logger.info("admin.return.transition", {
      id: rr.id, from: rr.status, to: data.status,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: e.message || "처리 실패" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelPendingOrder, restoreOrderStock } from "@/lib/stock";

/**
 * 사용자 측 주문 취소
 *
 * 정책:
 *  - PENDING (결제대기): 즉시 취소 가능
 *  - PAID (결제완료, 출고 전): 즉시 취소 + 재고 복원 + 환불 요청 자동 생성 (관리자 승인 후 PG 환불)
 *  - PREPARING/SHIPPED 이상: 일반 취소 불가 → 반품/교환으로 안내
 *
 * 환불 처리는 관리자 측에서 PG 호출이 필요하므로 여기서는 RefundRequest(REQUESTED) 만 생성한다.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const userId = (session.user as any).id as string;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, status: true, totalAmount: true },
  });
  if (!order) return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  if (order.userId !== userId) return NextResponse.json({ error: "본인 주문이 아닙니다." }, { status: 403 });

  if (order.status === "PENDING") {
    // 결제 전 — 즉시 취소 (hold 중인 쿠폰도 함께 해제)
    await cancelPendingOrder(order.id, "회원 직접 취소 (결제 전)");
    return NextResponse.json({ ok: true, refunded: false });
  }

  if (order.status === "PAID") {
    // 결제 후 출고 전 — 재고 복원 + 환불 요청 생성 + 상태 CANCELLED
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      await tx.refundRequest.create({
        data: {
          orderId: order.id,
          userId,
          amount: order.totalAmount,
          reason: "회원 직접 취소",
          status: "REQUESTED",
        },
      });
    });
    // 재고 복원은 트랜잭션 외부에서 (별도 트랜잭션)
    await restoreOrderStock(order.id).catch(() => {});
    return NextResponse.json({ ok: true, refunded: true, message: "취소 신청이 접수되었습니다. 환불은 영업일 기준 3~5일 내 처리됩니다." });
  }

  return NextResponse.json({
    error: "이미 출고/배송이 진행되어 일반 취소가 불가합니다. 반품/교환 신청을 이용해주세요.",
  }, { status: 400 });
}

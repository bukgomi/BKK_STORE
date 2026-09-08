import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCron } from "@/lib/cron-auth";
import { cancelPendingOrder } from "@/lib/stock";

/**
 * 만료된 PENDING 주문 자동 취소 + 쿠폰/적립금 reservation 해제
 *
 * 호출:
 *   GET /api/cron/expire-pending
 *   헤더: x-cron-token: ${CRON_SECRET}  (또는 Authorization: Bearer ${CRON_SECRET})
 *
 * Vercel Cron / 외부 스케줄러에서 5분 간격 권장
 */

export async function GET(req: NextRequest) {
  const auth = authorizeCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const now = new Date();
  const expired = await prisma.order.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, orderNo: true },
    take: 200,
  });

  let cancelled = 0;
  for (const order of expired) {
    try {
      if (await cancelPendingOrder(order.id, "PENDING 만료 자동취소")) cancelled++;
    } catch (e) {
      console.error("[expire-pending]", order.orderNo, e);
    }
  }

  return NextResponse.json({ ok: true, scanned: expired.length, cancelled });
}

export const POST = GET;

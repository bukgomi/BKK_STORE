import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { restoreOrderStock } from "@/lib/stock";

/**
 * 네이버페이 Webhook (취소/환불 통보)
 * 네이버페이 가맹점 관리자에서 등록한 Webhook URL 로 호출됨
 *
 * 인증: X-Naver-Client-Id, X-Naver-Client-Secret 일치 검증
 * - 환경변수 미설정시 환경 무관 503 (운영 누락 방어)
 */

function safeEqual(a: string | null, b: string): boolean {
  if (!a) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  const expectedId = process.env.NAVERPAY_CLIENT_ID;
  const expectedSecret = process.env.NAVERPAY_CLIENT_SECRET;
  if (!expectedId || !expectedSecret) {
    return NextResponse.json({ error: "naverpay not configured" }, { status: 503 });
  }
  if (
    !safeEqual(req.headers.get("x-naver-client-id"), expectedId) ||
    !safeEqual(req.headers.get("x-naver-client-secret"), expectedSecret)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const merchantPayKey = body?.merchantPayKey || body?.body?.merchantPayKey;
  const code = body?.code || body?.body?.code;
  const cancelAmount = Number(body?.body?.cancelAmount || 0);

  if (!merchantPayKey) return NextResponse.json({ ok: true, skip: "no key" });

  const order = await prisma.order.findUnique({ where: { orderNo: merchantPayKey } });
  if (!order) return NextResponse.json({ ok: true, skip: "no order" });

  try {
    if (code === "Success" || code === "CANCEL") {
      const fullCancel = cancelAmount === 0 || cancelAmount === order.totalAmount;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: fullCancel ? "CANCELLED" : "PARTIALLY_REFUNDED",
          cancelledAt: new Date(),
          refundedAmount: cancelAmount || order.totalAmount,
        },
      });
      if (fullCancel && order.paidAt) await restoreOrderStock(order.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[naver-webhook]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, getClientInfo } from "@/lib/security";

/**
 * 비회원 주문 조회.
 * 입력: 주문번호 + 전화번호 (정규화 후 비교)
 *
 * 보안:
 * - 회원 주문(userId 있음)은 비회원 조회 거부 → 회원은 마이페이지 사용
 * - rate limit: ip 단위 시간당 30회
 */

const Schema = z.object({
  orderNo: z.string().min(1).max(64),
  phone: z.string().min(8).max(20),
});

export async function POST(req: NextRequest) {
  try {
    const { ip } = getClientInfo(req);
    const rl = await rateLimitAsync(`guest-order:${ip || "anon"}`, 30, 60 * 60_000);
    if (!rl.ok) return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });

    const data = Schema.parse(await req.json());
    const phoneRaw = data.phone.replace(/[^0-9]/g, "");
    if (phoneRaw.length < 8) return NextResponse.json({ error: "전화번호 형식 오류" }, { status: 400 });

    const order = await prisma.order.findFirst({
      where: {
        orderNo: data.orderNo,
        userId: null, // 비회원 주문만
        phone: phoneRaw,
      },
      include: {
        items: {
          select: {
            id: true, name: true, variantName: true, price: true, quantity: true,
            productId: true,
          },
        },
      },
    });

    if (!order) {
      // enumeration 방어: 동일 메시지
      return NextResponse.json({ error: "조회 결과가 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      orderNo: order.orderNo,
      status: order.status,
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      itemsAmount: order.itemsAmount,
      recipient: order.recipient,
      zipCode: order.zipCode,
      address1: order.address1,
      address2: order.address2,
      memo: order.memo,
      provider: order.provider,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      courier: order.courier,
      trackingNo: order.trackingNo,
      items: order.items,
    });
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: "조회 실패" }, { status: 400 });
  }
}

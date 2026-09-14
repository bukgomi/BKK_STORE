import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOrderNo } from "@/lib/utils";
import { calcCouponDiscount, validateCouponForOrder } from "@/lib/coupon";
import { encrypt } from "@/lib/crypto";
import { checkIdempotency, saveIdempotency } from "@/lib/idempotency";
import { getSiteSettings } from "@/lib/site-settings";
import { calcShippingFee, SHIPPING_FEE } from "@/lib/shipping";

const PENDING_TTL_MS = 30 * 60 * 1000; // 30분 만료

const Schema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().nullable().optional(),
    quantity: z.number().int().min(1),
  })).min(1),
  recipient: z.string().min(1).max(60),
  phone: z.string().min(1).max(20),
  zipCode: z.string().min(1).max(10),
  address1: z.string().min(1).max(200),
  address2: z.string().max(200).optional(),
  memo: z.string().max(300).optional(),
  provider: z.enum(["TOSS", "INICIS", "NAVERPAY"]),
  userCouponId: z.string().nullable().optional(),
  pointUsed: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    // 멱등성: 동일 Idempotency-Key 재시도시 저장된 응답 그대로 반환
    const replay = await checkIdempotency(req, "orders.create", userId || null);
    if (replay) return replay;

    const body = await req.json();
    const data = Schema.parse(body);

    // 상품 + 옵션 일괄 조회
    const productIds = data.items.map((i) => i.productId);
    const variantIds = data.items.map((i) => i.variantId).filter(Boolean) as string[];

    const [products, variants] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } }),
      variantIds.length
        ? prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true } })
        : Promise.resolve([]),
    ]);

    if (products.length !== new Set(productIds).size) {
      return NextResponse.json({ error: "유효하지 않은 상품이 포함되어 있습니다." }, { status: 400 });
    }

    let itemsAmount = 0;
    const orderItemsData: any[] = [];

    for (const it of data.items) {
      const p = products.find((x) => x.id === it.productId);
      if (!p) throw new Error("상품을 찾을 수 없습니다.");

      const basePrice = p.salePrice ?? p.price;

      if (it.variantId) {
        const v = variants.find((x) => x.id === it.variantId && x.productId === p.id);
        if (!v) throw new Error(`${p.name} 옵션을 찾을 수 없습니다.`);
        if (v.stock < it.quantity) throw new Error(`${p.name} - ${v.name} 재고가 부족합니다.`);
        const unit = basePrice + v.priceModifier;
        itemsAmount += unit * it.quantity;
        orderItemsData.push({
          productId: p.id, variantId: v.id, name: p.name, variantName: v.name, price: unit, quantity: it.quantity,
        });
      } else {
        if (p.stock < it.quantity) throw new Error(`${p.name} 재고가 부족합니다.`);
        itemsAmount += basePrice * it.quantity;
        orderItemsData.push({
          productId: p.id, variantId: null, name: p.name, variantName: null, price: basePrice, quantity: it.quantity,
        });
      }
    }

    const shippingFee = calcShippingFee(itemsAmount, { shippingFee: SHIPPING_FEE, freeShippingMin: (await getSiteSettings()).freeShippingMin });

    // 쿠폰 적용
    let couponId: string | null = null;
    let couponDiscount = 0;
    if (data.userCouponId && userId) {
      const userCoupon = await prisma.userCoupon.findUnique({
        where: { id: data.userCouponId },
        include: { coupon: true },
      });
      const v = validateCouponForOrder(userCoupon, userId, itemsAmount);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      couponDiscount = calcCouponDiscount(userCoupon!.coupon, itemsAmount);
      couponId = userCoupon!.couponId;
    }

    // 적립금 사용
    let pointUsed = 0;
    if (data.pointUsed && data.pointUsed > 0) {
      if (!userId) return NextResponse.json({ error: "적립금 사용은 회원만 가능합니다." }, { status: 401 });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { pointBalance: true } });
      if (!user) return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
      if (data.pointUsed > user.pointBalance) {
        return NextResponse.json({ error: "보유 적립금을 초과했습니다." }, { status: 400 });
      }
      // 사용 가능한 최대 적립금 = (상품금액 - 쿠폰할인)의 100% 까지 (정책에 맞게 조정 가능)
      const maxUsable = Math.max(0, itemsAmount - couponDiscount);
      pointUsed = Math.min(data.pointUsed, maxUsable);
    }

    const totalAmount = Math.max(0, itemsAmount - couponDiscount - pointUsed + shippingFee);

    // 적립 예정금액 (1%)
    const POINT_EARN_RATE = parseFloat(process.env.POINT_EARN_RATE || "0.01");
    const pointEarned = Math.floor((itemsAmount - couponDiscount - pointUsed) * POINT_EARN_RATE / 10) * 10; // 10원 단위 절삭

    const phoneRaw = data.phone.replace(/[^0-9]/g, "");
    const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          userId: userId || null,
          status: "PENDING",
          itemsAmount,
          shippingFee,
          couponDiscount,
          pointUsed,
          pointEarned,
          totalAmount,
          expiresAt,                              // 30분 후 자동 취소 cron 대상
          recipient: data.recipient,
          phone: phoneRaw,                        // 평문 (호환)
          phoneEnc: encrypt(phoneRaw),            // 암호화
          zipCode: data.zipCode,
          address1: data.address1,
          address2: data.address2 || null,
          memo: data.memo || null,
          provider: data.provider,
          couponId: couponId,
          items: { create: orderItemsData },
        },
      });

      // 쿠폰 reservation (다른 PENDING 주문이 같은 쿠폰 못 쓰게 hold)
      if (couponId && userId && data.userCouponId) {
        const r = await tx.userCoupon.updateMany({
          where: {
            id: data.userCouponId,
            userId,
            usedAt: null,
            OR: [{ reservedOrderId: null }, { reservedOrderId: o.id }],
          },
          data: { reservedOrderId: o.id, reservedAt: new Date() },
        });
        if (r.count === 0) throw new Error("선택한 쿠폰을 다른 결제에서 사용 중입니다.");
      }
      return o;
    });

    const responseBody = {
      orderId: order.id,
      orderNo: order.orderNo,
      totalAmount: order.totalAmount,
    };
    await saveIdempotency(req, "orders.create", userId || null, 200, responseBody);
    return NextResponse.json(responseBody);
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: e.message || "주문 생성 실패" }, { status: 400 });
  }
}

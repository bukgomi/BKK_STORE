import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";
import { SHIPPING_FEE } from "@/lib/shipping";

/** 장바구니/결제 화면(클라이언트)이 배송비 정책을 읽는 공개 API */
export async function GET() {
  const s = await getSiteSettings();
  return NextResponse.json(
    { shippingFee: SHIPPING_FEE, freeShippingMin: s.freeShippingMin },
    { headers: { "Cache-Control": "no-store" } },
  );
}

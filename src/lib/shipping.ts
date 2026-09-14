/**
 * 배송비 정책 — 한 곳에서 관리
 * - 무료배송 기준(freeShippingMin)은 관리자 > 사이트 설정 값을 쓴다 (getSiteSettings)
 * - 기본 배송비는 SHIPPING_FEE
 */
export const SHIPPING_FEE = 3000;
export const DEFAULT_FREE_SHIPPING_MIN = 30000;

export type ShippingPolicy = { shippingFee: number; freeShippingMin: number };

export function calcShippingFee(subtotal: number, policy: ShippingPolicy = { shippingFee: SHIPPING_FEE, freeShippingMin: DEFAULT_FREE_SHIPPING_MIN }): number {
  if (subtotal <= 0) return 0;
  return subtotal >= policy.freeShippingMin ? 0 : policy.shippingFee;
}

/** "3만원" / "30,000원" 표기 */
export function formatMin(n: number, style: "만" | "원" = "원"): string {
  if (style === "만" && n % 10000 === 0) return `${n / 10000}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

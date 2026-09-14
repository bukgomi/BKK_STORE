/**
 * 회원 등급 시스템
 *
 * 누적 결제 금액(lifetimeAmount) 기준으로 5단계 등급 산정.
 * 등급별로 적립률·무료배송 기준이 차등 적용됨.
 *
 * - 적립률: 결제 완료 시 (subtotal × earningRate) 만큼 포인트 지급
 * - 무료배송 임계: 사이트 기본값(30,000) 이 더 낮을 수 있음 → min 사용
 */

export type MembershipTier = "BRONZE" | "SILVER" | "GOLD" | "VIP" | "VVIP";

export type TierMeta = {
  tier: MembershipTier;
  label: string;
  /** 다음 등급 진입에 필요한 누적 결제액 (현재 등급의 시작 금액) */
  thresholdAmount: number;
  /** 적립률 (0.005 = 0.5%) */
  earningRate: number;
  /** 무료배송 임계 (등급 우대) */
  freeShippingMin: number;
  /** UI 색상 */
  color: string;
  bgClass: string;
  emoji: string;
  benefits: string[];
};

/** 낮은 등급 → 높은 등급 순으로 정렬 */
export const TIERS: TierMeta[] = [
  {
    tier: "BRONZE", label: "브론즈",
    thresholdAmount: 0,
    earningRate: 0.005,
    freeShippingMin: 30000,
    color: "text-amber-700", bgClass: "bg-amber-100", emoji: "🥉",
    benefits: ["기본 0.5% 적립"],
  },
  {
    tier: "SILVER", label: "실버",
    thresholdAmount: 100_000,
    earningRate: 0.01,
    freeShippingMin: 30000,
    color: "text-gray-600", bgClass: "bg-gray-200", emoji: "🥈",
    benefits: ["1% 적립", "월 1회 5천원 쿠폰"],
  },
  {
    tier: "GOLD", label: "골드",
    thresholdAmount: 500_000,
    earningRate: 0.015,
    freeShippingMin: 30000,
    color: "text-yellow-700", bgClass: "bg-yellow-100", emoji: "🥇",
    benefits: ["1.5% 적립", "3만원 이상 무료배송", "월 1회 1만원 쿠폰"],
  },
  {
    tier: "VIP", label: "VIP",
    thresholdAmount: 2_000_000,
    earningRate: 0.02,
    freeShippingMin: 0,
    color: "text-purple-700", bgClass: "bg-purple-100", emoji: "💎",
    benefits: ["2% 적립", "전 상품 무료배송", "전용 신상품 우선 알림"],
  },
  {
    tier: "VVIP", label: "VVIP",
    thresholdAmount: 5_000_000,
    earningRate: 0.03,
    freeShippingMin: 0,
    color: "text-rose-700", bgClass: "bg-rose-100", emoji: "👑",
    benefits: ["3% 적립", "전 상품 무료배송", "전담 CS", "분기별 사은품"],
  },
];

/** 누적 결제액 → 등급 메타 */
export function getTierByAmount(amount: number): TierMeta {
  let result = TIERS[0];
  for (const t of TIERS) {
    if (amount >= t.thresholdAmount) result = t;
  }
  return result;
}

/** 다음 등급까지 남은 금액 (마지막 등급이면 null) */
export function nextTierProgress(amount: number): { next: TierMeta; remaining: number; progress: number } | null {
  const cur = getTierByAmount(amount);
  const idx = TIERS.findIndex((t) => t.tier === cur.tier);
  if (idx === -1 || idx >= TIERS.length - 1) return null;
  const next = TIERS[idx + 1];
  const remaining = Math.max(0, next.thresholdAmount - amount);
  const range = next.thresholdAmount - cur.thresholdAmount;
  const progress = range > 0 ? Math.min(1, (amount - cur.thresholdAmount) / range) : 1;
  return { next, remaining, progress };
}

/** 적립 예상액 계산 — 결제 amount 기준 */
export function calcEarningPoints(amount: number, tier: MembershipTier): number {
  const meta = TIERS.find((t) => t.tier === tier) || TIERS[0];
  return Math.floor(amount * meta.earningRate);
}

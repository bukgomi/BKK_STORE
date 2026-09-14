import { z } from "zod";

/** 기획전 slug: 영문 소문자·숫자·한글·하이픈, 2~80자 */
export const SLUG_RE = /^[a-z0-9가-힣][a-z0-9가-힣-]{1,79}$/;

export function slugifyTitle(title: string): string {
  const s = title.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return SLUG_RE.test(s) ? s : `event-${Date.now().toString(36)}`;
}

export const promotionSchema = z.object({
  title: z.string().min(1).max(120),
  slug: z.string().regex(SLUG_RE, "주소는 영문 소문자·숫자·한글·하이픈만 2~80자"),
  eyebrow: z.string().max(40).optional().or(z.literal("")),
  subtitle: z.string().max(160).optional().or(z.literal("")),
  coverImage: z.string().max(500).optional().or(z.literal("")),
  bgClass: z.string().max(200).optional().or(z.literal("")),
  content: z.string().max(200_000).default(""),
  productIds: z.array(z.string().min(1).max(64)).max(60).default([]),
  isPublished: z.boolean().default(true),
  startsAt: z.string().datetime().nullable().optional().or(z.literal("")),
  endsAt: z.string().datetime().nullable().optional().or(z.literal("")),
  /** 저장 후 메인 히어로 슬라이드에 이 기획전을 추가/갱신 */
  addToHero: z.boolean().optional(),
  /** 저장 후 히어로 슬라이드에서 이 기획전 제거 */
  removeFromHero: z.boolean().optional(),
});
export type PromotionInput = z.infer<typeof promotionSchema>;

export function promotionHref(slug: string) {
  return `/event/${slug}`;
}

/** 진행 기간 판단 (기간 미설정이면 항상 진행 중) */
export function isPromotionLive(p: { isPublished: boolean; startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  if (!p.isPublished) return false;
  if (p.startsAt && p.startsAt > now) return false;
  if (p.endsAt && p.endsAt < now) return false;
  return true;
}

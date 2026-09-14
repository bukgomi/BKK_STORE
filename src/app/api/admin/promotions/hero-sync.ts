import { getSiteSettings, saveSiteSettings, type HeroSlide } from "@/lib/site-settings";
import { promotionHref } from "@/lib/promotion";

type PromoLike = { slug: string; title: string; eyebrow: string | null; subtitle: string | null; coverImage: string | null; bgClass: string | null };

/** 기획전 → 메인 히어로 슬라이드 추가/갱신/제거 (href 가 /event/<slug> 인 슬라이드를 같은 것으로 본다) */
export async function syncPromotionHero(p: PromoLike, mode: "add" | "remove", actorEmail?: string) {
  const settings = await getSiteSettings();
  const href = promotionHref(p.slug);
  const rest = settings.heroSlides.filter((s) => s.href !== href);
  if (mode === "remove") {
    if (rest.length !== settings.heroSlides.length) await saveSiteSettings({ heroSlides: rest }, actorEmail);
    return;
  }
  const existing = settings.heroSlides.find((s) => s.href === href);
  const slide: HeroSlide = {
    eyebrow: p.eyebrow || existing?.eyebrow || "기획전",
    title: p.title,
    subtitle: p.subtitle || existing?.subtitle || "",
    cta: existing?.cta || "자세히 보기",
    href,
    bgClass: p.bgClass || existing?.bgClass || "bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500",
    image: p.coverImage || existing?.image || "",
  };
  const idx = settings.heroSlides.findIndex((s) => s.href === href);
  const next = idx >= 0 ? settings.heroSlides.map((s, i) => (i === idx ? slide : s)) : [slide, ...settings.heroSlides].slice(0, 10);
  await saveSiteSettings({ heroSlides: next }, actorEmail);
}

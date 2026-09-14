import { prisma } from "@/lib/prisma";

// ===== 타입 정의 =====
export type HeroSlide = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  cta: string;
  href: string;
  /** Tailwind gradient class (예: "from-brand-700 to-brand-500") */
  bgClass?: string;
  /** 배경 이미지 URL (지정시 bgClass 위에 어둡게 오버레이) */
  image?: string;
  /** true 면 문구·버튼·어두운 오버레이 없이 이미지만 보여준다 (브랜드 배너 등) */
  imageOnly?: boolean;
};

export type SideBanner = {
  eyebrow: string;
  title: string;
  href: string;
  bgClass?: string;
  emoji?: string;
};

export type NoticeBar = {
  enabled: boolean;
  text: string;
  href?: string;
  bgColor?: string;   // tailwind class, e.g. "bg-brand-700"
  fgColor?: string;   // tailwind class, e.g. "text-white"
};

export type FooterOverride = {
  /** 사업자명 (env 우선) */
  name?: string;
  ceo?: string;
  bizNo?: string;
  ecommNo?: string;
  address?: string;
  csPhone?: string;
  csEmail?: string;
  csHours?: string;
  privacyOfficer?: string;
  privacyEmail?: string;
  /** 푸터 상단의 한 줄 캐치프레이즈 */
  tagline?: string;
};

export type SiteSettings = {
  heroSlides: HeroSlide[];
  sideBanners: SideBanner[];
  noticeBar: NoticeBar;
  footer: FooterOverride;
  freeShippingMin: number;
  showBestSection: boolean;
  showFeaturedSection: boolean;
  showNewSection: boolean;
  showCategoryShortcut: boolean;
};

// ===== 기본값 =====
export const DEFAULT_SETTINGS: SiteSettings = {
  heroSlides: [
    {
      eyebrow: "시즌 특가",
      title: "봄 시즌 낚시용품 대전",
      subtitle: "최대 30% 할인 · 무료배송 3만원 이상",
      cta: "할인상품 보러가기",
      href: "/products?sale=1",
      bgClass: "bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500",
    },
    {
      eyebrow: "신상품 입고",
      title: "2026 신상 낚싯대 모음",
      subtitle: "프리미엄 카본 · 가벼운 무게 · 강한 내구성",
      cta: "신상품 보기",
      href: "/products?sort=new",
      bgClass: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600",
    },
    {
      eyebrow: "베스트셀러",
      title: "실전 검증된 루어 컬렉션",
      subtitle: "수만 명의 낚시인이 선택한 인기 모델",
      cta: "베스트 보러가기",
      href: "/products?sort=best",
      bgClass: "bg-gradient-to-br from-orange-600 via-accent-500 to-amber-400",
    },
  ],
  sideBanners: [
    {
      eyebrow: "신상품",
      title: "2026 신상 낚싯대",
      href: "/products?category=rod",
      bgClass: "bg-gradient-to-br from-slate-900 to-slate-700",
      emoji: "🎣",
    },
    {
      eyebrow: "인기 카테고리",
      title: "베스트 릴 모음",
      href: "/products?category=reel&sort=best",
      bgClass: "bg-gradient-to-br from-accent-500 to-orange-400",
      emoji: "🎰",
    },
  ],
  noticeBar: {
    enabled: false,
    text: "",
    href: "",
    bgColor: "bg-brand-700",
    fgColor: "text-white",
  },
  footer: {},
  freeShippingMin: 30000,
  showBestSection: true,
  showFeaturedSection: true,
  showNewSection: true,
  showCategoryShortcut: true,
};

// ===== 캐시 (모듈 레벨, 60초 TTL) =====
let cache: { data: SiteSettings; at: number } | null = null;
const TTL_MS = 60_000;

/** 외부에서 갱신 직후 호출하면 다음 read에서 fresh */
export function invalidateSiteSettings() {
  cache = null;
}

/** 머지된 (defaults + DB) 설정 반환 */
export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const row = await prisma.siteSettings
    .findUnique({ where: { id: "default" } })
    .catch(() => null);

  const merged: SiteSettings = row
    ? {
        heroSlides: arrayOr(row.heroSlides, DEFAULT_SETTINGS.heroSlides),
        sideBanners: arrayOr(row.sideBanners, DEFAULT_SETTINGS.sideBanners),
        noticeBar: { ...DEFAULT_SETTINGS.noticeBar, ...(objectOr(row.noticeBar) as Partial<NoticeBar>) },
        footer: { ...DEFAULT_SETTINGS.footer, ...(objectOr(row.footer) as Partial<FooterOverride>) },
        freeShippingMin: row.freeShippingMin,
        showBestSection: row.showBestSection,
        showFeaturedSection: row.showFeaturedSection,
        showNewSection: row.showNewSection,
        showCategoryShortcut: row.showCategoryShortcut,
      }
    : DEFAULT_SETTINGS;

  cache = { data: merged, at: Date.now() };
  return merged;
}

/** 관리자 저장 — 입력 검증 후 upsert */
export async function saveSiteSettings(input: Partial<SiteSettings>, actorEmail?: string) {
  const data: any = {};
  if (input.heroSlides !== undefined) data.heroSlides = input.heroSlides;
  if (input.sideBanners !== undefined) data.sideBanners = input.sideBanners;
  if (input.noticeBar !== undefined) data.noticeBar = input.noticeBar;
  if (input.footer !== undefined) data.footer = input.footer;
  if (input.freeShippingMin !== undefined) data.freeShippingMin = Math.max(0, Math.floor(input.freeShippingMin));
  if (input.showBestSection !== undefined) data.showBestSection = !!input.showBestSection;
  if (input.showFeaturedSection !== undefined) data.showFeaturedSection = !!input.showFeaturedSection;
  if (input.showNewSection !== undefined) data.showNewSection = !!input.showNewSection;
  if (input.showCategoryShortcut !== undefined) data.showCategoryShortcut = !!input.showCategoryShortcut;
  if (actorEmail) data.updatedBy = actorEmail;

  await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  invalidateSiteSettings();
}

// 헬퍼
function arrayOr<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) && v.length > 0 ? (v as T[]) : fallback;
}
function objectOr(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminApi } from "@/lib/admin-guard";
import { getSiteSettings, saveSiteSettings } from "@/lib/site-settings";
import { audit } from "@/lib/audit";

// 사이트 내부 경로 또는 http(s) 만 허용 — javascript:/data: 등 스킴 주입 차단
const safeHref = (max: number) =>
  z.string().max(max).refine(
    (v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v),
    { message: "링크는 /경로 또는 http(s):// 로 시작해야 합니다." },
  );

const heroSlideSchema = z.object({
  eyebrow: z.string().max(40),
  title: z.string().min(1).max(80),
  subtitle: z.string().max(120).optional().or(z.literal("")),
  cta: z.string().min(1).max(40),
  href: safeHref(200).refine((v) => v.length > 0, { message: "링크를 입력해주세요." }),
  bgClass: z.string().max(200).optional().or(z.literal("")),
  image: z.string().max(500).optional().or(z.literal("")),
});

const sideBannerSchema = z.object({
  eyebrow: z.string().max(40),
  title: z.string().min(1).max(60),
  href: safeHref(200).refine((v) => v.length > 0, { message: "링크를 입력해주세요." }),
  bgClass: z.string().max(200).optional().or(z.literal("")),
  emoji: z.string().max(8).optional().or(z.literal("")),
});

const noticeBarSchema = z.object({
  enabled: z.boolean(),
  text: z.string().max(200),
  href: safeHref(200).optional(),
  bgColor: z.string().max(40).optional().or(z.literal("")),
  fgColor: z.string().max(40).optional().or(z.literal("")),
});

const footerSchema = z.object({
  name: z.string().max(60).optional().or(z.literal("")),
  ceo: z.string().max(40).optional().or(z.literal("")),
  bizNo: z.string().max(40).optional().or(z.literal("")),
  ecommNo: z.string().max(60).optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
  csPhone: z.string().max(40).optional().or(z.literal("")),
  csEmail: z.string().max(80).optional().or(z.literal("")),
  csHours: z.string().max(120).optional().or(z.literal("")),
  privacyOfficer: z.string().max(40).optional().or(z.literal("")),
  privacyEmail: z.string().max(80).optional().or(z.literal("")),
  tagline: z.string().max(200).optional().or(z.literal("")),
});

const inputSchema = z.object({
  heroSlides: z.array(heroSlideSchema).max(10).optional(),
  sideBanners: z.array(sideBannerSchema).max(4).optional(),
  noticeBar: noticeBarSchema.optional(),
  footer: footerSchema.optional(),
  freeShippingMin: z.number().int().min(0).max(10_000_000).optional(),
  showBestSection: z.boolean().optional(),
  showFeaturedSection: z.boolean().optional(),
  showNewSection: z.boolean().optional(),
  showCategoryShortcut: z.boolean().optional(),
});

export async function GET() {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const settings = await getSiteSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력 검증 실패", details: parsed.error.flatten() }, { status: 400 });
  }

  await saveSiteSettings(parsed.data, guard.session.user.email);
  await audit({
    actorId: guard.session?.user?.id, actorEmail: guard.session?.user?.email,
    action: "site.update", targetType: "SiteSettings", targetId: "global",
    metadata: { sections: Object.keys(parsed.data) },
  });
  return NextResponse.json({ ok: true });
}

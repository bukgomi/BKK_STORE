import { NextRequest, NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { promotionSchema } from "@/lib/promotion";
import { syncPromotionHero } from "./hero-sync";

/** 기획전 목록 (관리자 화면·슬라이드 링크 선택기용) */
export async function GET() {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const items = await prisma.promotion.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, eyebrow: true, subtitle: true, coverImage: true, bgClass: true, isPublished: true, startsAt: true, endsAt: true, viewCount: true, createdAt: true, productIds: true },
    take: 200,
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }
  const parsed = promotionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "입력 검증 실패", details: parsed.error.flatten() }, { status: 400 });
  const { addToHero, removeFromHero, startsAt, endsAt, ...data } = parsed.data;

  const dup = await prisma.promotion.findUnique({ where: { slug: data.slug } });
  if (dup) return NextResponse.json({ error: "이미 사용 중인 주소(slug)입니다." }, { status: 409 });

  const created = await prisma.promotion.create({
    data: {
      ...data,
      eyebrow: data.eyebrow || null, subtitle: data.subtitle || null, coverImage: data.coverImage || null, bgClass: data.bgClass || null,
      startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null,
      createdBy: guard.session.user.email,
    },
  });
  if (addToHero) await syncPromotionHero(created, "add", guard.session.user.email || undefined);
  return NextResponse.json({ id: created.id, slug: created.slug });
}

import { NextRequest, NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { promotionSchema } from "@/lib/promotion";
import { syncPromotionHero } from "../hero-sync";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const p = await prisma.promotion.findUnique({ where: { id: params.id } });
  if (!p) return NextResponse.json({ error: "없음" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }
  const parsed = promotionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "입력 검증 실패", details: parsed.error.flatten() }, { status: 400 });
  const { addToHero, removeFromHero, startsAt, endsAt, ...data } = parsed.data;

  const current = await prisma.promotion.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "없음" }, { status: 404 });
  if (data.slug !== current.slug) {
    const dup = await prisma.promotion.findUnique({ where: { slug: data.slug } });
    if (dup) return NextResponse.json({ error: "이미 사용 중인 주소(slug)입니다." }, { status: 409 });
  }

  const updated = await prisma.promotion.update({
    where: { id: params.id },
    data: {
      ...data,
      eyebrow: data.eyebrow || null, subtitle: data.subtitle || null, coverImage: data.coverImage || null, bgClass: data.bgClass || null,
      startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null,
    },
  });
  // slug 가 바뀌었으면 예전 주소의 슬라이드는 제거
  if (data.slug !== current.slug) await syncPromotionHero(current, "remove", guard.session.user.email || undefined);
  if (addToHero) await syncPromotionHero(updated, "add", guard.session.user.email || undefined);
  else if (removeFromHero) await syncPromotionHero(updated, "remove", guard.session.user.email || undefined);
  return NextResponse.json({ ok: true, slug: updated.slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const p = await prisma.promotion.findUnique({ where: { id: params.id } });
  if (!p) return NextResponse.json({ error: "없음" }, { status: 404 });
  await prisma.promotion.delete({ where: { id: params.id } });
  await syncPromotionHero(p, "remove", guard.session.user.email || undefined);
  return NextResponse.json({ ok: true });
}

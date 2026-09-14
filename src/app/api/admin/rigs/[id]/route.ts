import { NextRequest, NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { rigSchema } from "@/lib/rig";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }
  const parsed = rigSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "입력 검증 실패", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const cur = await prisma.rigGuide.findUnique({ where: { id: params.id } });
  if (!cur) return NextResponse.json({ error: "없음" }, { status: 404 });
  if (d.slug !== cur.slug && (await prisma.rigGuide.findUnique({ where: { slug: d.slug } }))) return NextResponse.json({ error: "이미 사용 중인 주소(slug)입니다." }, { status: 409 });
  await prisma.rigGuide.update({
    where: { id: params.id },
    data: { ...d, speciesImage: d.speciesImage || null, summary: d.summary || null, diagramImage: d.diagramImage || null, components: d.components },
  });
  return NextResponse.json({ ok: true, slug: d.slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  await prisma.rigGuide.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

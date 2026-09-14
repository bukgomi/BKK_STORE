import { NextRequest, NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { rigSchema } from "@/lib/rig";

export async function GET() {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const items = await prisma.rigGuide.findMany({ orderBy: [{ species: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }], take: 500 });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }
  const parsed = rigSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "입력 검증 실패", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  if (await prisma.rigGuide.findUnique({ where: { slug: d.slug } })) return NextResponse.json({ error: "이미 사용 중인 주소(slug)입니다." }, { status: 409 });
  const created = await prisma.rigGuide.create({
    data: { ...d, speciesImage: d.speciesImage || null, summary: d.summary || null, diagramImage: d.diagramImage || null, components: d.components },
  });
  return NextResponse.json({ id: created.id, slug: created.slug });
}

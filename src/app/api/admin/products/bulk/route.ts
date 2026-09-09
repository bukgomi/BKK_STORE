import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdminApi } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";

const VariantSchema = z.object({
  name: z.string().min(1).max(40),
  priceModifier: z.number().int().default(0),
  stock: z.number().int().min(0).default(0),
});

const RowSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0),
  salePrice: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).nullable().optional(),
  categorySlug: z.string().min(1),
  thumbnail: z.string().nullable().optional(),
  images: z.array(z.string()).default([]),
  optionTitle: z.string().max(40).nullable().optional(),
  variants: z.array(VariantSchema).max(200).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

const Schema = z.object({ rows: z.array(RowSchema).min(1).max(2000) });

/** 옵션 제목 → optionType (색상/사이즈/무게 구분은 표시용) */
function optionTypeOf(title: string | null | undefined): string {
  const t = (title || "").replace(/\s/g, "");
  if (/색상|컬러|색/.test(t)) return "color";
  if (/사이즈|크기|호수/.test(t)) return "size";
  if (/무게|oz|g$/i.test(t)) return "weight";
  return "option";
}

export async function POST(req: NextRequest) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { rows } = Schema.parse(await req.json());

    // 카테고리 slug → id 일괄 조회
    const slugs = Array.from(new Set(rows.map((r) => r.categorySlug)));
    const cats = await prisma.category.findMany({ where: { slug: { in: slugs } } });
    const slugToId = new Map(cats.map((c) => [c.slug, c.id]));

    let created = 0, updated = 0, failed = 0, variantsWritten = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        if (row.salePrice != null && row.salePrice >= row.price) throw new Error(`[${row.sku}] 할인가가 판매가 이상`);
        const categoryId = slugToId.get(row.categorySlug);
        if (!categoryId) throw new Error(`[${row.sku}] 존재하지 않는 카테고리: ${row.categorySlug}`);

        const data = {
          sku: row.sku,
          name: row.name,
          brand: row.brand ?? null,
          description: row.description ?? null,
          price: row.price,
          salePrice: row.salePrice ?? null,
          stock: row.stock,
          lowStockThreshold: row.lowStockThreshold ?? null,
          thumbnail: row.thumbnail ?? null,
          images: row.images,
          isActive: row.isActive,
          isFeatured: row.isFeatured,
          categoryId,
        };

        await prisma.$transaction(async (tx) => {
          const exists = await tx.product.findUnique({ where: { sku: row.sku }, select: { id: true } });
          const product = exists
            ? await tx.product.update({ where: { id: exists.id }, data })
            : await tx.product.create({ data });
          exists ? updated++ : created++;

          // 옵션 동기화 — 이름 기준. 엑셀에 없는 기존 옵션은 삭제 대신 비활성 (주문 이력 보존)
          if (row.variants.length > 0) {
            const type = optionTypeOf(row.optionTitle);
            const existing = await tx.productVariant.findMany({ where: { productId: product.id } });
            const byName = new Map(existing.map((v) => [v.name, v]));
            const incoming = new Set<string>();
            for (const [i, v] of row.variants.entries()) {
              incoming.add(v.name);
              const cur = byName.get(v.name);
              const payload = { optionType: type, priceModifier: v.priceModifier, stock: v.stock, sortOrder: i, isActive: true };
              if (cur) await tx.productVariant.update({ where: { id: cur.id }, data: payload });
              else await tx.productVariant.create({ data: { ...payload, name: v.name, productId: product.id } });
              variantsWritten++;
            }
            const stale = existing.filter((v) => !incoming.has(v.name) && v.isActive);
            if (stale.length) {
              await tx.productVariant.updateMany({ where: { id: { in: stale.map((v) => v.id) } }, data: { isActive: false } });
            }
          }
        });
      } catch (e: any) {
        failed++;
        errors.push(e.message || `${row.sku} 처리 실패`);
      }
    }

    await audit({
      actorId: guard.session.user.id, actorEmail: guard.session.user.email,
      action: "product.bulk_upsert", targetType: "Product", targetId: null,
      metadata: { rows: rows.length, created, updated, failed, variantsWritten },
    });

    return NextResponse.json({ created, updated, failed, variantsWritten, errors });
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: e.message || "일괄 처리 실패" }, { status: 400 });
  }
}

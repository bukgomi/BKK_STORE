import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdminApi } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";

const VariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  optionType: z.string().max(80).default("option"),
  colorHex: z.string().nullable().optional(),
  stock: z.number().int().min(0),
  priceModifier: z.number().int().default(0),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const UpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0).optional(),
  salePrice: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  categoryId: z.string().min(1).optional(),
  variants: z.array(VariantSchema).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const p = await prisma.product.findUnique({ where: { id: params.id }, include: { variants: true } });
  if (!p) return NextResponse.json({ error: "상품 없음" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const data = UpdateSchema.parse(await req.json());

    if (typeof data.price === "number" && typeof data.salePrice === "number" && data.salePrice >= data.price) {
      return NextResponse.json({ error: "할인가는 판매가보다 낮아야 합니다." }, { status: 400 });
    }

    const { variants, ...productData } = data;

    await prisma.$transaction(async (tx) => {
      // 1) 상품 본체 업데이트
      await tx.product.update({ where: { id: params.id }, data: productData });

      // 2) 옵션 동기화 (지정한 경우만)
      if (variants !== undefined) {
        const existing = await tx.productVariant.findMany({ where: { productId: params.id }, select: { id: true } });
        const incomingIds = new Set(variants.filter((v) => v.id).map((v) => v.id as string));

        // 삭제: 기존엔 있고 incoming 엔 없는 항목
        const toDeleteIds = existing.map((e) => e.id).filter((id) => !incomingIds.has(id));
        if (toDeleteIds.length > 0) {
          // 주문이력이 있는 옵션은 삭제 대신 비활성화
          const usedIds = (await tx.orderItem.findMany({
            where: { variantId: { in: toDeleteIds } },
            select: { variantId: true },
          })).map((o) => o.variantId).filter(Boolean) as string[];
          const usedSet = new Set(usedIds);

          const reallyDelete = toDeleteIds.filter((id) => !usedSet.has(id));
          if (reallyDelete.length > 0) {
            await tx.productVariant.deleteMany({ where: { id: { in: reallyDelete } } });
          }
          if (usedSet.size > 0) {
            await tx.productVariant.updateMany({
              where: { id: { in: Array.from(usedSet) } },
              data: { isActive: false },
            });
          }
        }

        // 추가/수정
        for (const v of variants) {
          const payload = {
            name: v.name,
            optionType: v.optionType,
            colorHex: v.colorHex || null,
            stock: v.stock,
            priceModifier: v.priceModifier,
            sortOrder: v.sortOrder,
            isActive: v.isActive,
          };
          if (v.id) {
            await tx.productVariant.update({ where: { id: v.id }, data: payload });
          } else {
            await tx.productVariant.create({
              data: { ...payload, productId: params.id },
            });
          }
        }
      }
    });

    const refreshed = await prisma.product.findUnique({ where: { id: params.id }, include: { variants: true } });
    await audit({
      actorId: guard.session?.user?.id, actorEmail: guard.session?.user?.email,
      action: "product.update", targetType: "Product", targetId: params.id,
      metadata: { fields: Object.keys(data) },
    });
    return NextResponse.json(refreshed);
  } catch (e: any) {
    if (e?.code === "P2025") return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: e.message || "수정 실패" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const orderItemCount = await prisma.orderItem.count({ where: { productId: params.id } });
  if (orderItemCount > 0) {
    await prisma.product.update({ where: { id: params.id }, data: { isActive: false } });
    await audit({
      actorId: guard.session?.user?.id, actorEmail: guard.session?.user?.email,
      action: "product.soft_delete", targetType: "Product", targetId: params.id,
      metadata: { reason: "had_order_items", orderItemCount },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  }

  try {
    await prisma.product.delete({ where: { id: params.id } });
    await audit({
      actorId: guard.session?.user?.id, actorEmail: guard.session?.user?.email,
      action: "product.delete", targetType: "Product", targetId: params.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025") return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ error: e.message || "삭제 실패" }, { status: 400 });
  }
}

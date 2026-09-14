import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdminApi } from "@/lib/admin-guard";

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

const CreateSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0),
  salePrice: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().min(1),
  variants: z.array(VariantSchema).default([]),
});

export async function POST(req: NextRequest) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const data = CreateSchema.parse(await req.json());
    if (data.salePrice != null && data.salePrice >= data.price) {
      return NextResponse.json({ error: "할인가는 판매가보다 낮아야 합니다." }, { status: 400 });
    }

    const dup = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (dup) return NextResponse.json({ error: "이미 존재하는 SKU입니다." }, { status: 409 });

    const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!cat) return NextResponse.json({ error: "존재하지 않는 카테고리입니다." }, { status: 400 });

    const { variants, ...productData } = data;
    const product = await prisma.product.create({
      data: {
        ...productData,
        variants: variants.length > 0
          ? {
              create: variants.map(({ id, ...v }) => ({
                name: v.name,
                optionType: v.optionType,
                colorHex: v.colorHex || null,
                stock: v.stock,
                priceModifier: v.priceModifier,
                sortOrder: v.sortOrder,
                isActive: v.isActive,
              })),
            }
          : undefined,
      },
      include: { variants: true },
    });
    return NextResponse.json(product);
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: e.message || "등록 실패" }, { status: 400 });
  }
}

export async function GET(_req: NextRequest) {
  const guard = await assertAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const items = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { category: true, variants: true },
  });
  return NextResponse.json(items);
}

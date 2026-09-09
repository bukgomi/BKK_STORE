import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientInfo, rateLimitAsync } from "@/lib/security";

/**
 * 검색 자동완성 — 상품/브랜드/카테고리 통합
 * GET /api/search/suggest?q=검색어
 */
const EMPTY = { products: [], brands: [], categories: [] };

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim();
  if (q.length < 1 || q.length > 50) return NextResponse.json(EMPTY);

  // 타이핑마다 호출되는 엔드포인트라 넉넉하게, 그러나 무제한 스캔은 차단
  const { ip } = getClientInfo(req);
  const rl = await rateLimitAsync(`search-suggest:${ip || "anon"}`, 120, 60_000);
  if (!rl.ok) return NextResponse.json(EMPTY, { status: 429 });

  try {
    const [products, brands, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, brand: true, thumbnail: true, price: true, salePrice: true },
        take: 6,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      }),
      prisma.product.findMany({
        where: { isActive: true, brand: { contains: q, mode: "insensitive" } },
        select: { brand: true },
        distinct: ["brand"],
        take: 5,
      }),
      prisma.category.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, slug: true, parentId: true },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      products,
      brands: brands.map((b) => b.brand).filter(Boolean),
      categories,
    });
  } catch {
    return NextResponse.json(EMPTY);
  }
}

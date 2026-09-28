/**
 * 카탈로그 이전 (개발 DB → 운영 DB) — 삭제 없이 upsert 만 수행
 *
 *   내보내기(로컬 app 컨테이너):  npx tsx scripts/migrate/catalog-transfer.ts export scripts/migrate/out/catalog-export.json
 *   가져오기(운영 app 컨테이너):  npx tsx scripts/migrate/catalog-transfer.ts import /tmp/catalog-export.json
 *
 * 대상: Category(슬러그 기준 upsert, 운영 id 유지), Product(SKU 기준 upsert, 로컬 id 유지 — 기획전/채비도의 상품 참조 보존),
 *      ProductVariant(상품별 재생성 — 기존 변형이 없을 때만 삽입), RigGuide/Promotion(슬러그 기준 upsert), SiteSettings(단일 행 갱신)
 * 이미지 파일(public/uploads)은 별도로 복사한다.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "fs";

const prisma = new PrismaClient();
const [mode, file] = process.argv.slice(2);

async function doExport(out: string) {
  const data = {
    categories: await prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    products: await prisma.product.findMany({ include: { variants: { orderBy: { sortOrder: "asc" } }, category: { select: { slug: true } } } }),
    rigs: await prisma.rigGuide.findMany(),
    promotions: await prisma.promotion.findMany(),
    siteSettings: await prisma.siteSettings.findFirst(),
  };
  writeFileSync(out, JSON.stringify(data, null, 1));
  console.log(`export: categories=${data.categories.length} products=${data.products.length} variants=${data.products.reduce((n, p) => n + p.variants.length, 0)} rigs=${data.rigs.length} promotions=${data.promotions.length} settings=${data.siteSettings ? 1 : 0} → ${out}`);
}

async function doImport(inFile: string) {
  const d = JSON.parse(readFileSync(inFile, "utf8"));
  const stats = { catCreated: 0, catUpdated: 0, prodCreated: 0, prodUpdated: 0, variants: 0, rigs: 0, promos: 0, settings: 0 };

  // 1) 카테고리 — 슬러그 기준. 부모는 2단계로 연결 (부모 슬러그 → 운영 id)
  const localById = new Map<string, any>(d.categories.map((c: any) => [c.id, c]));
  const slugToServerId = new Map<string, string>();
  for (const c of d.categories) {
    const data = { name: c.name, sortOrder: c.sortOrder, description: c.description, bannerImage: c.bannerImage, iconEmoji: c.iconEmoji };
    const existing = await prisma.category.findUnique({ where: { slug: c.slug }, select: { id: true } });
    const row = existing
      ? (stats.catUpdated++, await prisma.category.update({ where: { slug: c.slug }, data }))
      : (stats.catCreated++, await prisma.category.create({ data: { slug: c.slug, ...data } }));
    slugToServerId.set(c.slug, row.id);
  }
  for (const c of d.categories) {
    const parentSlug = c.parentId ? localById.get(c.parentId)?.slug : null;
    await prisma.category.update({ where: { slug: c.slug }, data: { parentId: parentSlug ? slugToServerId.get(parentSlug) ?? null : null } });
  }

  // 2) 상품 — SKU 기준 upsert (id 는 로컬 값 유지)
  for (const p of d.products) {
    const categoryId = slugToServerId.get(p.category.slug);
    if (!categoryId) throw new Error(`category slug not found: ${p.category.slug}`);
    const data = {
      name: p.name, brand: p.brand, description: p.description, price: p.price, salePrice: p.salePrice, stock: p.stock,
      lowStockThreshold: p.lowStockThreshold, thumbnail: p.thumbnail, images: p.images, isActive: p.isActive, isFeatured: p.isFeatured, categoryId,
    };
    const existing = await prisma.product.findUnique({ where: { sku: p.sku }, select: { id: true, _count: { select: { variants: true } } } });
    let productId: string;
    if (existing) { stats.prodUpdated++; productId = existing.id; await prisma.product.update({ where: { id: existing.id }, data }); }
    else { stats.prodCreated++; productId = p.id; await prisma.product.create({ data: { id: p.id, sku: p.sku, createdAt: new Date(p.createdAt), ...data } }); }
    // 변형은 기존 것이 없을 때만 삽입 (주문이 참조할 수 있으므로 지우지 않는다)
    if (!existing || existing._count.variants === 0) {
      for (const v of p.variants) {
        await prisma.productVariant.create({ data: { id: v.id, productId, optionType: v.optionType, name: v.name, colorHex: v.colorHex, stock: v.stock, priceModifier: v.priceModifier, sku: v.sku, thumbnail: v.thumbnail, sortOrder: v.sortOrder, isActive: v.isActive } });
        stats.variants++;
      }
    }
  }

  // 3) 채비도 / 기획전 — 슬러그 기준 upsert
  for (const r of d.rigs) {
    const { id, createdAt, updatedAt, viewCount, ...data } = r;
    await prisma.rigGuide.upsert({ where: { slug: r.slug }, create: { id, ...data }, update: data });
    stats.rigs++;
  }
  for (const pr of d.promotions) {
    const { id, createdAt, updatedAt, viewCount, ...data } = pr;
    const fixed = { ...data, startsAt: data.startsAt ? new Date(data.startsAt) : null, endsAt: data.endsAt ? new Date(data.endsAt) : null };
    await prisma.promotion.upsert({ where: { slug: pr.slug }, create: { id, ...fixed }, update: fixed });
    stats.promos++;
  }

  // 4) 사이트 설정 — 단일 행 갱신 (없으면 생성)
  if (d.siteSettings) {
    const { id, updatedAt, updatedBy, ...data } = d.siteSettings;
    const cur = await prisma.siteSettings.findFirst({ select: { id: true } });
    if (cur) await prisma.siteSettings.update({ where: { id: cur.id }, data });
    else await prisma.siteSettings.create({ data: { id, ...data } });
    stats.settings = 1;
  }
  console.log("import:", JSON.stringify(stats));
}

(async () => {
  if (mode === "export") await doExport(file || "scripts/migrate/out/catalog-export.json");
  else if (mode === "import") await doImport(file);
  else { console.error("usage: catalog-transfer.ts export|import <file>"); process.exit(2); }
})().finally(() => prisma.$disconnect());

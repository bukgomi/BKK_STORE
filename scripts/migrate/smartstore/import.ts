/**
 * 네이버 스마트스토어 상품 목록 CSV → DB 직접 반영 (엑셀 일괄등록 없이)
 *
 *   npx tsx scripts/migrate/smartstore/import.ts <Product_xxx.csv> [--dry-run] [--skip-images] [--stock 999] [--active-only]
 *   (Docker) docker compose exec app npx tsx scripts/migrate/smartstore/import.ts scripts/migrate/out/Product_xxx.csv
 *
 * - 분류: lib.ts 의 guessCategory (상품명 키워드 → 네이버 세분류 → uncategorized)
 * - 상품: sku(NS-<네이버상품번호>) 기준 upsert → 재실행해도 안전 (관리자에서 고친 값은 덮어써지므로 주의)
 * - 이미지: 네이버 대표이미지 URL 을 받아 src/lib/storage.ts 의 getStorage() 로 저장 (STORAGE_PROVIDER 에 따라 로컬/S3)
 *   이미 thumbnail 이 있는 상품은 다시 받지 않는다.
 * - 옵션값/상세설명은 스마트스토어 목록 내보내기에 없으므로 비워 둔다 → 관리자에서 채우기
 */
import { config } from "dotenv";
config();

import { readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { PrismaClient } from "@prisma/client";
import { getStorage } from "../../../src/lib/storage";
import { convertRow, type SmartStoreRow } from "./lib";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const file = process.argv[2];
if (!file || file.startsWith("--")) {
  console.error("사용법: tsx scripts/migrate/smartstore/import.ts <Product.csv> [--dry-run] [--skip-images] [--stock 999] [--active-only]");
  process.exit(1);
}
const DRY = process.argv.includes("--dry-run");
const SKIP_IMAGES = process.argv.includes("--skip-images");
const ACTIVE_ONLY = process.argv.includes("--active-only");
const stockCap = Number(arg("--stock", "999"));

const prisma = new PrismaClient();

async function fetchImage(url: string): Promise<{ buffer: Buffer; contentType: string; ext: string } | null> {
  if (!url) return null;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) throw new Error(`이미지 아님: ${contentType}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const extFromUrl = path.extname(new URL(url).pathname).toLowerCase();
  const ext = extFromUrl || ({ "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp" } as Record<string, string>)[contentType.split(";")[0]] || ".jpg";
  return { buffer, contentType, ext };
}

async function main() {
  const text = readFileSync(file).toString("utf8").replace(/^﻿/, "");
  const parsed = Papa.parse<SmartStoreRow>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) console.warn("CSV 경고:", parsed.errors.slice(0, 3));

  let products = parsed.data.filter((r) => (r["상품명"] || "").trim()).map((r) => convertRow(r, { stockCap }));
  if (ACTIVE_ONLY) products = products.filter((p) => p.isActive);
  console.log(`CSV 상품 ${products.length}개 (판매중 ${products.filter((p) => p.isActive).length})${DRY ? " — DRY RUN" : ""}`);

  // 1) 카테고리 slug → id
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catId = new Map(cats.map((c) => [c.slug, c.id]));
  if (!catId.has("uncategorized")) {
    if (DRY) console.warn("⚠ uncategorized 카테고리 없음 (실행 시 생성)");
    else {
      const row = await prisma.category.create({ data: { slug: "uncategorized", name: "미분류", sortOrder: 999 } });
      catId.set("uncategorized", row.id);
    }
  }
  const missingSlugs = new Set<string>();

  // 2) 상품
  const storage = SKIP_IMAGES ? null : getStorage();
  const byCat = new Map<string, number>();
  let created = 0, updated = 0, imgOk = 0, imgFail = 0, imgSkip = 0;

  for (const p of products) {
    let slug = p.categorySlug;
    if (!catId.has(slug)) { missingSlugs.add(slug); slug = "uncategorized"; }
    byCat.set(slug, (byCat.get(slug) || 0) + 1);

    const existing = await prisma.product.findUnique({ where: { sku: p.sku }, select: { id: true, thumbnail: true } });

    let thumbnail: string | null = existing?.thumbnail ?? null;
    if (storage && !thumbnail && p.naverImageUrl) {
      try {
        const img = await fetchImage(p.naverImageUrl);
        if (img) {
          if (DRY) { imgOk++; thumbnail = `(dry) ${p.naverImageUrl}`; }
          else {
            const up = await storage.upload({ buffer: img.buffer, filename: `${p.sku}${img.ext}`, contentType: img.contentType, prefix: "products/smartstore" });
            thumbnail = up.url; imgOk++;
          }
        }
      } catch (e: any) {
        imgFail++;
        console.warn(`  ⚠ 이미지 실패 [${p.sku}] ${p.name}: ${e.message}`);
      }
    } else if (thumbnail) imgSkip++;

    if (DRY) {
      console.log(`  ${existing ? "UPD" : "NEW"} ${p.sku} | ${slug.padEnd(15)} | ${String(p.price).padStart(6)} ${p.salePrice ? "→" + p.salePrice : ""} | 재고 ${p.stock} | ${p.isActive ? "판매중" : "중지"} | ${p.name}`);
      existing ? updated++ : created++;
      continue;
    }

    const data = {
      name: p.name,
      brand: p.brand || null,
      price: p.price,
      salePrice: p.salePrice,
      stock: p.stock,
      thumbnail,
      isActive: p.isActive,
      categoryId: catId.get(slug)!,
    };
    await prisma.product.upsert({
      where: { sku: p.sku },
      create: { sku: p.sku, ...data, images: [], isFeatured: false },
      update: data,
    });
    existing ? updated++ : created++;
  }

  console.log(`\n✔ 신규 ${created} · 갱신 ${updated}` + (SKIP_IMAGES ? " · 이미지 건너뜀" : ` · 이미지 저장 ${imgOk} / 기존유지 ${imgSkip} / 실패 ${imgFail}`));
  console.log("  분류 배정:", [...byCat].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}(${n})`).join(", "));
  if (missingSlugs.size) console.warn("  ⚠ DB 에 없는 카테고리 slug → 미분류 처리:", [...missingSlugs].join(", "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

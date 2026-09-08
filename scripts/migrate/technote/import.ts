/**
 * 2단계: 중간 JSON + 이미지 폴더 → 스토리지 업로드 + DB 반영
 *
 *   npx tsx scripts/migrate/technote/import.ts --json scripts/migrate/out/technote.json --images /path/to/data/tntshop1 [--overrides review.xlsx] [--dry-run] [--stock 999] [--only-active]
 *
 * - --overrides: export-review.ts 로 만든 엑셀을 사용자가 수정한 파일. 상품명/가격/노출/옵션 수정·삭제·추가가 JSON 값보다 우선
 * - 이미지: `--images` 폴더(FTP 로 받은 data/tntshop1) 에서 상대경로로 찾고, 없으면 파일명으로 폴더 전체 검색
 * - 스토리지: src/lib/storage.ts 의 getStorage() (STORAGE_PROVIDER 에 따라 로컬/S3)
 * - DB: Category(slug upsert) → Product(sku upsert) → ProductVariant(전체 교체). 재실행해도 안전
 * - --dry-run: 업로드/DB 쓰기 없이 매핑 결과·누락 이미지만 출력
 */
import { config } from "dotenv";
config();

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import type { ExportFile } from "./parse";
import { basenameOf } from "./lib";
import { applyOverrides } from "./overrides";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const DRY = process.argv.includes("--dry-run");
const ONLY_ACTIVE = process.argv.includes("--only-active");
const DEFAULT_STOCK = Number(arg("--stock", "999"));
const jsonPath = arg("--json", "scripts/migrate/out/technote.json")!;
const imagesDir = arg("--images");
const overridesPath = arg("--overrides");

/** 폴더 전체를 훑어 상대경로 → 절대경로, 파일명 → 절대경로 인덱스 */
function indexImages(root: string) {
  const byRel = new Map<string, string>();
  const byBase = new Map<string, string[]>();
  const walk = (dir: string) => {
    for (const ent of readdirSync(dir)) {
      const abs = path.join(dir, ent);
      if (statSync(abs).isDirectory()) { walk(abs); continue; }
      const rel = path.relative(root, abs).split(path.sep).join("/");
      byRel.set(rel.toLowerCase(), abs);
      (byBase.get(ent.toLowerCase()) || byBase.set(ent.toLowerCase(), []).get(ent.toLowerCase())!).push(abs);
    }
  };
  walk(root);
  return { byRel, byBase };
}

function contentTypeOf(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" } as Record<string, string>)[ext] || "application/octet-stream";
}

async function main() {
  const data = JSON.parse(readFileSync(jsonPath, "utf8")) as ExportFile;
  if (overridesPath) {
    const r = applyOverrides(data, XLSX.readFile(overridesPath));
    console.log(`수정 엑셀 반영: 상품 ${r.productsChanged}건, 옵션 수정 ${r.optionsChanged} / 삭제 ${r.optionsRemoved} / 추가 ${r.optionsAdded}`);
    if (r.unknownSkus.length) console.warn(`  ⚠ JSON 에 없는 상품코드 ${r.unknownSkus.length}개 무시: ${r.unknownSkus.slice(0, 10).join(", ")}`);
  }
  const products = ONLY_ACTIVE ? data.products.filter((p) => p.isActive) : data.products;
  console.log(`${DRY ? "[DRY-RUN] " : ""}분류 ${data.categories.length}개, 상품 ${products.length}개 (${data.source})`);

  // ── 이미지 인덱스
  const idx = imagesDir ? indexImages(imagesDir) : null;
  if (!idx) console.warn("⚠ --images 미지정: 이미지는 업로드하지 않고 상품만 반영합니다.");
  const resolveImage = (ref: string): string | null => {
    if (!idx) return null;
    return idx.byRel.get(ref.toLowerCase()) || idx.byBase.get(basenameOf(ref).toLowerCase())?.[0] || null;
  };

  // 누락 이미지 리포트 (dry-run 이든 아니든 먼저 보여줌)
  if (idx) {
    const missing: string[] = [];
    let found = 0;
    for (const p of products) for (const r of p.imageRefs) (resolveImage(r) ? found++ : missing.push(`[${p.sku}] ${r}`));
    console.log(`이미지: 찾음 ${found}, 누락 ${missing.length} (인덱싱된 파일 ${idx.byRel.size}개)`);
    for (const m of missing.slice(0, 20)) console.log("  - " + m);
    if (missing.length > 20) console.log(`  … 외 ${missing.length - 20}건`);
  }

  if (DRY) {
    const catTree = data.categories.filter((c) => !c.parentUid).map((c) => `${c.name}(${data.categories.filter((x) => x.parentUid === c.uid).length})`);
    console.log("분류:", catTree.join(", "));
    for (const p of products.slice(0, 5)) {
      console.log(`  ${p.sku} ${p.name} ${p.price.toLocaleString()}원 cat=${p.categoryUid} img=${p.imageRefs.length} var=${p.variants.length}${p.isActive ? "" : " [비활성]"}`);
    }
    console.log("dry-run 종료 — DB/스토리지 변경 없음");
    return;
  }

  // 실제 반영 (DB 접속은 여기서만)
  const { PrismaClient } = await import("@prisma/client");
  const { getStorage } = await import("../../../src/lib/storage");
  const prisma = new PrismaClient();
  const storage = getStorage();
  const uploaded = new Map<string, string>(); // 절대경로 → URL (같은 파일 재업로드 방지)

  const uploadRef = async (sku: string, ref: string): Promise<string | null> => {
    const abs = resolveImage(ref);
    if (!abs) return null;
    if (uploaded.has(abs)) return uploaded.get(abs)!;
    const buf = readFileSync(abs);
    const ext = path.extname(abs).toLowerCase() || ".jpg";
    const filename = `${sku.toLowerCase()}-${basenameOf(ref).replace(/[^a-z0-9_.-]/gi, "_").replace(/\.[^.]+$/, "")}${ext}`;
    const r = await storage.upload({ buffer: buf, filename, contentType: contentTypeOf(abs), prefix: "products/technote" });
    uploaded.set(abs, r.url);
    return r.url;
  };

  try {
    // 1) 분류 (부모 먼저)
    const catIdByUid = new Map<string, string>();
    for (const c of [...data.categories].sort((a, b) => a.uid.length - b.uid.length)) {
      const row = await prisma.category.upsert({
        where: { slug: c.slug },
        create: { slug: c.slug, name: c.name, sortOrder: c.sortOrder, parentId: c.parentUid ? catIdByUid.get(c.parentUid) ?? null : null },
        update: { name: c.name, sortOrder: c.sortOrder, parentId: c.parentUid ? catIdByUid.get(c.parentUid) ?? null : null },
      });
      catIdByUid.set(c.uid, row.id);
    }
    let fallbackCatId: string | null = null;
    const getFallbackCat = async () => {
      if (fallbackCatId) return fallbackCatId;
      const row = await prisma.category.upsert({ where: { slug: "uncategorized" }, create: { slug: "uncategorized", name: "미분류", sortOrder: 999 }, update: {} });
      return (fallbackCatId = row.id);
    };
    console.log(`✔ 분류 ${catIdByUid.size}개 반영`);

    // 2) 상품
    let done = 0, imgCount = 0;
    for (const p of products) {
      const categoryId = (p.categoryUid && catIdByUid.get(p.categoryUid)) || (await getFallbackCat());
      const urls: string[] = [];
      for (const ref of p.imageRefs) {
        const u = await uploadRef(p.sku, ref).catch((e) => { console.warn(`  ⚠ 업로드 실패 [${p.sku}] ${ref}: ${e.message}`); return null; });
        if (u && !urls.includes(u)) urls.push(u);
      }
      imgCount += urls.length;
      const thumbnail = urls[0] ?? null;
      const description = [p.description, p.youtube.length ? `동영상: ${p.youtube.join(" , ")}` : "", p.origin ? `원산지: ${p.origin}` : ""].filter(Boolean).join("\n\n");

      const productData = {
        name: p.name, brand: p.brand, description, price: p.price, salePrice: null,
        stock: DEFAULT_STOCK, thumbnail, images: urls.slice(1), isActive: p.isActive, isFeatured: p.isFeatured,
        categoryId,
      };
      const row = await prisma.product.upsert({
        where: { sku: p.sku },
        create: { sku: p.sku, createdAt: new Date(p.createdAt), ...productData },
        update: productData,
      });

      // 3) 옵션: 주문 이력이 없는 상태의 이관이므로 전체 교체
      await prisma.productVariant.deleteMany({ where: { productId: row.id } });
      if (p.variants.length) {
        await prisma.productVariant.createMany({
          data: p.variants.map((v) => ({
            productId: row.id, optionType: v.optionType, name: v.name.slice(0, 40),
            priceModifier: v.priceModifier, stock: v.inStock ? DEFAULT_STOCK : 0, sortOrder: v.sortOrder, isActive: true,
          })),
        });
      }
      done++;
      if (done % 20 === 0) console.log(`  … ${done}/${products.length}`);
    }
    console.log(`✔ 상품 ${done}개, 이미지 ${imgCount}개(고유 파일 ${uploaded.size}) 반영 완료`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

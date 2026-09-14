/**
 * 네이버 스마트스토어 "일괄등록 템플릿" 엑셀 → 옵션(ProductVariant) + 대표이미지 반영
 *
 *   npx tsx scripts/migrate/smartstore/import-options.ts <ExcelSaveTemplate.xlsx> [--images <대표이미지 폴더>] [--dry-run]
 *   (Docker) docker compose exec app npx tsx scripts/migrate/smartstore/import-options.ts scripts/migrate/out/options.xlsx --images scripts/migrate/out/images
 *
 * - 상품 매칭: 엑셀 '상품명' == Product.name (공백 정규화 후 비교). import.ts 로 먼저 상품이 들어가 있어야 한다.
 * - 옵션: '옵션명'(줄바꿈으로 그룹 구분) + '옵션값'(그룹별 줄바꿈, 값은 쉼표) 을 읽어
 *     · 그룹 1개 → 값 하나가 옵션 하나
 *     · 그룹 2개 이상(단독형) → 모든 조합을 "5g / 곰보형" 형태로 옵션 하나씩 생성 (우리 몰은 옵션이 1차원이라 조합으로 펼침)
 *   옵션가/옵션재고가 비어 있으면 추가금 0, 재고는 상품 재고를 그대로 사용.
 *   기존 옵션은 이름 기준 upsert, 엑셀에 없는 기존 옵션은 비활성 (관리자 일괄등록과 같은 규칙).
 * - 이미지: --images 폴더에 '대표이미지' 파일명이 있으면 storage 에 올려 thumbnail 교체 (네이버 CDN 축소본 → 원본)
 */
import { config } from "dotenv";
config();

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { getStorage } from "../../../src/lib/storage";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const file = process.argv[2];
if (!file || file.startsWith("--")) {
  console.error("사용법: tsx scripts/migrate/smartstore/import-options.ts <ExcelSaveTemplate.xlsx> [--images <폴더>] [--dry-run]");
  process.exit(1);
}
const DRY = process.argv.includes("--dry-run");
const imagesDir = arg("--images");

const prisma = new PrismaClient();
const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const splitLines = (s: unknown) => String(s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const splitComma = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** 옵션 제목 → optionType (src/app/api/admin/products/bulk/route.ts 와 동일 규칙) */
function optionTypeOf(title: string): string {
  const t = title.replace(/\s/g, "");
  if (/색상|컬러|색/.test(t)) return "color";
  if (/사이즈|크기|호수/.test(t)) return "size";
  if (/무게|oz|g$/i.test(t)) return "weight";
  return "option";
}

function contentTypeOf(f: string) {
  const ext = path.extname(f).toLowerCase();
  return ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" } as Record<string, string>)[ext] || "application/octet-stream";
}

type VariantIn = { name: string; optionType: string; priceModifier: number; stock: number | null };

function buildVariants(titlesRaw: unknown, valuesRaw: unknown, pricesRaw: unknown, stocksRaw: unknown): { variants: VariantIn[]; groups: string[] } {
  const titles = splitLines(titlesRaw);
  const groups = splitLines(valuesRaw).map(splitComma);
  if (!groups.length) return { variants: [], groups: [] };
  const prices = splitLines(pricesRaw).map(splitComma);
  const stocks = splitLines(stocksRaw).map(splitComma);

  if (groups.length === 1) {
    const type = optionTypeOf(titles[0] || "");
    return {
      groups: titles.length ? titles : ["옵션"],
      variants: groups[0].map((name, i) => ({
        name,
        optionType: type,
        priceModifier: Number(prices[0]?.[i] || 0) || 0,
        stock: stocks[0]?.[i] != null && stocks[0][i] !== "" ? Number(stocks[0][i]) : null,
      })),
    };
  }
  // 단독형 다중 그룹 → 조합 펼치기 (가격/재고는 단독형에 없으므로 0 / 상품재고)
  // optionType 에 "combo:무게|색상" 처럼 그룹 제목을 실어 두면 상품 페이지가 무게 → 색상 2단계 선택 UI 로 그린다.
  let combos: string[][] = [[]];
  for (const g of groups) combos = combos.flatMap((c) => g.map((v) => [...c, v]));
  const groupTitles = groups.map((_, i) => titles[i] || `옵션${i + 1}`);
  return {
    groups: groupTitles,
    variants: combos.map((c) => ({ name: c.join(" / "), optionType: `combo:${groupTitles.join("|")}`, priceModifier: 0, stock: null })),
  };
}

async function main() {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
  const H = (rows[1] || []).map((h: unknown) => norm(h));
  const col = (n: string) => H.indexOf(n);
  if (col("상품명") < 0 || col("옵션값") < 0) throw new Error("2행 헤더에서 상품명/옵션값 열을 찾지 못했습니다");
  const data = rows.slice(2).filter((r) => norm(r[col("상품명")]));
  console.log(`엑셀 상품 ${data.length}행${DRY ? " — DRY RUN" : ""}`);

  const products = await prisma.product.findMany({ select: { id: true, sku: true, name: true, stock: true, thumbnail: true } });
  const byName = new Map(products.map((p) => [norm(p.name), p]));
  const storage = imagesDir ? getStorage() : null;

  let matched = 0, variantsWritten = 0, deactivated = 0, imgDone = 0, imgMissing = 0;
  const unmatched: string[] = [];

  for (const r of data) {
    const name = norm(r[col("상품명")]);
    const p = byName.get(name);
    if (!p) { unmatched.push(name); continue; }
    matched++;

    const { variants, groups } = buildVariants(r[col("옵션명")], r[col("옵션값")], r[col("옵션가")], r[col("옵션 재고수량")]);
    const imgName = norm(r[col("대표이미지")]);
    const imgPath = imagesDir && imgName ? path.join(imagesDir, imgName) : null;
    const hasImg = !!imgPath && existsSync(imgPath);
    if (imgPath && !hasImg) imgMissing++;

    if (DRY) {
      console.log(`  ${p.sku} | ${name} | [${groups.join(" × ")}] ${variants.length}개 | ${hasImg ? "이미지 " + imgName : "이미지 없음"}`);
      if (variants.length) console.log(`      ${variants.slice(0, 6).map((v) => v.name).join(", ")}${variants.length > 6 ? ` … (+${variants.length - 6})` : ""}`);
      variantsWritten += variants.length;
      continue;
    }

    // 옵션 동기화
    if (variants.length) {
      const existing = await prisma.productVariant.findMany({ where: { productId: p.id } });
      const cur = new Map(existing.map((v) => [v.name, v]));
      const incoming = new Set<string>();
      for (const [i, v] of variants.entries()) {
        incoming.add(v.name);
        const payload = { optionType: v.optionType, priceModifier: v.priceModifier, stock: v.stock ?? p.stock, sortOrder: i, isActive: true };
        const ex = cur.get(v.name);
        if (ex) await prisma.productVariant.update({ where: { id: ex.id }, data: payload });
        else await prisma.productVariant.create({ data: { ...payload, name: v.name, productId: p.id } });
        variantsWritten++;
      }
      const stale = existing.filter((v) => !incoming.has(v.name) && v.isActive);
      if (stale.length) {
        await prisma.productVariant.updateMany({ where: { id: { in: stale.map((v) => v.id) } }, data: { isActive: false } });
        deactivated += stale.length;
      }
    }

    // 대표이미지 교체
    if (storage && hasImg && imgPath) {
      const up = await storage.upload({ buffer: readFileSync(imgPath), filename: `${p.sku}${path.extname(imgName).toLowerCase()}`, contentType: contentTypeOf(imgName), prefix: "products/smartstore" });
      if (up.url !== p.thumbnail) await prisma.product.update({ where: { id: p.id }, data: { thumbnail: up.url } });
      imgDone++;
    }
  }

  console.log(`\n✔ 상품 매칭 ${matched}/${data.length} · 옵션 ${variantsWritten}개 반영 · 기존 옵션 비활성 ${deactivated}` + (imagesDir ? ` · 이미지 교체 ${imgDone} (폴더에 없음 ${imgMissing})` : ""));
  if (unmatched.length) console.warn("  ⚠ DB 에 없는 상품명:", unmatched.join(" | "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

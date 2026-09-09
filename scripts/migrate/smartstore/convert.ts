/**
 * 네이버 스마트스토어 상품 목록 CSV → 낚시몰 "상품_일괄등록" 엑셀
 *
 *   npx tsx scripts/migrate/smartstore/convert.ts <Product_xxx.csv> [--out scripts/migrate/out/smartstore-bulk.xlsx] [--stock 999] [--active-only]
 *
 * 결과 엑셀은 관리자 → 상품 관리 → 일괄 등록에 그대로 올릴 수 있는 형식(상품등록 시트).
 * 옵션값과 이미지는 스마트스토어 목록 내보내기에 없으므로 비워 두고 '비고' 열에 표시한다.
 */
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { HEADER_DEFINITIONS, TEMPLATE_ORDER, type StandardKey } from "../../../src/lib/bulk-headers";
import { convertRow, type SmartStoreRow } from "./lib";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const file = process.argv[2];
if (!file || file.startsWith("--")) {
  console.error("사용법: tsx scripts/migrate/smartstore/convert.ts <Product.csv> [--out x.xlsx] [--stock 999] [--active-only]");
  process.exit(1);
}
const out = arg("--out", "scripts/migrate/out/smartstore-bulk.xlsx")!;
const stockCap = Number(arg("--stock", "999"));
const activeOnly = process.argv.includes("--active-only");

const raw = readFileSync(file);
const text = raw.toString("utf8").replace(/^﻿/, "");
const parsed = Papa.parse<SmartStoreRow>(text, { header: true, skipEmptyLines: true });
if (parsed.errors.length) console.warn("CSV 경고:", parsed.errors.slice(0, 3));

let products = parsed.data.filter((r) => (r["상품명"] || "").trim()).map((r) => convertRow(r, { stockCap }));
if (activeOnly) products = products.filter((p) => p.isActive);

// ── 시트1: 상품등록 (우리 템플릿 헤더 + 참고용 열 3개)
const headers = [...TEMPLATE_ORDER.map((k) => HEADER_DEFINITIONS[k].primaryKo), "모델명(참고)", "네이버상품번호(참고)", "네이버이미지URL(참고)", "비고"];
const rows = products.map((p) => {
  const cell: Record<StandardKey, string> = {
    sku: p.sku, name: p.name, brand: p.brand, categorySlug: p.categorySlug,
    price: String(p.price), salePrice: p.salePrice != null ? String(p.salePrice) : "", stock: String(p.stock), lowStockThreshold: "",
    thumbnail: "", images: "",
    optionTitle: "", options: "", optionPrices: "", optionStocks: "",
    description: "", isActive: p.isActive ? "Y" : "N", isFeatured: "N",
  };
  return [...TEMPLATE_ORDER.map((k) => cell[k]), p.modelName, p.naverProductNo, p.naverImageUrl, p.notes.join(" / ")];
});
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
ws["!cols"] = headers.map((h) => ({ wch: /상품명|비고|URL/.test(h) ? 36 : /옵션값|추가이미지/.test(h) ? 24 : 13 }));

// ── 시트2: 분류 배정 결과 (검토용)
const catRows = [["카테고리코드", "상품수", "배정 방식"]];
const byCat = new Map<string, { n: number; how: Set<string> }>();
for (const p of products) {
  const e = byCat.get(p.categorySlug) || { n: 0, how: new Set<string>() };
  e.n++; e.how.add(p.categoryGuess); byCat.set(p.categorySlug, e);
}
for (const [slug, e] of [...byCat].sort((a, b) => b[1].n - a[1].n)) catRows.push([slug, String(e.n), [...e.how].join(",")]);
const ws2 = XLSX.utils.aoa_to_sheet(catRows);
ws2["!cols"] = [{ wch: 20 }, { wch: 8 }, { wch: 24 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "상품등록");
XLSX.utils.book_append_sheet(wb, ws2, "분류배정");
mkdirSync(path.dirname(out), { recursive: true });
XLSX.writeFile(wb, out);

const active = products.filter((p) => p.isActive).length;
const withOpt = products.filter((p) => p.hasOptions).length;
const fallback = products.filter((p) => p.categoryGuess === "fallback").length;
console.log(`✔ ${out}`);
console.log(`  상품 ${products.length}개 (판매중 ${active}, 판매중지 ${products.length - active}) · 옵션 있음 ${withOpt} · 분류 미배정 ${fallback}`);
console.log(`  분류 배정:`, [...byCat].map(([s, e]) => `${s}(${e.n})`).join(", "));

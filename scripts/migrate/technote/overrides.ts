/**
 * 검토 엑셀(export-review.ts 산출물)을 사용자가 고친 뒤 → parse 결과에 덮어쓰기
 */
import * as XLSX from "xlsx";
import type { ExportFile, ExportProduct, ExportVariant } from "./parse";
import { optionTypeOf } from "./lib";

export const PRODUCT_HEADERS = {
  sku: "상품코드", legacyNo: "구번호", name: "상품명", price: "판매가", active: "노출",
  featured: "추천", brand: "브랜드", category: "분류", optionTitle: "옵션제목",
} as const;

export const OPTION_HEADERS = {
  sku: "상품코드", seq: "순번", title: "옵션제목", name: "옵션명", price: "추가금", inStock: "재고", remove: "삭제",
} as const;

type Cell = string | number | boolean | undefined | null;
type SheetRow = Record<string, Cell>;

const yn = (v: Cell, def: boolean) => {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "Y" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "FALSE" || s === "0") return false;
  return def;
};
const num = (v: Cell, def: number) => {
  if (v === undefined || v === null || String(v).trim() === "") return def;
  const n = Number(String(v).replace(/[,\s원]/g, ""));
  return Number.isFinite(n) ? n : def;
};
const str = (v: Cell) => String(v ?? "").trim();

export type OverrideResult = { productsChanged: number; optionsChanged: number; optionsRemoved: number; optionsAdded: number; unknownSkus: string[] };

/** 워크북(엑셀 파일 내용)을 읽어 data 를 제자리에서 수정 */
export function applyOverrides(data: ExportFile, wb: XLSX.WorkBook): OverrideResult {
  const bySku = new Map<string, ExportProduct>(data.products.map((p) => [p.sku, p]));
  const res: OverrideResult = { productsChanged: 0, optionsChanged: 0, optionsRemoved: 0, optionsAdded: 0, unknownSkus: [] };
  const unknown = new Set<string>();

  // ── 상품 시트
  const ps = wb.Sheets["상품"];
  if (ps) {
    for (const row of XLSX.utils.sheet_to_json<SheetRow>(ps, { defval: "" })) {
      const sku = str(row[PRODUCT_HEADERS.sku]);
      if (!sku) continue;
      const p = bySku.get(sku);
      if (!p) { unknown.add(sku); continue; }
      let changed = false;
      const name = str(row[PRODUCT_HEADERS.name]);
      if (name && name !== p.name) { p.name = name; changed = true; }
      const price = num(row[PRODUCT_HEADERS.price], p.price);
      if (price !== p.price) { p.price = price; changed = true; }
      const active = yn(row[PRODUCT_HEADERS.active], p.isActive);
      if (active !== p.isActive) { p.isActive = active; changed = true; }
      const featured = yn(row[PRODUCT_HEADERS.featured], p.isFeatured);
      if (featured !== p.isFeatured) { p.isFeatured = featured; changed = true; }
      const brand = str(row[PRODUCT_HEADERS.brand]);
      if (brand !== (p.brand || "")) { p.brand = brand || null; changed = true; }
      const title = str(row[PRODUCT_HEADERS.optionTitle]);
      if (title && title !== (p.optionTitle || "")) { p.optionTitle = title; changed = true; }
      if (changed) res.productsChanged++;
    }
  }

  // ── 옵션 시트: 상품별로 모아서 순번 기준 수정/삭제, 순번 없는 행은 추가
  const os = wb.Sheets["옵션"];
  if (os) {
    const grouped = new Map<string, SheetRow[]>();
    for (const row of XLSX.utils.sheet_to_json<SheetRow>(os, { defval: "" })) {
      const sku = str(row[OPTION_HEADERS.sku]);
      if (!sku) continue;
      if (!bySku.has(sku)) { unknown.add(sku); continue; }
      (grouped.get(sku) || grouped.set(sku, []).get(sku)!).push(row);
    }
    for (const [sku, rows] of grouped) {
      const p = bySku.get(sku)!;
      const next: ExportVariant[] = p.variants.map((v) => ({ ...v }));
      const removeIdx = new Set<number>();
      const additions: ExportVariant[] = [];
      for (const row of rows) {
        const seq = num(row[OPTION_HEADERS.seq], 0);
        const name = str(row[OPTION_HEADERS.name]);
        const remove = yn(row[OPTION_HEADERS.remove], false);
        const title = str(row[OPTION_HEADERS.title]);
        if (title && !p.optionTitle) p.optionTitle = title;
        const type = optionTypeOf(p.optionTitle || title || "");
        if (seq >= 1 && seq <= next.length) {
          const cur = next[seq - 1];
          if (remove) { removeIdx.add(seq - 1); res.optionsRemoved++; continue; }
          const price = num(row[OPTION_HEADERS.price], cur.priceModifier);
          const inStock = yn(row[OPTION_HEADERS.inStock], cur.inStock);
          if ((name && name !== cur.name) || price !== cur.priceModifier || inStock !== cur.inStock) {
            next[seq - 1] = { ...cur, name: name || cur.name, priceModifier: price, inStock, optionType: type };
            res.optionsChanged++;
          }
        } else if (name && !remove) {
          additions.push({ name, optionType: type, priceModifier: num(row[OPTION_HEADERS.price], 0), inStock: yn(row[OPTION_HEADERS.inStock], true), sortOrder: 0 });
          res.optionsAdded++;
        }
      }
      p.variants = [...next.filter((_, i) => !removeIdx.has(i)), ...additions].map((v, i) => ({ ...v, sortOrder: i }));
    }
  }

  res.unknownSkus = [...unknown];
  return res;
}

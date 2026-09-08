/**
 * 검토/수정용 엑셀 생성: parse.ts 결과 JSON → 상품/옵션 시트
 *
 *   npx tsx scripts/migrate/technote/export-review.ts [--json scripts/migrate/out/technote.json] [--out scripts/migrate/out/technote-review.xlsx]
 *
 * 사용자가 엑셀에서 옵션명·추가금·품절·삭제, 상품명·가격·노출을 고친 뒤
 * import.ts 에 --overrides <이 파일> 로 넘기면 수정값이 우선 적용된다.
 */
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import type { ExportFile } from "./parse";
import { PRODUCT_HEADERS, OPTION_HEADERS } from "./overrides";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const jsonPath = arg("--json", "scripts/migrate/out/technote.json")!;
const out = arg("--out", "scripts/migrate/out/technote-review.xlsx")!;
const data = JSON.parse(readFileSync(jsonPath, "utf8")) as ExportFile;
const catName = new Map(data.categories.map((c) => [c.uid, c.name]));
const catPath = (uid: string | null) => {
  if (!uid) return "";
  const c = data.categories.find((x) => x.uid === uid);
  return c?.parentUid ? `${catName.get(c.parentUid)} > ${c.name}` : (c?.name || "");
};

const wb = XLSX.utils.book_new();

// 시트1: 상품 — 수정 가능 열: 상품명, 판매가, 노출(Y/N), 브랜드
const products = data.products.map((p) => ({
  [PRODUCT_HEADERS.sku]: p.sku,
  [PRODUCT_HEADERS.legacyNo]: p.legacyNo,
  [PRODUCT_HEADERS.name]: p.name,
  [PRODUCT_HEADERS.price]: p.price,
  [PRODUCT_HEADERS.active]: p.isActive ? "Y" : "N",
  [PRODUCT_HEADERS.featured]: p.isFeatured ? "Y" : "N",
  [PRODUCT_HEADERS.brand]: p.brand || "",
  [PRODUCT_HEADERS.category]: catPath(p.categoryUid),
  [PRODUCT_HEADERS.optionTitle]: p.optionTitle || "",
  "옵션수": p.variants.length,
  "이미지수": p.imageRefs.length,
  "비고": p.warnings.join(" / "),
}));
const ws1 = XLSX.utils.json_to_sheet(products);
ws1["!cols"] = [8, 8, 34, 10, 6, 6, 16, 26, 12, 7, 8, 40].map((wch) => ({ wch }));
XLSX.utils.book_append_sheet(wb, ws1, "상품");

// 시트2: 옵션 — 한 줄 = 옵션값 하나. 수정 가능 열: 옵션명, 추가금, 재고(Y/N), 삭제(Y)
const options: Record<string, string | number>[] = [];
for (const p of data.products) {
  p.variants.forEach((v, i) => {
    options.push({
      [OPTION_HEADERS.sku]: p.sku,
      "상품명": p.name,
      [OPTION_HEADERS.seq]: i + 1,
      [OPTION_HEADERS.title]: p.optionTitle || "",
      [OPTION_HEADERS.name]: v.name,
      [OPTION_HEADERS.price]: v.priceModifier,
      [OPTION_HEADERS.inStock]: v.inStock ? "Y" : "N",
      [OPTION_HEADERS.remove]: "",
    });
  });
}
const ws2 = XLSX.utils.json_to_sheet(options);
ws2["!cols"] = [8, 30, 6, 12, 26, 8, 6, 6].map((wch) => ({ wch }));
XLSX.utils.book_append_sheet(wb, ws2, "옵션");

// 시트3: 안내
const guide = XLSX.utils.aoa_to_sheet([
  ["수정 방법"],
  ["상품 시트", "상품명 / 판매가 / 노출(Y,N) / 추천(Y,N) / 브랜드 열만 수정하세요. 상품코드는 바꾸지 마세요."],
  ["옵션 시트", "옵션명 / 추가금 / 재고(Y,N) 을 수정하고, 없앨 옵션은 삭제 열에 Y 를 적으세요."],
  ["옵션 추가", "옵션 시트 맨 아래에 상품코드·옵션명·추가금·재고를 채운 행을 추가하면 새 옵션으로 들어갑니다 (순번은 비워도 됨)."],
  ["옵션 전체 교체", "한 상품의 옵션을 통째로 바꾸려면 기존 행을 모두 삭제(Y) 하고 새 행을 추가하세요."],
  ["주의", "시트 이름과 열 제목은 바꾸지 마세요. 반영: npm run migrate:technote:import -- --overrides 이파일.xlsx"],
]);
guide["!cols"] = [{ wch: 14 }, { wch: 100 }];
XLSX.utils.book_append_sheet(wb, guide, "안내");

mkdirSync(path.dirname(out), { recursive: true });
XLSX.writeFile(wb, out);
console.log(`✔ ${out}  (상품 ${products.length}행, 옵션 ${options.length}행)`);

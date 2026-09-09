import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { applyOverrides, PRODUCT_HEADERS as P, OPTION_HEADERS as O } from "../../scripts/migrate/technote/overrides";
import type { ExportFile } from "../../scripts/migrate/technote/parse";

function sample(): ExportFile {
  return {
    source: "t.sql", generatedAt: "", shop: "shop1", categories: [], redirects: {}, stats: {},
    products: [{
      legacyNo: 1, sku: "TC-0001", name: "털스푼", brand: null, origin: null, price: 5000, description: "",
      categoryUid: "1312", isActive: true, isFeatured: false, createdAt: "", thumbnailRef: null, imageRefs: [],
      optionTitle: "색상", youtube: [], warnings: [],
      variants: [
        { name: "NO.001", optionType: "color", priceModifier: 0, inStock: true, sortOrder: 0 },
        { name: "NO:F321", optionType: "color", priceModifier: 0, inStock: true, sortOrder: 1 },
        { name: "NO.003", optionType: "color", priceModifier: 1000, inStock: true, sortOrder: 2 },
      ],
    }],
  };
}

function wbFrom(products: object[], options: object[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "상품");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(options), "옵션");
  return wb;
}

describe("applyOverrides", () => {
  it("상품명/가격/노출 수정", () => {
    const d = sample();
    const r = applyOverrides(d, wbFrom([{ [P.sku]: "TC-0001", [P.name]: "털스푼 금색", [P.price]: "6,000", [P.active]: "N" }], []));
    expect(r.productsChanged).toBe(1);
    expect(d.products[0].name).toBe("털스푼 금색");
    expect(d.products[0].price).toBe(6000);
    expect(d.products[0].isActive).toBe(false);
  });

  it("옵션명 수정, 삭제, 추가 후 순번 재정렬", () => {
    const d = sample();
    const r = applyOverrides(d, wbFrom([], [
      { [O.sku]: "TC-0001", [O.seq]: 2, [O.name]: "F321 (핑크)", [O.price]: 0, [O.inStock]: "N" },
      { [O.sku]: "TC-0001", [O.seq]: 3, [O.remove]: "Y" },
      { [O.sku]: "TC-0001", [O.seq]: "", [O.name]: "A390 (블루)", [O.price]: 500, [O.inStock]: "Y" },
    ]));
    expect(r).toMatchObject({ optionsChanged: 1, optionsRemoved: 1, optionsAdded: 1 });
    expect(d.products[0].variants.map((v) => v.name)).toEqual(["NO.001", "F321 (핑크)", "A390 (블루)"]);
    expect(d.products[0].variants[1].inStock).toBe(false);
    expect(d.products[0].variants[2]).toMatchObject({ priceModifier: 500, sortOrder: 2 });
  });

  it("빈 셀은 기존 값 유지, 모르는 상품코드는 보고", () => {
    const d = sample();
    const r = applyOverrides(d, wbFrom([{ [P.sku]: "TC-0001", [P.name]: "", [P.price]: "" }, { [P.sku]: "TC-9999", [P.name]: "x" }], []));
    expect(r.productsChanged).toBe(0);
    expect(d.products[0].price).toBe(5000);
    expect(r.unknownSkus).toEqual(["TC-9999"]);
  });
});

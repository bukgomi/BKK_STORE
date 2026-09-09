import { describe, it, expect } from "vitest";
import { normalizeHeader, normalizeRow, splitList, parseIntCell, parseOptionColumns, isImageUrl } from "@/lib/bulk-headers";

describe("bulk-headers", () => {
  it("한글/영문/별칭 헤더 인식", () => {
    expect(normalizeHeader("상품코드")).toBe("sku");
    expect(normalizeHeader("SKU")).toBe("sku");
    expect(normalizeHeader("옵션값")).toBe("options");
    expect(normalizeHeader("옵션추가금")).toBe("optionPrices");
    expect(normalizeHeader("대표이미지URL")).toBe("thumbnail"); // 구 템플릿 호환
    expect(normalizeHeader("모르는열")).toBeNull();
  });

  it("normalizeRow 는 모르는 열을 버리고 값은 문자열로", () => {
    const r = normalizeRow({ "상품코드": "TC-1", "판매가": 5000, "이상한열": "x" });
    expect(r).toEqual({ sku: "TC-1", price: "5000" });
  });

  it("splitList / parseIntCell", () => {
    expect(splitList(" a | b ||c ")).toEqual(["a", "b", "c"]);
    expect(parseIntCell("5,000원")).toBe(5000);
    expect(parseIntCell(" 12 ")).toBe(12);
    expect(parseIntCell("")).toBeNull();
    expect(parseIntCell("abc")).toBeNull();
    expect(parseIntCell("1.5")).toBeNull();
  });

  it("옵션 컬럼 → 옵션 목록 (추가금/재고 기본값 채움)", () => {
    const { variants, errors } = parseOptionColumns({ options: "금 5g | 금 7g | 금 9g", optionPrices: "0 | 1,000", optionStocks: "" }, 999);
    expect(errors).toEqual([]);
    expect(variants).toEqual([
      { name: "금 5g", priceModifier: 0, stock: 999 },
      { name: "금 7g", priceModifier: 1000, stock: 999 },
      { name: "금 9g", priceModifier: 0, stock: 999 },
    ]);
  });

  it("옵션 오류: 개수 초과, 중복, 잘못된 숫자", () => {
    const r = parseOptionColumns({ options: "A | A | B", optionPrices: "0|0|0|0", optionStocks: "x||" }, 10);
    expect(r.errors.some((e) => e.includes("옵션추가금 개수"))).toBe(true);
    expect(r.errors.some((e) => e.includes("중복"))).toBe(true);
    expect(r.errors.some((e) => e.includes("옵션재고 오류"))).toBe(true);
    expect(r.variants.map((v) => v.name)).toEqual(["A", "B"]);
  });

  it("옵션값이 비면 옵션 없음", () => {
    expect(parseOptionColumns({ options: "", optionPrices: "0" }, 5)).toEqual({ variants: [], errors: [] });
  });

  it("isImageUrl", () => {
    expect(isImageUrl("https://cdn.example.com/a.jpg")).toBe(true);
    expect(isImageUrl("/uploads/a.jpg")).toBe(true);
    expect(isImageUrl("spoon-gold.jpg")).toBe(false);
  });
});

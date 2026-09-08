import { describe, it, expect } from "vitest";
import { escapeHtml, calcDiscountRate } from "@/lib/utils";

describe("escapeHtml", () => {
  it("HTML 특수문자를 모두 이스케이프", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`))
      .toBe("&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });

  it("null/undefined 는 빈 문자열", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("일반 텍스트는 그대로", () => {
    expect(escapeHtml("안녕하세요 123")).toBe("안녕하세요 123");
  });
});

describe("calcDiscountRate", () => {
  it("할인율 반올림", () => {
    expect(calcDiscountRate(10000, 7500)).toBe(25);
    expect(calcDiscountRate(30000, 19900)).toBe(34);
  });

  it("할인가가 없거나 정가 이상이면 0", () => {
    expect(calcDiscountRate(10000, null)).toBe(0);
    expect(calcDiscountRate(10000, 10000)).toBe(0);
    expect(calcDiscountRate(10000, 12000)).toBe(0);
  });
});

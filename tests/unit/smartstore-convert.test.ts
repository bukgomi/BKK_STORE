import { describe, it, expect } from "vitest";
import { guessCategory, normalizeStock, convertRow } from "../../scripts/migrate/smartstore/lib";

describe("smartstore guessCategory", () => {
  it("상품명 키워드 우선", () => {
    expect(guessCategory("TPIAA 사라리플 새드 4인치", "기타 루어").slug).toBe("shad");
    expect(guessCategory("TPIAA 팁런 문어 3훅 3.5", "기타 루어").slug).toBe("egi");
    expect(guessCategory("TPIAA 채터베이트 1/2oz", "기타 루어").slug).toBe("buzzbait");
    expect(guessCategory("TPIAA 개구리 FG-F", "기타 루어").slug).toBe("frog");
    expect(guessCategory("TPIAA 지그헤드 1/8oz", "기타 루어").slug).toBe("jig-head");
    expect(guessCategory("TPIAA 슬로우 메탈 60g", "기타 루어").slug).toBe("metal-jig");
  });
  it("탑캐스팅 자체 모델명 규칙", () => {
    expect(guessCategory("TPIAA 사파이어 TCS 106", "기타 루어").slug).toBe("floating-minnow");
    expect(guessCategory("TPIAA 오로라 C 4인치", "기타 루어").slug).toBe("grub");
    expect(guessCategory("TPIAA- 칼라R17", "기타 루어").slug).toBe("shad");
    expect(guessCategory("TPIAA TCLL 17A3", "기타 루어").slug).toBe("metal-jig");
    expect(guessCategory("TPIAA- T-LINE(TD) 5인치", "기타 루어").slug).toBe("other-worm");
  });
  it("키워드 없으면 네이버 세분류, 그것도 없으면 fallback", () => {
    expect(guessCategory("TPIAA XYZ", "에기")).toEqual({ slug: "egi", how: "naver-category" });
    expect(guessCategory("TPIAA XYZ", "기타 루어")).toEqual({ slug: "uncategorized", how: "fallback" });
  });
});

describe("smartstore convertRow", () => {
  const base = {
    "상품번호(스마트스토어)": "13676923591", "판매자상품코드": "", "상품명": "TPIAA 진주 구슬 애기",
    "판매상태": "판매중", "전시상태": "전시중", "재고수량": "9999", "판매가": "3000", "할인가": "3000",
    "옵션": "Y", "추가상품": "N", "세분류": "에기", "제조사명": "탑케스팅", "브랜드명": "탑케스팅", "모델명": "",
    "대표이미지 URL": "http://shop1.phinf.naver.net/x.png",
  };
  it("기본 변환", () => {
    const p = convertRow(base);
    expect(p.sku).toBe("NS-13676923591");
    expect(p.brand).toBe("탑캐스팅(TPIAA)");
    expect(p.categorySlug).toBe("egi");
    expect(p.salePrice).toBeNull();
    expect(p.stock).toBe(999);
    expect(p.isActive).toBe(true);
    expect(p.notes[0]).toContain("옵션");
  });
  it("할인가 < 판매가 이면 salePrice, 판매중지면 비활성, 판매자코드 있으면 sku 로", () => {
    const p = convertRow({ ...base, "판매자상품코드": "TC-0009", "할인가": "2500", "판매상태": "판매중지" });
    expect(p.sku).toBe("TC-0009");
    expect(p.salePrice).toBe(2500);
    expect(p.isActive).toBe(false);
  });
  it("normalizeStock 상한", () => {
    expect(normalizeStock("719928")).toBe(999);
    expect(normalizeStock("300")).toBe(300);
    expect(normalizeStock("")).toBe(0);
  });
});

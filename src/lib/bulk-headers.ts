// 상품 일괄등록용 컬럼 헤더 매핑
// 한국형 쇼핑몰의 일반적인 일괄등록 패턴을 우리 자체 형식으로 정의합니다.
// 한글/영문 헤더 모두 인식하도록 별칭 테이블을 둡니다.

export type StandardKey =
  | "sku"
  | "name"
  | "brand"
  | "description"
  | "price"
  | "salePrice"
  | "stock"
  | "lowStockThreshold"
  | "categorySlug"
  | "thumbnail"
  | "images"
  | "optionTitle"
  | "options"
  | "optionPrices"
  | "optionStocks"
  | "isActive"
  | "isFeatured";

/** 한 표준키 = [기본 한글헤더, 영문 별칭, 한글 별칭들...] */
export const HEADER_DEFINITIONS: Record<StandardKey, {
  primaryKo: string;
  aliases: string[];
  required: boolean;
  description: string;
  example: string;
}> = {
  sku:               { primaryKo: "상품코드",          aliases: ["sku", "상품번호", "품번", "코드"],                    required: true,  description: "고유 상품번호. 같은 코드를 다시 올리면 수정됨", example: "TC-0001" },
  name:              { primaryKo: "상품명",            aliases: ["name", "제품명"],                                      required: true,  description: "상품 이름",                                  example: "TPIAA 털스푼 (금색)" },
  brand:             { primaryKo: "브랜드",            aliases: ["brand", "제조사"],                                     required: false, description: "브랜드명",                                   example: "탑캐스팅(TPIAA)" },
  categorySlug:      { primaryKo: "카테고리코드",      aliases: ["categorySlug", "카테고리", "분류코드", "카테고리슬러그"], required: true,  description: "[카테고리목록] 시트의 코드 값을 복사해 입력",  example: "spoon" },
  price:             { primaryKo: "판매가",            aliases: ["price", "정가", "가격"],                               required: true,  description: "원 단위 숫자 (쉼표 없이)",                   example: "5000" },
  salePrice:         { primaryKo: "할인가",            aliases: ["salePrice", "특가", "행사가"],                          required: false, description: "비워두면 할인 없음. 판매가보다 낮아야 함",  example: "" },
  stock:             { primaryKo: "재고수량",          aliases: ["stock", "재고", "수량"],                               required: true,  description: "옵션이 있으면 옵션재고가 우선. 넉넉하면 999",  example: "999" },
  lowStockThreshold: { primaryKo: "재고알림기준",      aliases: ["lowStockThreshold", "재고임계치", "알림기준"],          required: false, description: "비워두면 기본 설정값 사용",                example: "" },
  thumbnail:         { primaryKo: "대표이미지",        aliases: ["thumbnail", "대표이미지URL", "썸네일"],                required: false, description: "이미지 파일명(함께 선택한 폴더에서 찾음) 또는 URL", example: "spoon-gold.jpg" },
  images:            { primaryKo: "추가이미지",        aliases: ["images", "추가이미지URL", "상세이미지"],               required: false, description: "여러 개는 | 로 구분. 파일명 또는 URL",       example: "spoon-gold-2.jpg | spoon-gold-detail.jpg" },
  optionTitle:       { primaryKo: "옵션명",            aliases: ["optionTitle", "옵션제목", "옵션종류"],                 required: false, description: "옵션이 있을 때만. 예: 색상, 무게, 사이즈",   example: "색상/무게" },
  options:           { primaryKo: "옵션값",            aliases: ["options", "옵션", "옵션목록"],                          required: false, description: "여러 개는 | 로 구분",                        example: "금 5g | 금 7g | 금 9g" },
  optionPrices:      { primaryKo: "옵션추가금",        aliases: ["optionPrices", "옵션가격", "추가금"],                  required: false, description: "옵션값과 같은 순서로 | 구분. 비우면 전부 0", example: "0 | 0 | 1000" },
  optionStocks:      { primaryKo: "옵션재고",          aliases: ["optionStocks", "옵션수량"],                            required: false, description: "옵션값과 같은 순서로 | 구분. 비우면 재고수량 값 사용. 품절은 0", example: "999 | 999 | 0" },
  description:       { primaryKo: "상품상세설명",      aliases: ["description", "상세설명", "설명"],                     required: false, description: "줄바꿈 가능 (엑셀에서 Alt+Enter)",          example: "얕은 수심 배스·쏘가리용 털스푼" },
  isActive:          { primaryKo: "판매여부",          aliases: ["isActive", "노출여부", "판매상태"],                    required: false, description: "Y/N (기본 Y)",                              example: "Y" },
  isFeatured:        { primaryKo: "추천상품",          aliases: ["isFeatured", "메인노출", "추천"],                      required: false, description: "Y/N (기본 N) — 메인 추천 영역 노출",         example: "N" },
};

/** 헤더 문자열을 표준키로 변환 */
export function normalizeHeader(header: string): StandardKey | null {
  const h = (header || "").trim().toLowerCase();
  if (!h) return null;
  for (const [key, def] of Object.entries(HEADER_DEFINITIONS) as [StandardKey, typeof HEADER_DEFINITIONS[StandardKey]][]) {
    if (def.primaryKo.toLowerCase() === h) return key;
    if (key.toLowerCase() === h) return key;
    if (def.aliases.some((a) => a.toLowerCase() === h)) return key;
  }
  return null;
}

/** 행 객체의 키를 표준키로 정규화 */
export function normalizeRow(raw: Record<string, any>): Record<StandardKey, string> {
  const out = {} as Record<StandardKey, string>;
  for (const [k, v] of Object.entries(raw)) {
    const std = normalizeHeader(k);
    if (std) out[std] = v == null ? "" : String(v);
  }
  return out;
}

/** 템플릿용 헤더 순서 */
export const TEMPLATE_ORDER: StandardKey[] = [
  "sku", "name", "brand", "categorySlug",
  "price", "salePrice", "stock",
  "thumbnail", "images",
  "optionTitle", "options", "optionPrices", "optionStocks",
  "description", "isActive", "isFeatured", "lowStockThreshold",
];

/** `|` 구분 목록 (빈 항목 제거) */
export function splitList(v: string | undefined | null): string[] {
  return (v ?? "").split("|").map((s) => s.trim()).filter(Boolean);
}

/** 숫자 셀 ("5,000", "5000원", " 5000 ") → 정수. 실패하면 null */
export function parseIntCell(v: string | undefined | null): number | null {
  const s = (v ?? "").toString().replace(/[,\s원]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

export type ParsedVariant = { name: string; priceModifier: number; stock: number };

/**
 * 옵션 컬럼 3개 → 옵션 목록.
 * - 옵션값이 비면 옵션 없음
 * - 추가금/재고는 옵션값과 같은 순서. 짧으면 나머지는 기본값(0 / defaultStock), 길면 오류
 */
export function parseOptionColumns(
  row: { options?: string; optionPrices?: string; optionStocks?: string },
  defaultStock: number,
): { variants: ParsedVariant[]; errors: string[] } {
  const names = splitList(row.options);
  const errors: string[] = [];
  if (names.length === 0) return { variants: [], errors };

  const prices = (row.optionPrices ?? "").trim() ? (row.optionPrices ?? "").split("|").map((s) => s.trim()) : [];
  const stocks = (row.optionStocks ?? "").trim() ? (row.optionStocks ?? "").split("|").map((s) => s.trim()) : [];
  if (prices.length > names.length) errors.push(`옵션추가금 개수(${prices.length})가 옵션값(${names.length})보다 많음`);
  if (stocks.length > names.length) errors.push(`옵션재고 개수(${stocks.length})가 옵션값(${names.length})보다 많음`);

  const seen = new Set<string>();
  const variants: ParsedVariant[] = [];
  names.forEach((name, i) => {
    if (seen.has(name)) { errors.push(`옵션값 중복: ${name}`); return; }
    seen.add(name);
    const p = prices[i] === undefined || prices[i] === "" ? 0 : parseIntCell(prices[i]);
    const s = stocks[i] === undefined || stocks[i] === "" ? defaultStock : parseIntCell(stocks[i]);
    if (p === null) errors.push(`옵션추가금 오류: "${prices[i]}"`);
    if (s === null || s < 0) errors.push(`옵션재고 오류: "${stocks[i]}"`);
    variants.push({ name: name.slice(0, 40), priceModifier: p ?? 0, stock: s ?? defaultStock });
  });
  return { variants, errors };
}

/** 이미지 셀 값이 URL/경로인지(그대로 사용) 파일명인지(폴더에서 찾아 업로드) */
export function isImageUrl(v: string): boolean {
  return /^(https?:\/\/|\/|data:)/i.test(v.trim());
}

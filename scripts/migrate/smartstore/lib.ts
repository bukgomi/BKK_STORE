/**
 * 네이버 스마트스토어 "상품 목록 엑셀(CSV)" → 낚시몰 일괄등록 템플릿 변환 — 순수 함수
 *
 * 스마트스토어 목록 내보내기에는 옵션 값·상세설명이 없고 대표이미지 URL 은 네이버 CDN(외부 403)이라,
 * 상품명/가격/재고/판매상태/브랜드/모델명만 옮기고 옵션·이미지는 관리자에서 채우는 전제.
 */

export type SmartStoreRow = Record<string, string>;

export type ConvertedProduct = {
  sku: string;
  name: string;
  brand: string;
  categorySlug: string;
  categoryGuess: "keyword" | "naver-category" | "fallback";
  price: number;
  salePrice: number | null;
  stock: number;
  isActive: boolean;
  modelName: string;
  hasOptions: boolean;
  naverProductNo: string;
  naverImageUrl: string;
  notes: string[];
};

/** 상품명 키워드 → 우리 카테고리 slug (앞에 있는 규칙이 우선) */
export const KEYWORD_RULES: Array<[RegExp, string]> = [
  [/지그\s*헤드|지그헤드/i, "jig-head"],
  [/스피너\s*베이트|스피너베이트/i, "spinnerbait"],
  [/버즈\s*베이트|채터\s*베이트|채터베이트/i, "buzzbait"],
  [/타이라바/i, "tairaba"],
  [/메탈|지그(?!헤드)/i, "metal-jig"],
  [/스푼/i, "spoon"],
  [/에기|애기|팁런/i, "egi"],
  [/개구리|프로그/i, "frog"],
  [/바이브/i, "vibe"],
  [/크랭크/i, "crank"],
  [/미노우/i, "floating-minnow"],
  // 탑캐스팅 자체 모델명 (테크노트 DB 분류 기준): 오로라C=글럽, 칼라R=새드, TCLL=메탈, 사파이어/TCS=미노우
  [/오로라\s*C/i, "grub"],
  [/칼라\s*R\s*\d/i, "shad"],
  [/TCLL/i, "metal-jig"],
  [/사파이어|TCS\s*\d/i, "floating-minnow"],
  [/T-?LINE/i, "other-worm"],
  [/새드|섀드|쉐드/i, "shad"],
  [/호그/i, "hog"],
  [/더블\s*링거|더블링거/i, "double-ringer"],
  [/글럽|그럽|그럽/i, "grub"],
  [/테일/i, "tail"],
  [/웜/i, "other-worm"],
  [/바늘|훅(?!셋)/i, "hook"],
  [/싱커|봉돌/i, "sinker"],
  [/라인|합사|목줄/i, "line"],
  [/로드|낚시대|낚싯대/i, "rod"],
];

/** 네이버 세분류 → 우리 slug (키워드로 못 잡았을 때) */
export const NAVER_CATEGORY_MAP: Record<string, string> = {
  "에기": "egi", "웜": "other-worm", "메탈지그": "metal-jig", "타이라바": "tairaba",
  "미노우": "floating-minnow", "스푼": "spoon", "지그헤드": "jig-head", "스피너베이트": "spinnerbait",
  "기타낚시용품": "other-gear",
};

export const FALLBACK_SLUG = "uncategorized";

export function guessCategory(name: string, naverLeaf: string): { slug: string; how: ConvertedProduct["categoryGuess"] } {
  for (const [re, slug] of KEYWORD_RULES) if (re.test(name)) return { slug, how: "keyword" };
  const m = NAVER_CATEGORY_MAP[(naverLeaf || "").trim()];
  if (m) return { slug: m, how: "naver-category" };
  return { slug: FALLBACK_SLUG, how: "fallback" };
}

export function normalizeBrand(v: string): string {
  const t = (v || "").trim();
  if (!t) return "";
  if (/탑[케캐]스팅|TPIAA/i.test(t)) return "탑캐스팅(TPIAA)";
  return t;
}

/** 스마트스토어 재고는 9999/99999/719928 처럼 "무제한" 의미 → 상한으로 자름 */
export function normalizeStock(v: string, cap = 999): number {
  const n = Number(String(v || "").replace(/[^0-9]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, cap);
}

export function convertRow(r: SmartStoreRow, opts?: { stockCap?: number }): ConvertedProduct {
  const name = (r["상품명"] || "").trim();
  const naverNo = (r["상품번호(스마트스토어)"] || "").trim();
  const sellerCode = (r["판매자상품코드"] || "").trim();
  const price = Number(r["판매가"] || 0);
  const discount = Number(r["할인가"] || 0);
  const salePrice = discount > 0 && discount < price ? discount : null;
  const isActive = (r["판매상태"] || "").trim() === "판매중" && (r["전시상태"] || "").trim() === "전시중";
  const hasOptions = (r["옵션"] || "").trim().toUpperCase() === "Y";
  const cat = guessCategory(name, r["세분류"] || "");
  const notes: string[] = [];
  if (hasOptions) notes.push("네이버에 옵션 있음 — 옵션값 입력 필요");
  if (cat.how === "fallback") notes.push("분류 자동배정 실패 — 카테고리코드 확인");
  if ((r["추가상품"] || "").trim().toUpperCase() === "Y") notes.push("네이버 추가상품 있음 (별도 상품으로 등록 검토)");
  return {
    sku: sellerCode || `NS-${naverNo}`,
    name,
    brand: normalizeBrand(r["브랜드명"] || r["제조사명"] || ""),
    categorySlug: cat.slug,
    categoryGuess: cat.how,
    price,
    salePrice,
    stock: normalizeStock(r["재고수량"] || "", opts?.stockCap ?? 999),
    isActive,
    modelName: (r["모델명"] || "").trim(),
    hasOptions,
    naverProductNo: naverNo,
    naverImageUrl: (r["대표이미지 URL"] || "").trim(),
    notes,
  };
}

import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache";

/**
 * 네이버 쇼핑 EP (Enrichment Product) 피드 생성기
 *
 * 형식: TSV (탭 구분, UTF-8 BOM 권장)
 * 인코딩: UTF-8 (한글 텍스트 안정성)
 * 줄바꿈: \r\n (Windows 호환, 네이버 권장)
 *
 * 운영 등록 절차:
 * 1) 네이버 쇼핑 파트너센터(https://adcenter.shopping.naver.com) 가입
 * 2) "EP 등록" → 본 엔드포인트 URL 입력 (예: https://your-site.com/api/feed/naver)
 * 3) 갱신 주기 설정 (4시간/일/주 단위)
 * 4) 카테고리 매칭 → 매출 30~50% 상승 가능
 *
 * 필드 정의 참고: 네이버 쇼핑 파트너센터 EP 가이드 문서
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const SITE_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";
const DEFAULT_DELIVERY_FEE = parseInt(process.env.NAVER_FEED_DEFAULT_DELIVERY_FEE || "3000", 10);
const FREE_SHIPPING_THRESHOLD = parseInt(process.env.NAVER_FEED_FREE_SHIPPING_THRESHOLD || "30000", 10);
const DEFAULT_NAVER_CATEGORY = process.env.NAVER_FEED_DEFAULT_CATEGORY || ""; // 네이버 쇼핑 카테고리 ID

/**
 * 네이버 EP 표준 컬럼 (영문 키, 헤더는 영문 그대로 사용)
 */
export const FEED_COLUMNS = [
  "id",                 // 고유 상품 ID
  "title",              // 상품명
  "price_pc",           // PC 판매가 (원)
  "price_mobile",       // 모바일 판매가
  "link",               // 상품 상세 URL
  "image_link",         // 대표 이미지 URL (HTTPS)
  "add_image_link",     // 추가 이미지 (| 구분, 최대 9개)
  "category_name1",     // 1depth 카테고리명
  "category_name2",
  "category_name3",
  "category_name4",
  "naver_category",     // 네이버 쇼핑 카테고리 ID (있으면 매칭률 ↑)
  "maker",              // 제조사
  "brand",              // 브랜드
  "model_name",         // 모델명
  "delivery_fee",       // 배송비 (0 = 무료)
  "delivery_grp_cd",    // 배송 그룹 코드 (선택)
  "product_type",       // 1: 일반, 2: 도서, 3: 디지털콘텐츠
  "condition",          // NEW | USED | REFURBISHED
  "tag",                // 검색 태그 (| 구분)
  "imp_keyword",        // 광고용 노출 키워드 (선택)
  "stock_quantity",     // 재고
  "review_count",       // 리뷰 수 (실측치 노출시 신뢰도 ↑)
  "average_review_score", // 평균 평점 (1~5)
  "include_naver_pay",  // Y | N (네이버페이 사용 여부)
] as const;

type Column = (typeof FEED_COLUMNS)[number];

export type FeedRow = Record<Column, string>;

/**
 * 1행 데이터 escape
 * - 탭/줄바꿈/<,>,&,"' 제거 또는 치환
 * - 빈 값은 빈 문자열로 통일
 */
function sanitize(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // 탭/CR/LF 는 EP 포맷 깨짐 → 공백으로
  s = s.replace(/[\t\r\n]/g, " ");
  // HTML 태그 제거 (description 등)
  s = s.replace(/<[^>]*>/g, "");
  // 연속 공백 정리
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** 절대 URL 보장 */
function absoluteUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

export type FeedStats = {
  total: number;
  active: number;
  excluded: number;          // 노출 제외된 수
  generatedAt: Date;
  bytes: number;
};

type GenerateOptions = {
  /** 노출 제외 정책: 재고 0인 상품도 포함시킬지 */
  includeOutOfStock?: boolean;
  /** 한 번에 처리할 상품 수 상한 (안전장치) */
  limit?: number;
};

/**
 * 전체 활성 상품 → EP TSV 문자열 생성
 */
export async function generateNaverFeed(opts: GenerateOptions = {}): Promise<{ tsv: string; stats: FeedStats }> {
  const includeOos = opts.includeOutOfStock ?? false;
  const limit = opts.limit ?? 50000; // 네이버 EP 권장 상한

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: { include: { parent: { include: { parent: true } } } },
      variants: { where: { isActive: true } },
      _count: { select: { reviews: { where: { isHidden: false } } } },
      reviews: { where: { isHidden: false }, select: { rating: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  let active = 0, excluded = 0;
  const rows: FeedRow[] = [];

  for (const p of products) {
    const totalStock = p.variants.length > 0
      ? p.variants.reduce((s, v) => s + v.stock, 0)
      : p.stock;

    // 재고 0 + includeOutOfStock=false 면 제외
    if (totalStock <= 0 && !includeOos) {
      excluded++;
      continue;
    }
    // 가격이 0이면 제외 (네이버 등록 거부됨)
    if (p.price <= 0) { excluded++; continue; }

    const finalPrice = p.salePrice ?? p.price;

    // 카테고리 1~4 depth 분해 (현재 스키마는 2 depth지만 안전하게 처리)
    const cats: string[] = [];
    let cat: any = p.category;
    while (cat && cats.length < 4) {
      cats.unshift(cat.name);
      cat = cat.parent;
    }

    // 평점 집계
    const reviewCount = p._count.reviews;
    const avgRating = reviewCount > 0
      ? (p.reviews.reduce((s, r) => s + r.rating, 0) / reviewCount)
      : 0;

    // 추가 이미지 (대표 제외, 최대 9개)
    const addImages = (p.images || [])
      .slice(0, 9)
      .map(absoluteUrl)
      .filter(Boolean)
      .join("|");

    // 무료배송 임계 충족시 0
    const deliveryFee = finalPrice >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_DELIVERY_FEE;

    // 검색 태그 (브랜드 + 카테고리)
    const tags = [p.brand, ...cats].filter(Boolean).join("|");

    const row: FeedRow = {
      id:                    p.sku || p.id,
      title:                 sanitize(p.name),
      price_pc:              String(finalPrice),
      price_mobile:          String(finalPrice),
      link:                  `${SITE.replace(/\/$/, "")}/products/${p.id}`,
      image_link:            absoluteUrl(p.thumbnail),
      add_image_link:        addImages,
      category_name1:        sanitize(cats[0] || ""),
      category_name2:        sanitize(cats[1] || ""),
      category_name3:        sanitize(cats[2] || ""),
      category_name4:        sanitize(cats[3] || ""),
      naver_category:        DEFAULT_NAVER_CATEGORY,
      maker:                 sanitize(p.brand || ""),
      brand:                 sanitize(p.brand || ""),
      model_name:            sanitize(p.sku),
      delivery_fee:          String(deliveryFee),
      delivery_grp_cd:       "",
      product_type:          "1",
      condition:             "NEW",
      tag:                   sanitize(tags),
      imp_keyword:           "",
      stock_quantity:        String(totalStock),
      review_count:          String(reviewCount),
      average_review_score:  reviewCount > 0 ? avgRating.toFixed(1) : "",
      include_naver_pay:     "Y",
    };
    rows.push(row);
    active++;
  }

  // TSV 직렬화 (\r\n 권장)
  const headerLine = FEED_COLUMNS.join("\t");
  const dataLines = rows.map((r) => FEED_COLUMNS.map((c) => r[c]).join("\t"));
  const tsv = "﻿" + [headerLine, ...dataLines].join("\r\n") + "\r\n";

  return {
    tsv,
    stats: {
      total: products.length,
      active,
      excluded,
      generatedAt: new Date(),
      bytes: Buffer.byteLength(tsv, "utf-8"),
    },
  };
}

/**
 * Redis 기반 5분 캐시 (Redis 미설정시 인메모리 폴백)
 */
const CACHE_KEY = "feed:naver:v1";
const CACHE_TTL_SEC = 5 * 60;

export async function getCachedNaverFeed(force = false) {
  if (!force) {
    const cached = await cacheGet<{ tsv: string; stats: FeedStats }>(CACHE_KEY);
    if (cached) {
      // stats.generatedAt 직렬화 후 복원
      cached.stats.generatedAt = new Date(cached.stats.generatedAt as any);
      return cached;
    }
  }
  const { tsv, stats } = await generateNaverFeed();
  const payload = { tsv, stats };
  await cacheSet(CACHE_KEY, payload, CACHE_TTL_SEC);
  return payload;
}

export async function invalidateNaverFeedCache() {
  await cacheDel(CACHE_KEY);
}

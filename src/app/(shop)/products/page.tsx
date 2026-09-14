import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";
import type { Prisma } from "@prisma/client";
import ProductFilters from "./ProductFilters";
import ActiveFilterChips from "./ActiveFilterChips";
import MobileFilterButton from "./MobileFilterButton";
import SortSelectMobile from "./SortSelectMobile";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: "new",     label: "신상품순" },
  { value: "best",    label: "인기순" },
  { value: "rating",  label: "평점순" },
  { value: "reviews", label: "리뷰많은순" },
  { value: "low",     label: "낮은가격순" },
  { value: "high",    label: "높은가격순" },
];

const PRICE_RANGES = [
  { label: "1만원 이하",   min: 0,      max: 10000 },
  { label: "1~3만원",      min: 10000,  max: 30000 },
  { label: "3~5만원",      min: 30000,  max: 50000 },
  { label: "5~10만원",     min: 50000,  max: 100000 },
  { label: "10~30만원",    min: 100000, max: 300000 },
  { label: "30만원 이상",  min: 300000, max: 99999999 },
];

const RATING_OPTIONS = [
  { value: "4", label: "★ 4점 이상" },
  { value: "3", label: "★ 3점 이상" },
];

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const q         = (searchParams.q as string) || "";
  const category  = (searchParams.category as string) || "";
  const sort      = (searchParams.sort as string) || "new";
  const sale      = searchParams.sale === "1";
  const inStock   = searchParams.instock === "1";
  const minPrice  = parseInt((searchParams.min as string) || "", 10);
  const maxPrice  = parseInt((searchParams.max as string) || "", 10);
  const brands    = (Array.isArray(searchParams.brand) ? searchParams.brand : (searchParams.brand ? [searchParams.brand as string] : [])) as string[];
  const minRating = parseInt((searchParams.rating as string) || "", 10);
  const page      = Math.max(1, parseInt((searchParams.page as string) || "1", 10));

  // Where 절
  const where: Prisma.ProductWhereInput = { isActive: true };
  if (q) where.OR = [
    { name:  { contains: q, mode: "insensitive" } },
    { brand: { contains: q, mode: "insensitive" } },
    { sku:   { contains: q, mode: "insensitive" } },
  ];
  // 상위 카테고리 slug 면 그 하위 카테고리의 상품까지 포함
  if (category) where.category = { OR: [{ slug: category }, { parent: { slug: category } }] };
  if (sale) where.salePrice = { not: null };
  if (inStock) where.OR = [{ stock: { gt: 0 } }, { variants: { some: { stock: { gt: 0 } } } }];
  if (Number.isFinite(minPrice) && minPrice >= 0) where.price = { ...(where.price as object || {}), gte: minPrice };
  if (Number.isFinite(maxPrice) && maxPrice >= 0) where.price = { ...(where.price as object || {}), lte: maxPrice };
  if (brands.length > 0) where.brand = { in: brands };

  let ratingProductIds: string[] | null = null;
  if (Number.isFinite(minRating) && minRating > 0) {
    const rated = await prisma.review.groupBy({
      by: ["productId"],
      where: { isHidden: false },
      _avg: { rating: true },
      having: { rating: { _avg: { gte: minRating } } },
    }).catch(() => []);
    ratingProductIds = rated.map((r) => r.productId);
    if (ratingProductIds.length === 0) ratingProductIds = ["__none__"];
    where.id = { in: ratingProductIds };
  }

  // 정렬
  let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] = { createdAt: "desc" };
  if (sort === "low")     orderBy = [{ salePrice: "asc" }, { price: "asc" }];
  else if (sort === "high") orderBy = [{ salePrice: "desc" }, { price: "desc" }];
  else if (sort === "best") orderBy = [{ isFeatured: "desc" }, { createdAt: "desc" }];
  else if (sort === "rating" || sort === "reviews") orderBy = { reviews: { _count: "desc" } };

  const [items, total, categories, brandList] = await Promise.all([
    prisma.product.findMany({
      where, orderBy, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE,
      include: {
        _count: { select: { reviews: { where: { isHidden: false } } } },
        reviews: { where: { isHidden: false }, select: { rating: true } },
      },
    }).catch(() => []),
    prisma.product.count({ where }).catch(() => 0),
    prisma.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, include: { children: { orderBy: { sortOrder: "asc" } } } }).catch(() => []),
    prisma.product.findMany({
      where: { isActive: true, brand: { not: null }, ...(category ? { category: { OR: [{ slug: category }, { parent: { slug: category } }] } } : {}) },
      select: { brand: true },
      distinct: ["brand"],
      take: 50,
    }).catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allCategories = categories.flatMap((c) => [c, ...c.children.map((ch) => ({ ...ch, children: [] as typeof c.children }))]);
  const currentCategoryName = allCategories.find((c) => c.slug === category)?.name;
  // 사이드바에서 펼쳐 보여줄 상위 카테고리 (선택된 것이 하위면 그 부모)
  const openTopSlug = categories.find((c) => c.slug === category || c.children.some((ch) => ch.slug === category))?.slug;
  const availableBrands = brandList.map((b) => b.brand).filter(Boolean) as string[];

  let displayItems = items.map((p) => {
    const sum = p.reviews.reduce((s, r) => s + r.rating, 0);
    const avg = p.reviews.length > 0 ? sum / p.reviews.length : 0;
    return { ...p, _avgRating: Math.round(avg * 10) / 10, _reviewCount: p._count.reviews };
  });
  if (sort === "rating") {
    displayItems = displayItems.sort((a, b) => b._avgRating - a._avgRating);
  }

  // ===== 활성 필터 칩 =====
  const chips: { key: string; value?: string; label: string }[] = [];
  if (currentCategoryName) chips.push({ key: "category", label: `카테고리: ${currentCategoryName}` });
  if (sale) chips.push({ key: "sale", label: "할인 상품만" });
  if (inStock) chips.push({ key: "instock", label: "재고 있음만" });
  if (Number.isFinite(minPrice) && minPrice >= 0) chips.push({ key: "min", label: `${minPrice.toLocaleString()}원~` });
  if (Number.isFinite(maxPrice) && maxPrice >= 0) chips.push({ key: "max", label: `~${maxPrice.toLocaleString()}원` });
  brands.forEach((b) => chips.push({ key: "brand", value: b, label: `브랜드: ${b}` }));
  if (Number.isFinite(minRating) && minRating > 0) chips.push({ key: "rating", label: `★ ${minRating}점 이상` });

  // 사이드바 콘텐츠 (데스크톱/모바일에서 모두 사용)
  const sidebar = (
    <>
      <FilterBox title="카테고리">
        <ul className="space-y-1.5 text-sm">
          <li>
            <Link href="/products" className={!category ? "text-brand-600 font-semibold" : "text-gray-700 hover:text-brand-600"}>
              전체
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/products?category=${c.slug}`}
                className={category === c.slug ? "text-brand-600 font-semibold" : "text-gray-700 hover:text-brand-600"}
              >
                {c.name}
              </Link>
              {/* 선택된 상위 카테고리는 하위 목록을 펼쳐서 다른 하위로 바로 이동 */}
              {openTopSlug === c.slug && c.children.length > 0 && (
                <ul className="mt-1 mb-1 ml-3 pl-2 border-l border-gray-200 space-y-1">
                  {c.children.map((ch) => (
                    <li key={ch.id}>
                      <Link
                        href={`/products?category=${ch.slug}`}
                        className={`text-[13px] ${category === ch.slug ? "text-brand-600 font-semibold" : "text-gray-600 hover:text-brand-600"}`}
                      >
                        {ch.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </FilterBox>

      <FilterBox title="가격대">
        <ProductFilters
          kind="price"
          options={PRICE_RANGES}
          currentMin={Number.isFinite(minPrice) ? minPrice : null}
          currentMax={Number.isFinite(maxPrice) ? maxPrice : null}
          currentSearchParams={searchParams}
        />
      </FilterBox>

      {availableBrands.length > 0 && (
        <FilterBox title="브랜드">
          <ProductFilters
            kind="brand"
            options={availableBrands.map((b) => ({ label: b, value: b }))}
            currentSelected={brands}
            currentSearchParams={searchParams}
          />
        </FilterBox>
      )}

      <FilterBox title="평점">
        <ul className="space-y-1.5 text-sm">
          <li>
            <Link
              href={{ query: { ...searchParams, rating: undefined, page: undefined } }}
              className={!minRating ? "text-brand-600 font-semibold" : "text-gray-700 hover:text-brand-600"}
            >전체</Link>
          </li>
          {RATING_OPTIONS.map((r) => (
            <li key={r.value}>
              <Link
                href={{ query: { ...searchParams, rating: r.value, page: undefined } }}
                className={String(minRating) === r.value ? "text-amber-600 font-semibold" : "text-gray-700 hover:text-amber-600"}
              >{r.label}</Link>
            </li>
          ))}
        </ul>
      </FilterBox>

      <FilterBox title="옵션">
        <ul className="space-y-1.5 text-sm">
          <li>
            <Link
              href={{ query: { ...searchParams, sale: sale ? undefined : "1", page: undefined } }}
              className={sale ? "text-accent-500 font-bold" : "text-gray-700 hover:text-accent-500"}
            >
              {sale ? "✓ 할인 상품만" : "□ 할인 상품만"}
            </Link>
          </li>
          <li>
            <Link
              href={{ query: { ...searchParams, instock: inStock ? undefined : "1", page: undefined } }}
              className={inStock ? "text-emerald-600 font-bold" : "text-gray-700 hover:text-emerald-600"}
            >
              {inStock ? "✓ 재고 있음만" : "□ 재고 있음만"}
            </Link>
          </li>
        </ul>
      </FilterBox>

      {chips.length > 0 && (
        <Link
          href={q ? `/products?q=${encodeURIComponent(q)}` : "/products"}
          className="block text-center text-xs text-gray-500 hover:text-brand-600 py-2 border border-gray-200 rounded"
        >
          ↻ 필터 초기화
        </Link>
      )}
    </>
  );

  return (
    <div className="container-mall py-4 md:py-6">
      {/* breadcrumb */}
      <nav className="text-xs text-gray-500 mb-3">
        <Link href="/" className="hover:text-brand-600">홈</Link>
        <span className="mx-1">›</span>
        <Link href="/products" className="hover:text-brand-600">전체상품</Link>
        {currentCategoryName && (
          <>
            <span className="mx-1">›</span>
            <span className="text-gray-700">{currentCategoryName}</span>
          </>
        )}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* 데스크톱 사이드 필터 */}
        <aside className="hidden lg:block space-y-4">{sidebar}</aside>

        {/* 본문 */}
        <div>
          {/* 헤더: 제목 + 정렬 + 모바일 필터 */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-200">
            <h1 className="text-lg md:text-xl font-bold">
              {currentCategoryName || (q ? `"${q}" 검색 결과` : "전체상품")}
              <span className="ml-2 text-sm font-normal text-gray-500">총 {total.toLocaleString()}개</span>
            </h1>

            <div className="flex items-center gap-2 ml-auto">
              {/* 정렬: 모바일은 select, 데스크톱은 link 행 */}
              <div className="hidden md:flex items-center gap-2 text-sm flex-wrap">
                {SORT_OPTIONS.map((opt) => (
                  <Link
                    key={opt.value}
                    href={{ query: { ...searchParams, sort: opt.value, page: undefined } }}
                    className={sort === opt.value ? "text-brand-600 font-semibold" : "text-gray-500 hover:text-brand-600"}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
              <SortSelectMobile sort={sort} />
              <MobileFilterButton count={chips.length}>{sidebar}</MobileFilterButton>
            </div>
          </div>

          {/* 활성 필터 칩 */}
          <ActiveFilterChips chips={chips} />

          {displayItems.length === 0 ? (
            <div className="py-20 text-center text-gray-500">
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-medium">조건에 맞는 상품이 없습니다.</p>
              <p className="text-xs text-gray-400 mt-2">필터를 조정하시거나 다른 검색어로 시도해주세요.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {displayItems.map((p) => (
                  <ProductCard
                    key={p.id}
                    {...p}
                    rating={p._avgRating || undefined}
                    reviewCount={p._reviewCount}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination total={totalPages} current={page} searchParams={searchParams} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h3 className="font-bold text-sm mb-3 pb-2 border-b border-gray-100">{title}</h3>
      {children}
    </div>
  );
}

function Pagination({ total, current, searchParams }: { total: number; current: number; searchParams: SP }) {
  const start = Math.max(1, current - 3);
  const end = Math.min(total, start + 6);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="mt-10 flex justify-center gap-1 flex-wrap">
      {current > 1 && (
        <Link href={{ query: { ...searchParams, page: current - 1 } }} className="min-w-9 h-9 px-3 inline-flex items-center justify-center rounded text-sm border bg-white border-gray-200 hover:border-brand-500">‹</Link>
      )}
      {start > 1 && (
        <>
          <Link href={{ query: { ...searchParams, page: 1 } }} className="min-w-9 h-9 px-3 inline-flex items-center justify-center rounded text-sm border bg-white border-gray-200 hover:border-brand-500">1</Link>
          {start > 2 && <span className="px-2 self-center text-gray-400">…</span>}
        </>
      )}
      {pages.map((n) => (
        <Link
          key={n}
          href={{ query: { ...searchParams, page: n } }}
          className={`min-w-9 h-9 px-3 inline-flex items-center justify-center rounded text-sm border ${
            n === current ? "bg-brand-500 text-white border-brand-500" : "bg-white text-gray-700 border-gray-200 hover:border-brand-500"
          }`}
        >{n}</Link>
      ))}
      {end < total && (
        <>
          {end < total - 1 && <span className="px-2 self-center text-gray-400">…</span>}
          <Link href={{ query: { ...searchParams, page: total } }} className="min-w-9 h-9 px-3 inline-flex items-center justify-center rounded text-sm border bg-white border-gray-200 hover:border-brand-500">{total}</Link>
        </>
      )}
      {current < total && (
        <Link href={{ query: { ...searchParams, page: current + 1 } }} className="min-w-9 h-9 px-3 inline-flex items-center justify-center rounded text-sm border bg-white border-gray-200 hover:border-brand-500">›</Link>
      )}
    </div>
  );
}

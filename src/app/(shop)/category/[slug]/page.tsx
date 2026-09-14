import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import ProductCard from "@/components/ProductCard";
import CategoryIcon from "@/components/CategoryIcon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const cat = await prisma.category.findUnique({
    where: { slug: params.slug },
    select: { name: true, description: true },
  }).catch(() => null);
  if (!cat) return { title: "카테고리를 찾을 수 없습니다", robots: { index: false } };
  return {
    title: cat.name,
    description: cat.description || `${cat.name} 카테고리의 모든 상품을 확인하세요.`,
  };
}

const PAGE_SIZE = 24;
const SORT_OPTIONS = [
  { value: "new", label: "신상품순" },
  { value: "best", label: "인기순" },
  { value: "reviews", label: "리뷰많은순" },
  { value: "low", label: "낮은가격순" },
  { value: "high", label: "높은가격순" },
];

export default async function CategoryDetailPage({ params, searchParams }: { params: { slug: string }; searchParams: { sort?: string; page?: string } }) {
  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
    include: {
      parent: { include: { children: { orderBy: { sortOrder: "asc" } } } },
      children: { orderBy: { sortOrder: "asc" } },
    },
  }).catch(() => null);

  if (!category) notFound();

  // 이 카테고리 + 자식 카테고리 ID 모두 (자식 상품도 포함)
  const categoryIds = [category.id, ...category.children.map((c) => c.id)];
  // 하위 카테고리 칩: 상위면 자기 자식들, 하위면 같은 부모의 형제들 (다른 하위로 바로 이동 가능)
  const chipParent = category.children.length > 0 ? category : category.parent;
  const chipItems = category.children.length > 0 ? category.children : (category.parent?.children ?? []);

  const sort = searchParams.sort || "new";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] = { createdAt: "desc" };
  if (sort === "low") orderBy = [{ salePrice: "asc" }, { price: "asc" }];
  else if (sort === "high") orderBy = [{ salePrice: "desc" }, { price: "desc" }];
  else if (sort === "best") orderBy = [{ isFeatured: "desc" }, { reviews: { _count: "desc" } }, { createdAt: "desc" }];
  else if (sort === "reviews") orderBy = { reviews: { _count: "desc" } };

  const where = { isActive: true, categoryId: { in: categoryIds } };
  const [items, totalCount] = await Promise.all([
    prisma.product.findMany({
      where, orderBy, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE,
      include: {
        _count: { select: { reviews: { where: { isHidden: false } } } },
        reviews: { where: { isHidden: false }, select: { rating: true } },
      },
    }).catch(() => []),
    prisma.product.count({ where }).catch(() => 0),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const products = items.map((p) => {
    const sum = p.reviews.reduce((a, r) => a + r.rating, 0);
    return { ...p, _avgRating: p.reviews.length ? Math.round((sum / p.reviews.length) * 10) / 10 : 0, _reviewCount: p._count.reviews };
  });
  const pageHref = (n: number, srt = sort) => {
    const qs = new URLSearchParams({ ...(srt !== "new" ? { sort: srt } : {}), ...(n > 1 ? { page: String(n) } : {}) }).toString();
    return `/category/${category.slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      {/* HERO */}
      <section className={`relative overflow-hidden ${
        category.bannerImage ? "bg-gray-900" : "bg-gradient-to-br from-brand-800 via-brand-600 to-brand-400"
      } text-white`}>
        {category.bannerImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={category.bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/20" />
          </>
        )}
        <div className="container-mall relative py-10 md:py-16">
          <nav className="text-xs text-white/70 mb-3 flex items-center gap-1">
            <Link href="/" className="hover:text-white">홈</Link>
            <span>›</span>
            <Link href="/categories" className="hover:text-white">전체 카테고리</Link>
            {category.parent && (
              <>
                <span>›</span>
                <Link href={`/category/${category.parent.slug}`} className="hover:text-white">{category.parent.name}</Link>
              </>
            )}
            <span>›</span>
            <span className="text-white">{category.name}</span>
          </nav>

          <div className="flex items-end gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
              <CategoryIcon slug={category.slug} iconEmoji={category.iconEmoji} className="w-10 h-10 md:w-12 md:h-12 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{category.name}</h1>
              <p className="text-sm md:text-base mt-1 opacity-90">
                {category.description || `${category.name} 카테고리의 다양한 상품을 둘러보세요.`}
              </p>
              <p className="text-xs mt-2 opacity-75">총 {totalCount.toLocaleString()}개 상품</p>
            </div>
          </div>
        </div>
      </section>

      <div className="container-mall py-6 md:py-8 space-y-10">
        {/* 하위 카테고리 */}
        {chipParent && chipItems.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-400 tracking-wider uppercase mb-3">{chipParent.name} 하위 카테고리</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={chipParent.id === category.id ? `/products?category=${category.slug}` : `/category/${chipParent.slug}`}
                className={`px-4 h-9 inline-flex items-center rounded-full text-sm font-medium ${chipParent.id === category.id ? "bg-brand-500 text-white hover:bg-brand-600" : "bg-white border border-gray-300 text-gray-700 hover:border-brand-500 hover:text-brand-600"}`}
              >
                {chipParent.id === category.id ? "전체보기" : `${chipParent.name} 전체`}
              </Link>
              {chipItems.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/category/${sub.slug}`}
                  className={`px-4 h-9 inline-flex items-center rounded-full text-sm ${sub.id === category.id ? "bg-brand-500 text-white font-medium hover:bg-brand-600" : "bg-white border border-gray-300 text-gray-700 hover:border-brand-500 hover:text-brand-600"}`}
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 전체 상품 목록 */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
            <h2 className="text-2xl font-bold tracking-tight">{category.name} 전체 상품 <span className="text-base font-normal text-gray-500">총 {totalCount.toLocaleString()}개</span></h2>
            <div className="flex items-center gap-3 text-sm">
              {SORT_OPTIONS.map((opt) => (
                <Link key={opt.value} href={pageHref(1, opt.value)} className={sort === opt.value ? "text-brand-600 font-semibold" : "text-gray-500 hover:text-brand-600"}>
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>

          {totalCount === 0 ? (
            <div className="py-20 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
              <div className="text-4xl mb-2">📭</div>
              <p>이 카테고리에 등록된 상품이 없습니다.</p>
              <Link href="/products" className="btn-outline mt-4 inline-flex">전체 상품 보러가기</Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {products.map((p) => (
                  <ProductCard key={p.id} {...p} rating={p._avgRating} reviewCount={p._reviewCount} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav className="flex items-center justify-center gap-1 mt-8" aria-label="페이지">
                  {page > 1 && <Link href={pageHref(page - 1)} className="px-3 h-9 inline-flex items-center rounded border border-gray-300 text-sm hover:border-brand-500">‹ 이전</Link>}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <Link key={n} href={pageHref(n)} className={`w-9 h-9 inline-flex items-center justify-center rounded text-sm ${n === page ? "bg-brand-600 text-white font-bold" : "border border-gray-300 hover:border-brand-500"}`}>{n}</Link>
                  ))}
                  {page < totalPages && <Link href={pageHref(page + 1)} className="px-3 h-9 inline-flex items-center rounded border border-gray-300 text-sm hover:border-brand-500">다음 ›</Link>}
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";
import CategoryIcon from "@/components/CategoryIcon";

export const revalidate = 60;

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

export default async function CategoryDetailPage({ params }: { params: { slug: string } }) {
  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
    include: {
      parent: true,
      children: { orderBy: { sortOrder: "asc" } },
    },
  }).catch(() => null);

  if (!category) notFound();

  // 이 카테고리 + 자식 카테고리 ID 모두 (자식 상품도 포함)
  const categoryIds = [category.id, ...category.children.map((c) => c.id)];

  const [featured, newest, best, totalCount] = await Promise.all([
    // 추천
    prisma.product.findMany({
      where: { isActive: true, isFeatured: true, categoryId: { in: categoryIds } },
      take: 4,
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
    // 신상품 8개
    prisma.product.findMany({
      where: { isActive: true, categoryId: { in: categoryIds } },
      take: 8,
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
    // 베스트 (리뷰 많은 순) 4개
    prisma.product.findMany({
      where: { isActive: true, categoryId: { in: categoryIds } },
      take: 4,
      orderBy: [{ reviews: { _count: "desc" } }, { isFeatured: "desc" }],
      include: {
        _count: { select: { reviews: { where: { isHidden: false } } } },
        reviews: { where: { isHidden: false }, select: { rating: true } },
      },
    }).catch(() => []),
    prisma.product.count({ where: { isActive: true, categoryId: { in: categoryIds } } }).catch(() => 0),
  ]);

  const bestWithRating = best.map((p: any) => {
    const sum = p.reviews.reduce((s: number, r: any) => s + r.rating, 0);
    const avg = p.reviews.length > 0 ? sum / p.reviews.length : 0;
    return { ...p, _avgRating: Math.round(avg * 10) / 10, _reviewCount: p._count.reviews };
  });

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
        {category.children.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-400 tracking-wider uppercase mb-3">하위 카테고리</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/products?category=${category.slug}`}
                className="px-4 h-9 inline-flex items-center rounded-full bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
              >
                전체보기
              </Link>
              {category.children.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/category/${sub.slug}`}
                  className="px-4 h-9 inline-flex items-center rounded-full bg-white border border-gray-300 text-gray-700 text-sm hover:border-brand-500 hover:text-brand-600"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {totalCount === 0 ? (
          <div className="py-20 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
            <div className="text-4xl mb-2">📭</div>
            <p>이 카테고리에 등록된 상품이 없습니다.</p>
            <Link href="/products" className="btn-outline mt-4 inline-flex">전체 상품 보러가기</Link>
          </div>
        ) : (
          <>
            {/* 베스트 */}
            {bestWithRating.length > 0 && (
              <section>
                <SectionHeader
                  title={`🔥 ${category.name} 베스트`}
                  subtitle="가장 많은 리뷰가 달린 인기 상품"
                  href={`/products?category=${category.slug}&sort=best`}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
                  {bestWithRating.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      {...p}
                      rank={i + 1}
                      rating={p._avgRating}
                      reviewCount={p._reviewCount}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 추천 */}
            {featured.length > 0 && (
              <section>
                <SectionHeader
                  title={`MD 추천 ${category.name}`}
                  subtitle="이번 주 MD가 직접 고른 추천 상품"
                  href={`/products?category=${category.slug}`}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
                  {featured.map((p) => (
                    <ProductCard key={p.id} {...p} isFeatured />
                  ))}
                </div>
              </section>
            )}

            {/* 신상품 */}
            {newest.length > 0 && (
              <section>
                <SectionHeader
                  title={`신상품 ${category.name}`}
                  subtitle="새로 입고된 상품"
                  href={`/products?category=${category.slug}&sort=new`}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
                  {newest.map((p) => (
                    <ProductCard key={p.id} {...p} />
                  ))}
                </div>
              </section>
            )}

            {/* 전체 보기 CTA */}
            <div className="text-center pt-4">
              <Link
                href={`/products?category=${category.slug}`}
                className="btn-primary px-8"
              >
                {category.name} 전체 {totalCount.toLocaleString()}개 보기 →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, href }: { title: string; subtitle?: string; href: string }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <Link href={href} className="text-sm text-gray-500 hover:text-brand-600 shrink-0">더보기 →</Link>
    </div>
  );
}

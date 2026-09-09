import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CategoryIcon from "@/components/CategoryIcon";

export const revalidate = 60;
export const metadata = { title: "전체 카테고리" };

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      children: { orderBy: { sortOrder: "asc" } },
      _count: { select: { products: { where: { isActive: true } } } },
    },
  }).catch(() => []);

  // 자식 카테고리 상품 수까지 합산
  const allChildIds = categories.flatMap((c) => c.children.map((ch) => ch.id));
  const childCounts = allChildIds.length > 0
    ? await prisma.product.groupBy({
        by: ["categoryId"],
        where: { isActive: true, categoryId: { in: allChildIds } },
        _count: { id: true },
      }).catch(() => [])
    : [];
  const childCountMap = new Map(childCounts.map((c) => [c.categoryId, c._count.id]));
  const totalCountFor = (parentId: string, children: { id: string }[]) => {
    const direct = categories.find((c) => c.id === parentId)?._count.products ?? 0;
    const childSum = children.reduce((s, ch) => s + (childCountMap.get(ch.id) || 0), 0);
    return direct + childSum;
  };

  return (
    <div className="container-mall py-6 md:py-8">
      <header className="mb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">전체 카테고리</h1>
        <p className="text-sm text-gray-500 mt-2">원하는 분야를 골라 빠르게 둘러보세요.</p>
      </header>

      {categories.length === 0 ? (
        <div className="py-20 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
          등록된 카테고리가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => {
            const total = totalCountFor(c.id, c.children);
            return (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-brand-500 hover:shadow-md transition-all"
              >
                {/* Hero */}
                <div
                  className={`relative aspect-[5/2] overflow-hidden flex items-center justify-center text-white ${
                    c.bannerImage ? "bg-gray-900" : "bg-gradient-to-br from-brand-700 via-brand-500 to-brand-400"
                  }`}
                >
                  {c.bannerImage && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </>
                  )}
                  <div className="relative w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
                    <CategoryIcon slug={c.slug} iconEmoji={c.iconEmoji} className="w-11 h-11 text-white" strokeWidth={1.4} />
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-gray-900 group-hover:text-brand-600">{c.name}</h2>
                    <span className="text-xs text-gray-500 tabular-nums">{total.toLocaleString()}개 상품</span>
                  </div>
                  {c.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                  )}
                  {c.children.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.children.slice(0, 5).map((sub) => (
                        <span
                          key={sub.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]"
                        >
                          {sub.name}
                        </span>
                      ))}
                      {c.children.length > 5 && (
                        <span className="text-[11px] text-gray-400 self-center">+{c.children.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CategoryIcon from "@/components/CategoryIcon";

export default async function CategoryNav() {
  const categories = await prisma.category
    .findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: {
        children: { orderBy: { sortOrder: "asc" } },
      },
    })
    .catch(() => []);

  return (
    <nav className="relative border-t border-gray-100 bg-gray-50">
      <div className="container-mall flex items-center h-12 overflow-x-visible">
        <Link
          href="/products"
          className="inline-flex items-center px-4 h-12 text-sm font-bold text-brand-700 hover:bg-white whitespace-nowrap border-b-2 border-transparent hover:border-brand-700 transition-colors"
        >
          전체상품
        </Link>

        {/* 좌우 구분선 */}
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-gray-300" />

        {/* 메인 카테고리 — flex-1 로 가용 공간을 채우고 균등 간격으로 분포 */}
        <div className="flex-1 flex items-center justify-around">
          {categories.map((c) => (
          <div key={c.id} className="group relative">
            <Link
              href={`/category/${c.slug}`}
              className="inline-flex items-center px-4 h-12 text-[15px] font-medium text-gray-700 hover:text-brand-600 group-hover:text-brand-600 whitespace-nowrap border-b-2 border-transparent group-hover:border-brand-500 transition-colors"
            >
              {c.name}
            </Link>

            {c.children.length > 0 && (
              <div
                className="absolute top-full left-0 z-50 hidden group-hover:block pt-0 min-w-[220px]"
              >
                <div className="bg-white border border-gray-200 rounded-b-lg shadow-lg py-2 animate-slide-down">
                  <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-400 tracking-wider uppercase">
                      <CategoryIcon slug={c.slug} iconEmoji={c.iconEmoji} className="w-3.5 h-3.5" strokeWidth={2} />
                      {c.name}
                    </span>
                    <Link
                      href={`/category/${c.slug}`}
                      className="text-[11px] text-brand-600 hover:underline"
                    >전체보기 →</Link>
                  </div>
                  <ul>
                    {c.children.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={`/category/${sub.slug}`}
                          className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                        >
                          <span>{sub.name}</span>
                          <span className="text-gray-300 group-hover:text-brand-400 text-xs">›</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          ))}
        </div>

        {/* 좌우 구분선 */}
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-gray-300" />

        <div className="flex items-center gap-3 text-xs">
          <Link href="/products?sort=new" className="text-gray-500 hover:text-brand-600 px-2">신상품</Link>
          <Link href="/products?sort=best" className="text-gray-500 hover:text-brand-600 px-2">베스트</Link>
          <Link href="/products?sale=1" className="text-accent-500 font-bold px-2">할인특가</Link>
        </div>
      </div>
    </nav>
  );
}

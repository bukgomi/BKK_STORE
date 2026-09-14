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
  // 미분류는 메뉴에서 숨기고 그 자리에 채비도(/rigs)를 둔다
  const menu = categories.filter((c) => c.slug !== "uncategorized");

  return (
    <nav className="hidden md:block border-b border-gray-200 bg-gray-50">
      <div className="container-mall flex items-center h-12 overflow-x-visible max-lg:overflow-x-auto max-lg:no-scrollbar max-lg:px-2">
        <Link
          href="/products"
          className="inline-flex items-center px-4 max-lg:px-3 h-12 text-base max-lg:text-[15px] font-bold text-brand-700 shrink-0 hover:bg-white whitespace-nowrap border-b-2 border-transparent hover:border-brand-700 transition-colors"
        >
          전체상품
        </Link>

        {/* 좌우 구분선 */}
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-gray-300" />

        {/* 메인 카테고리 — flex-1 로 가용 공간을 채우고 균등 간격으로 분포 */}
        <div className="flex-1 flex items-center justify-around max-lg:justify-start">
          {menu.map((c) => (
          <div key={c.id} className="group relative">
            <Link
              href={`/category/${c.slug}`}
              className="inline-flex items-center px-3 xl:px-4 h-12 text-base max-lg:text-[15px] font-medium text-gray-700 hover:text-brand-600 group-hover:text-brand-600 whitespace-nowrap border-b-2 border-transparent group-hover:border-brand-500 transition-colors"
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
          <Link
            href="/rigs"
            className="inline-flex items-center px-3 xl:px-4 h-12 text-base max-lg:text-[15px] font-medium text-gray-700 hover:text-brand-600 whitespace-nowrap border-b-2 border-transparent hover:border-brand-500 transition-colors"
          >
            채비도
          </Link>
        </div>

      </div>
    </nav>
  );
}

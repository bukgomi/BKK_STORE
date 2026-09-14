import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { noticeCategoryMeta } from "@/lib/cms";

export const revalidate = 60;
export const metadata = { title: "공지사항" };

export default async function NoticeListPage() {
  const notices = await prisma.notice.findMany({
    where: { isPublished: true },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    take: 100,
  }).catch(() => []);

  return (
    <div className="container-mall py-6 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">공지사항</h1>
        <p className="text-sm text-gray-500 mt-1">탑캐스팅의 새 소식, 이벤트, 안내 사항을 확인하세요.</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {notices.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <div className="text-4xl mb-2">📭</div>
            <p>등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notices.map((n) => {
              const meta = noticeCategoryMeta(n.category);
              return (
                <li key={n.id}>
                  <Link href={`/notice/${n.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50">
                    {n.isPinned && (
                      <span className="text-rose-500" title="상단 고정">📌</span>
                    )}
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                      meta.tone === "danger" ? "bg-rose-100 text-rose-700" :
                      meta.tone === "warning" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{meta.label}</span>
                    <h2 className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">{n.title}</h2>
                    <time className="text-xs text-gray-400 shrink-0">
                      {new Date(n.publishedAt).toLocaleDateString("ko-KR")}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

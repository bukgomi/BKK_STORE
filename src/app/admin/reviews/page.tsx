import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HideReviewButton from "./HideReviewButton";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const PAGE_SIZE = 30;

export default async function AdminReviewsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const filter = (searchParams.filter as string) || "all"; // all | hidden | low (1-2점)
  const page = Math.max(1, parseInt((searchParams.page as string) || "1", 10));

  const where: any = {};
  if (filter === "hidden") where.isHidden = true;
  if (filter === "low") where.rating = { lte: 2 };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where, orderBy: { createdAt: "desc" },
      take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE,
      include: {
        user: { select: { email: true, name: true } },
        product: { select: { id: true, name: true, thumbnail: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">리뷰 관리</h1>
        <p className="text-xs text-gray-500 mt-1">총 {total.toLocaleString()}개</p>
      </div>

      <div className="flex gap-2 text-xs">
        {[
          { v: "all", label: "전체" },
          { v: "hidden", label: "숨김 처리됨" },
          { v: "low", label: "낮은 평점 (1-2점)" },
        ].map((opt) => (
          <Link
            key={opt.v}
            href={`/admin/reviews?filter=${opt.v}`}
            className={`px-3 py-1.5 rounded ${
              filter === opt.v ? "bg-brand-500 text-white" : "bg-gray-50 hover:bg-gray-100 text-gray-600"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2.5 w-44">상품</th>
              <th className="text-left px-3 py-2.5 w-32">작성자</th>
              <th className="text-center px-3 py-2.5 w-20">평점</th>
              <th className="text-left px-3 py-2.5">내용</th>
              <th className="text-center px-3 py-2.5 w-32">작성일</th>
              <th className="text-center px-3 py-2.5 w-24">상태/액션</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">리뷰가 없습니다.</td></tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/products/${r.product.id}/edit`} className="text-xs text-brand-600 hover:underline line-clamp-2">
                      {r.product.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <div>{r.user.name}</div>
                    <div className="text-gray-400 truncate">{r.user.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((n) => <span key={n}>{r.rating >= n ? "★" : "☆"}</span>)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    <p className="line-clamp-3">{r.content}</p>
                    {r.isVerifiedPurchase && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700">구매인증</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-gray-500">
                    {r.createdAt.toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <HideReviewButton id={r.id} hidden={r.isHidden} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: totalPages }).slice(0, 20).map((_, i) => {
            const n = i + 1;
            return (
              <Link
                key={n}
                href={{ query: { ...searchParams, page: n } }}
                className={`min-w-9 h-9 px-3 inline-flex items-center justify-center rounded text-sm border ${
                  n === page ? "bg-brand-500 text-white border-brand-500" : "bg-white text-gray-700 border-gray-200 hover:border-brand-500"
                }`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

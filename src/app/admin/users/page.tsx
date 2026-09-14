import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { formatKRW } from "@/lib/utils";
import { getAdminEmails, requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const PAGE_SIZE = 20;

export default async function AdminUsersPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const q = (searchParams.q as string) || "";
  const page = Math.max(1, parseInt((searchParams.page as string) || "1", 10));

  const where: Prisma.UserWhereInput = {};
  if (q) where.OR = [
    { email: { contains: q, mode: "insensitive" } },
    { name: { contains: q, mode: "insensitive" } },
    { phone: { contains: q } },
  ];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // 회원별 누적 결제금액 (PAID 만)
  const userIds = users.map((u) => u.id);
  const aggs = userIds.length
    ? await prisma.order.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, status: "PAID" },
        _sum: { totalAmount: true },
      })
    : [];
  const totalSpentByUser: Record<string, number> = {};
  for (const a of aggs) {
    if (a.userId) totalSpentByUser[a.userId] = a._sum.totalAmount || 0;
  }

  const adminEmails = new Set(getAdminEmails());
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">회원 관리</h1>
        <p className="text-xs text-gray-500 mt-1">총 {total.toLocaleString()}명</p>
      </div>

      <form className="bg-white rounded border border-gray-200 p-4 flex gap-2 items-end">
        <div className="flex-1">
          <label className="label">검색어</label>
          <input name="q" defaultValue={q} placeholder="이메일, 이름, 전화번호" className="input h-9" />
        </div>
        <button type="submit" className="btn-primary h-9 text-sm">검색</button>
        <Link href="/admin/users" className="btn-outline h-9 text-sm">초기화</Link>
      </form>

      <div className="bg-white rounded border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2.5">이메일</th>
              <th className="text-left px-3 py-2.5 w-32">이름</th>
              <th className="text-left px-3 py-2.5 w-36">연락처</th>
              <th className="text-right px-3 py-2.5 w-24">주문수</th>
              <th className="text-right px-3 py-2.5 w-32">누적 결제</th>
              <th className="text-right px-3 py-2.5 w-32">가입일</th>
              <th className="text-center px-3 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">회원이 없습니다.</td></tr>
            ) : (
              users.map((u) => {
                const isAdmin = adminEmails.has(u.email.toLowerCase());
                return (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/users/${u.id}`} className="text-brand-600 hover:underline">{u.email}</Link>
                        {isAdmin && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 font-bold">ADMIN</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{u.name}</td>
                    <td className="px-3 py-2.5 text-gray-600">{u.phone || "-"}</td>
                    <td className="px-3 py-2.5 text-right">{u._count.orders}</td>
                    <td className="px-3 py-2.5 text-right font-bold">{formatKRW(totalSpentByUser[u.id] || 0)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-500">
                      {u.createdAt.toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      <Link href={`/admin/users/${u.id}`} className="text-brand-600 hover:underline">상세</Link>
                    </td>
                  </tr>
                );
              })
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

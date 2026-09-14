import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "신규", PENDING: "확인중", ANSWERED: "답변완료", CLOSED: "종료",
};
const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700",
  PENDING: "bg-amber-50 text-amber-700",
  ANSWERED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default async function AdminSupportPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const status = searchParams.status;
  const where = status ? { status: status as any } : {};

  const [tickets, counts] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: {
        user: { select: { email: true, name: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const statusCount: Record<string, number> = {};
  counts.forEach((c) => { statusCount[c.status] = c._count._all; });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">1:1 문의 관리</h1>
        <p className="text-xs text-gray-500 mt-1">총 {tickets.length.toLocaleString()}건</p>
      </div>

      <div className="flex gap-2 text-xs flex-wrap">
        <Link href="/admin/support" className={`px-3 py-1.5 rounded ${!status ? "bg-brand-500 text-white" : "bg-gray-50 hover:bg-gray-100 text-gray-600"}`}>
          전체
        </Link>
        {["OPEN", "PENDING", "ANSWERED", "CLOSED"].map((s) => (
          <Link
            key={s}
            href={`/admin/support?status=${s}`}
            className={`px-3 py-1.5 rounded ${status === s ? "bg-brand-500 text-white" : "bg-gray-50 hover:bg-gray-100 text-gray-600"}`}
          >
            {STATUS_LABEL[s]} <span className="opacity-70">({statusCount[s] || 0})</span>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2 w-32">티켓 번호</th>
              <th className="text-left px-3 py-2 w-20">상태</th>
              <th className="text-left px-3 py-2">제목</th>
              <th className="text-left px-3 py-2 w-44">작성자</th>
              <th className="text-right px-3 py-2 w-32">최근 메시지</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-500">문의가 없습니다.</td></tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/admin/support/${t.id}`} className="text-brand-600 hover:underline">{t.ticketNo}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {t.subject}
                    <span className="ml-2 text-xs text-gray-400">[{t.category}]</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.user ? `${t.user.name} (${t.user.email})` : `${t.guestName} (${t.guestEmail})`}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-500">
                    {t.lastMessageAt.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

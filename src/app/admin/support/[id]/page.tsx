import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminReplyForm from "./AdminReplyForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "신규", PENDING: "확인중", ANSWERED: "답변완료", CLOSED: "종료",
};

export default async function AdminSupportDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="space-y-4">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <Link href="/admin/support" className="hover:text-brand-600">1:1 문의</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">{ticket.ticketNo}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            {ticket.subject}
            <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
              {STATUS_LABEL[ticket.status]}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-mono">{ticket.ticketNo} · {ticket.category}</p>
        </div>
      </div>

      <section className="bg-white rounded border border-gray-200 p-5">
        <h2 className="font-bold text-sm pb-3 mb-3 border-b border-gray-100">고객 정보</h2>
        <dl className="text-sm grid grid-cols-2 gap-y-1.5">
          <dt className="text-gray-500">이름</dt><dd>{ticket.user?.name || ticket.guestName}</dd>
          <dt className="text-gray-500">이메일</dt><dd>{ticket.user?.email || ticket.guestEmail}</dd>
          {ticket.guestPhone && (<><dt className="text-gray-500">연락처</dt><dd>{ticket.guestPhone}</dd></>)}
          <dt className="text-gray-500">최초 등록</dt><dd>{ticket.createdAt.toLocaleString("ko-KR")}</dd>
        </dl>
      </section>

      <section className="bg-white rounded border border-gray-200 p-5">
        <h2 className="font-bold text-sm pb-3 mb-3 border-b border-gray-100">대화</h2>
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {ticket.messages.map((m) => {
            const isAdmin = m.authorType === "ADMIN";
            return (
              <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-md rounded-lg p-3 ${isAdmin ? "bg-brand-50 text-brand-900" : "bg-gray-100 text-gray-800"}`}>
                  <div className="text-[10px] text-gray-500 mb-1">
                    {isAdmin ? "관리자" : m.authorName} · {m.createdAt.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <AdminReplyForm ticketId={ticket.id} currentStatus={ticket.status} />
    </div>
  );
}

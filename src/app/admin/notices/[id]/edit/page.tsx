import { requireAdmin } from "@/lib/admin-guard";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/AdminUI";
import NoticeForm from "../../NoticeForm";

export const dynamic = "force-dynamic";

export default async function AdminNoticeEditPage({ params }: { params: { id: string } }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const notice = await prisma.notice.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!notice) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="공지 수정"
        breadcrumbs={[{ href: "/admin", label: "관리자" }, { href: "/admin/notices", label: "공지사항" }, { label: "수정" }]}
      />
      <NoticeForm initial={{
        id: notice.id,
        title: notice.title,
        content: notice.content,
        category: notice.category,
        isPinned: notice.isPinned,
        isPublished: notice.isPublished,
      }} />
    </div>
  );
}

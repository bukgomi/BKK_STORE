import { requireAdmin } from "@/lib/admin-guard";
import { PageHeader } from "@/components/admin/AdminUI";
import NoticeForm from "../NoticeForm";

export default async function AdminNoticeNewPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="공지 작성"
        breadcrumbs={[{ href: "/admin", label: "관리자" }, { href: "/admin/notices", label: "공지사항" }, { label: "작성" }]}
      />
      <NoticeForm />
    </div>
  );
}

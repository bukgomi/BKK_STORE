import { requireAdmin } from "@/lib/admin-guard";
import { PageHeader } from "@/components/admin/AdminUI";
import FaqForm from "../FaqForm";

export default async function AdminFaqNewPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="FAQ 추가"
        breadcrumbs={[{ href: "/admin", label: "관리자" }, { href: "/admin/faq", label: "FAQ" }, { label: "추가" }]}
      />
      <FaqForm />
    </div>
  );
}

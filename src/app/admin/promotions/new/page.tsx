import { requireAdmin } from "@/lib/admin-guard";
import { PageHeader } from "@/components/admin/AdminUI";
import PromotionForm from "../PromotionForm";

export default async function AdminPromotionNewPage() {
  await requireAdmin();
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="기획전 만들기"
        breadcrumbs={[{ href: "/admin", label: "관리자" }, { href: "/admin/promotions", label: "기획전 / 이벤트" }, { label: "만들기" }]}
      />
      <PromotionForm />
    </div>
  );
}

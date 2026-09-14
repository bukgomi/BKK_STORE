import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import BulkShippingUploader from "./BulkShippingUploader";

export const dynamic = "force-dynamic";

export default async function BulkShippingPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  return (
    <div className="space-y-4">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <Link href="/admin/orders" className="hover:text-brand-600">주문 관리</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">송장 일괄 처리</span>
      </nav>

      <h1 className="text-xl font-bold">송장 일괄 처리</h1>
      <p className="text-xs text-gray-500">
        엑셀/CSV 파일로 여러 주문의 송장을 한 번에 등록합니다. PAID/PREPARING 상태만 처리되며, 자동으로 알림톡이 발송됩니다.
      </p>

      <BulkShippingUploader />
    </div>
  );
}

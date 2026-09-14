import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BulkUploader from "./BulkUploader";

export const dynamic = "force-dynamic";

export default async function BulkProductPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true },
  });

  return (
    <div className="space-y-4">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <Link href="/admin/products" className="hover:text-brand-600">상품 관리</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">일괄 등록</span>
      </nav>

      <h1 className="text-xl font-bold">상품 일괄 등록 (엑셀 / CSV)</h1>
      <p className="text-sm text-gray-500">
        엑셀(.xlsx) 또는 CSV 파일을 업로드하여 한 번에 여러 상품을 등록하거나 수정할 수 있습니다.
        한글/영문 컬럼 헤더를 모두 인식하며, 상품코드(SKU)가 이미 존재하면 자동으로 수정됩니다.
      </p>

      <BulkUploader categories={categories} />
    </div>
  );
}

import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, AdminCard, EmptyState, StatusBadge, DataTable } from "@/components/admin/AdminUI";
import { faqCategoryMeta } from "@/lib/cms";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const faqs = await prisma.faq.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    take: 200,
  }).catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="FAQ 관리"
        desc="고객이 자주 묻는 질문과 답변을 관리합니다. 카테고리별로 표시되며 sortOrder 로 순서를 조정할 수 있습니다."
        actions={
          <Link href="/admin/faq/new" className="btn-primary text-sm">+ FAQ 추가</Link>
        }
      />

      <AdminCard noPadding>
        <DataTable
          columns={[
            {
              key: "category",
              label: "카테고리",
              align: "center",
              cell: (f: any) => <StatusBadge label={faqCategoryMeta(f.category).label} tone="info" />,
            },
            {
              key: "order",
              label: "순서",
              align: "center",
              cell: (f: any) => <span className="text-gray-500 tabular-nums text-xs">{f.sortOrder}</span>,
            },
            {
              key: "question",
              label: "질문",
              cell: (f: any) => (
                <Link href={`/admin/faq/${f.id}/edit`} className="text-gray-800 hover:text-brand-600 line-clamp-1">
                  {f.question}
                </Link>
              ),
            },
            {
              key: "published",
              label: "공개",
              align: "center",
              cell: (f: any) => f.isPublished
                ? <StatusBadge label="공개" tone="success" />
                : <StatusBadge label="비공개" tone="gray" />,
            },
            {
              key: "views",
              label: "조회",
              align: "right",
              cell: (f: any) => <span className="text-gray-500 tabular-nums">{f.viewCount.toLocaleString()}</span>,
            },
          ]}
          rows={faqs}
          rowKey={(f: any) => f.id}
          empty={<EmptyState icon="❓" title="FAQ가 없습니다." action={
            <Link href="/admin/faq/new" className="btn-primary text-sm">+ 첫 FAQ 추가</Link>
          } />}
        />
      </AdminCard>
    </div>
  );
}

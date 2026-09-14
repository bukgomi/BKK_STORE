import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, AdminCard, EmptyState, StatusBadge, DataTable } from "@/components/admin/AdminUI";
import { noticeCategoryMeta } from "@/lib/cms";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const notices = await prisma.notice.findMany({
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    take: 100,
  }).catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="공지사항"
        desc="고객 안내, 휴무, 이벤트 공지 등을 작성하고 관리합니다."
        actions={
          <Link href="/admin/notices/new" className="btn-primary text-sm">+ 공지 작성</Link>
        }
      />

      <AdminCard noPadding>
        <DataTable
          columns={[
            {
              key: "category",
              label: "구분",
              align: "center",
              cell: (n: any) => {
                const meta = noticeCategoryMeta(n.category);
                return <StatusBadge label={meta.label} tone={meta.tone} />;
              },
            },
            {
              key: "title",
              label: "제목",
              cell: (n: any) => (
                <div className="flex items-center gap-2 min-w-0">
                  {n.isPinned && <span className="text-rose-500" title="상단 고정">📌</span>}
                  <Link href={`/admin/notices/${n.id}/edit`} className="text-gray-800 hover:text-brand-600 truncate">
                    {n.title}
                  </Link>
                </div>
              ),
            },
            {
              key: "published",
              label: "공개",
              align: "center",
              cell: (n: any) => n.isPublished
                ? <StatusBadge label="공개" tone="success" />
                : <StatusBadge label="비공개" tone="gray" />,
            },
            {
              key: "views",
              label: "조회",
              align: "right",
              cell: (n: any) => <span className="text-gray-500 tabular-nums">{n.viewCount.toLocaleString()}</span>,
            },
            {
              key: "date",
              label: "게시일",
              align: "right",
              cell: (n: any) => <span className="text-gray-500 text-xs">{new Date(n.publishedAt).toLocaleDateString("ko-KR")}</span>,
            },
          ]}
          rows={notices}
          rowKey={(n: any) => n.id}
          empty={<EmptyState icon="📢" title="공지사항이 없습니다." action={
            <Link href="/admin/notices/new" className="btn-primary text-sm">+ 첫 공지 작성</Link>
          } />}
        />
      </AdminCard>
    </div>
  );
}

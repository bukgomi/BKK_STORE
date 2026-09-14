import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHeader, AdminCard, EmptyState, StatusBadge, DataTable } from "@/components/admin/AdminUI";
import { isPromotionLive, promotionHref } from "@/lib/promotion";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  await requireAdmin();
  const [items, settings] = await Promise.all([
    prisma.promotion.findMany({ orderBy: { createdAt: "desc" }, take: 200 }).catch(() => []),
    getSiteSettings(),
  ]);
  const heroHrefs = new Set(settings.heroSlides.map((s) => s.href));

  return (
    <div className="space-y-6">
      <PageHeader
        title="기획전 / 이벤트"
        desc="메인 히어로 슬라이드와 배너가 연결되는 기획전 페이지를 만들고 관리합니다."
        actions={<Link href="/admin/promotions/new" className="btn-primary text-sm">+ 기획전 만들기</Link>}
      />
      <AdminCard noPadding>
        <DataTable
          columns={[
            {
              key: "title", label: "제목",
              cell: (p: any) => (
                <div className="flex items-center gap-3 min-w-0">
                  {p.coverImage
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.coverImage} alt="" className="w-14 h-9 rounded object-cover bg-gray-100 shrink-0" />
                    : <div className={`w-14 h-9 rounded shrink-0 ${p.bgClass || "bg-brand-500"}`} />}
                  <div className="min-w-0">
                    <Link href={`/admin/promotions/${p.id}/edit`} className="text-gray-800 hover:text-brand-600 font-medium truncate block">{p.title}</Link>
                    <div className="text-[11px] text-gray-400 truncate">{promotionHref(p.slug)}</div>
                  </div>
                </div>
              ),
            },
            {
              key: "status", label: "상태", align: "center",
              cell: (p: any) => isPromotionLive(p)
                ? <StatusBadge label="진행중" tone="success" />
                : !p.isPublished ? <StatusBadge label="비공개" tone="gray" />
                : p.startsAt && p.startsAt > new Date() ? <StatusBadge label="예정" tone="warning" />
                : <StatusBadge label="종료" tone="gray" />,
            },
            { key: "hero", label: "메인 슬라이드", align: "center", cell: (p: any) => heroHrefs.has(promotionHref(p.slug)) ? <StatusBadge label="게시중" tone="success" /> : <span className="text-xs text-gray-400">-</span> },
            { key: "products", label: "상품", align: "right", cell: (p: any) => <span className="text-gray-500 tabular-nums">{p.productIds.length}</span> },
            { key: "views", label: "조회", align: "right", cell: (p: any) => <span className="text-gray-500 tabular-nums">{p.viewCount.toLocaleString()}</span> },
            { key: "date", label: "등록일", align: "right", cell: (p: any) => <span className="text-gray-500 text-xs">{new Date(p.createdAt).toLocaleDateString("ko-KR")}</span> },
            { key: "view", label: "", align: "right", cell: (p: any) => <Link href={promotionHref(p.slug)} target="_blank" className="text-xs text-brand-600 hover:underline">보기 ↗</Link> },
          ]}
          rows={items}
          rowKey={(p: any) => p.id}
          empty={<EmptyState icon="🎯" title="기획전이 없습니다." action={<Link href="/admin/promotions/new" className="btn-primary text-sm">+ 첫 기획전 만들기</Link>} />}
        />
      </AdminCard>
    </div>
  );
}

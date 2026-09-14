import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, AdminCard, EmptyState, StatusBadge, DataTable } from "@/components/admin/AdminUI";
import { regionLabel, typeLabel } from "@/lib/rig";

export const dynamic = "force-dynamic";

export default async function AdminRigsPage() {
  await requireAdmin();
  const items = await prisma.rigGuide.findMany({ orderBy: [{ species: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }], take: 500 }).catch(() => []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="채비도"
        desc="시즌·지역·어종별 채비도를 등록하면 /rigs 페이지에서 월·지역·낚시 종류·어종으로 골라 볼 수 있습니다."
        actions={<Link href="/admin/rigs/new" className="btn-primary text-sm">+ 채비도 등록</Link>}
      />
      <AdminCard noPadding>
        <DataTable
          columns={[
            { key: "species", label: "어종", cell: (r: any) => (
              <div className="flex items-center gap-2">
                {r.speciesImage
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={r.speciesImage} alt="" className="w-9 h-9 rounded-full object-cover bg-gray-100" />
                  : <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">🐟</div>}
                <span className="font-medium">{r.species}</span>
              </div>
            ) },
            { key: "title", label: "채비", cell: (r: any) => <Link href={`/admin/rigs/${r.id}/edit`} className="text-gray-800 hover:text-brand-600">{r.title}</Link> },
            { key: "type", label: "종류", align: "center", cell: (r: any) => <span className="text-xs text-gray-600">{typeLabel(r.fishingType)}</span> },
            { key: "months", label: "시즌", cell: (r: any) => <span className="text-xs text-gray-600">{r.months.length === 12 ? "연중" : r.months.map((m: number) => `${m}월`).join(" ")}</span> },
            { key: "regions", label: "지역", cell: (r: any) => <span className="text-xs text-gray-600">{r.regions.map(regionLabel).join(", ") || "-"}</span> },
            { key: "comp", label: "구성품", align: "right", cell: (r: any) => <span className="text-gray-500 tabular-nums">{Array.isArray(r.components) ? r.components.length : 0}</span> },
            { key: "pub", label: "공개", align: "center", cell: (r: any) => r.isPublished ? <StatusBadge label="공개" tone="success" /> : <StatusBadge label="비공개" tone="gray" /> },
            { key: "views", label: "조회", align: "right", cell: (r: any) => <span className="text-gray-500 tabular-nums">{r.viewCount.toLocaleString()}</span> },
          ]}
          rows={items}
          rowKey={(r: any) => r.id}
          empty={<EmptyState icon="🎣" title="등록된 채비도가 없습니다." action={<Link href="/admin/rigs/new" className="btn-primary text-sm">+ 첫 채비도 등록</Link>} />}
        />
      </AdminCard>
    </div>
  );
}

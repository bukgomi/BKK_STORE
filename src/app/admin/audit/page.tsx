import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, AdminCard, EmptyState, StatusBadge, DataTable } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const ACTION_TONE: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  refund: "danger", delete: "danger", cancel: "danger",
  update: "warning", edit: "warning", change: "warning",
  create: "success", add: "success",
  ship: "info", login: "info", view: "info",
};

function actionTone(action: string): "success" | "warning" | "danger" | "info" | "default" {
  const lower = action.toLowerCase();
  for (const [key, tone] of Object.entries(ACTION_TONE)) {
    if (lower.includes(key)) return tone;
  }
  return "default";
}

export default async function AdminAuditPage({ searchParams }: {
  searchParams: { page?: string; action?: string; actor?: string; target?: string };
}) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const actionFilter = searchParams.action || "";
  const actorFilter = searchParams.actor || "";
  const targetFilter = searchParams.target || "";

  const where: any = {};
  if (actionFilter) where.action = { contains: actionFilter, mode: "insensitive" };
  if (actorFilter) where.actorEmail = { contains: actorFilter, mode: "insensitive" };
  if (targetFilter) where.targetType = { contains: targetFilter, mode: "insensitive" };

  const [logs, total, distinctActions, distinctTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }).catch(() => []),
    prisma.auditLog.count({ where }).catch(() => 0),
    prisma.auditLog.findMany({ select: { action: true }, distinct: ["action"], take: 30 }).catch(() => []),
    prisma.auditLog.findMany({ select: { targetType: true }, distinct: ["targetType"], take: 30 }).catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="활동 로그"
        desc="관리자가 수행한 모든 변경 작업의 감사 기록입니다 (AuditLog)."
      />

      {/* 필터 */}
      <AdminCard title="필터">
        <form method="GET" action="/admin/audit" className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label text-xs">액션</label>
            <input
              type="text"
              name="action"
              defaultValue={actionFilter}
              list="action-list"
              placeholder="예: order.refund"
              className="input"
            />
            <datalist id="action-list">
              {distinctActions.map((a: any) => <option key={a.action} value={a.action} />)}
            </datalist>
          </div>
          <div>
            <label className="label text-xs">작업자 이메일</label>
            <input type="text" name="actor" defaultValue={actorFilter} placeholder="admin@example.com" className="input" />
          </div>
          <div>
            <label className="label text-xs">대상 타입</label>
            <select name="target" defaultValue={targetFilter} className="input">
              <option value="">전체</option>
              {distinctTypes.filter((t: any) => t.targetType).map((t: any) => (
                <option key={t.targetType} value={t.targetType!}>{t.targetType}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary flex-1">검색</button>
            <Link href="/admin/audit" className="btn-outline">초기화</Link>
          </div>
        </form>
      </AdminCard>

      {/* 결과 카운트 */}
      <div className="text-sm text-gray-500">
        총 <b className="text-gray-800">{total.toLocaleString()}</b>건
      </div>

      <AdminCard noPadding>
        <DataTable
          columns={[
            {
              key: "time",
              label: "시각",
              cell: (l: any) => (
                <span className="text-xs text-gray-600 tabular-nums">
                  {new Date(l.createdAt).toLocaleString("ko-KR")}
                </span>
              ),
            },
            {
              key: "actor",
              label: "작업자",
              cell: (l: any) => (
                <span className="text-xs">
                  {l.actorEmail ? (
                    <span className="text-gray-700">{l.actorEmail}</span>
                  ) : (
                    <span className="text-gray-400">시스템</span>
                  )}
                </span>
              ),
            },
            {
              key: "action",
              label: "액션",
              cell: (l: any) => <StatusBadge label={l.action} tone={actionTone(l.action)} />,
            },
            {
              key: "target",
              label: "대상",
              cell: (l: any) => (
                <span className="text-xs">
                  {l.targetType && <span className="text-brand-600">{l.targetType}</span>}
                  {l.targetId && <span className="text-gray-400 font-mono ml-1">{l.targetId.slice(0, 8)}</span>}
                </span>
              ),
            },
            {
              key: "ip",
              label: "IP",
              cell: (l: any) => <span className="text-xs text-gray-500 font-mono">{l.ip || "-"}</span>,
            },
            {
              key: "meta",
              label: "메타",
              cell: (l: any) => l.metadata
                ? <details className="text-xs"><summary className="cursor-pointer text-brand-600">보기</summary>
                    <pre className="mt-2 p-2 bg-gray-50 rounded max-w-md overflow-x-auto text-[10px] leading-tight">
                      {JSON.stringify(l.metadata, null, 2)}
                    </pre>
                  </details>
                : <span className="text-gray-300">-</span>,
            },
          ]}
          rows={logs}
          rowKey={(l: any) => l.id}
          empty={<EmptyState icon="📜" title="로그가 없습니다." desc="관리자가 작업을 수행하면 여기에 기록됩니다." />}
        />
      </AdminCard>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 10).map((p) => {
            const sp = new URLSearchParams();
            if (actionFilter) sp.set("action", actionFilter);
            if (actorFilter) sp.set("actor", actorFilter);
            if (targetFilter) sp.set("target", targetFilter);
            sp.set("page", String(p));
            return (
              <Link
                key={p}
                href={`/admin/audit?${sp.toString()}`}
                className={`min-w-9 h-9 px-3 inline-flex items-center justify-center rounded text-sm border ${
                  p === page ? "bg-brand-500 text-white border-brand-500" : "bg-white border-gray-200 hover:border-brand-500"
                }`}
              >{p}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatKRW } from "@/lib/utils";
import SalesChart from "@/components/admin/SalesChart";
import { getLowStockThreshold } from "@/lib/notify";
import { PageHeader, AdminCard, StatCard, EmptyState, StatusBadge, DataTable } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

function fmtDay(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "default" | "purple"> = {
  PENDING: "default",
  PAID: "info",
  PREPARING: "warning",
  SHIPPED: "purple",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "danger",
  PARTIALLY_REFUNDED: "danger",
};

export default async function AdminDashboardPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const lowStockThreshold = getLowStockThreshold();

  const today = startOfDay(new Date());
  const since = new Date(today);
  since.setDate(since.getDate() - 29);

  const todayStart = today;
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    productCount, activeProductCount, outOfStockCount,
    orderCount, paidOrderCount, totalRevenue,
    todayOrders, todayRevenue,
    pendingOrders, supportOpen,
    recentOrders, recentPaid, lowStockProducts,
    userCount,
  ] = await Promise.all([
    prisma.product.count().catch(() => 0),
    prisma.product.count({ where: { isActive: true } }).catch(() => 0),
    prisma.product.count({ where: { stock: 0, isActive: true } }).catch(() => 0),
    prisma.order.count().catch(() => 0),
    prisma.order.count({ where: { status: "PAID" } }).catch(() => 0),
    prisma.order.aggregate({ where: { status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } }, _sum: { totalAmount: true } }).catch(() => ({ _sum: { totalAmount: 0 } })),
    prisma.order.count({ where: { createdAt: { gte: todayStart, lt: tomorrow } } }).catch(() => 0),
    prisma.order.aggregate({
      where: { paidAt: { gte: todayStart, lt: tomorrow }, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } },
      _sum: { totalAmount: true },
    }).catch(() => ({ _sum: { totalAmount: 0 } })),
    prisma.order.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }).catch(() => 0),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { items: true } }).catch(() => []),
    prisma.order.findMany({
      where: { status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] }, paidAt: { gte: since } },
      select: { paidAt: true, totalAmount: true },
    }).catch(() => []),
    prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0, lte: lowStockThreshold } },
      orderBy: { stock: "asc" },
      take: 8,
      select: { id: true, name: true, sku: true, stock: true, lowStockThreshold: true },
    }).catch(() => []),
    prisma.user.count().catch(() => 0),
  ]);

  const buckets: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(since); d.setDate(d.getDate() + i);
    buckets[fmtDay(d)] = { revenue: 0, orders: 0 };
  }
  for (const o of recentPaid) {
    if (!o.paidAt) continue;
    const k = fmtDay(o.paidAt);
    if (buckets[k]) {
      buckets[k].revenue += o.totalAmount;
      buckets[k].orders += 1;
    }
  }
  const chartData = Object.entries(buckets).map(([date, v]) => ({ date, ...v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="대시보드"
        desc="오늘의 매출과 주요 지표를 한눈에 확인하세요."
        actions={
          <>
            <Link href="/admin/products/new" className="btn-primary text-sm">+ 상품 등록</Link>
            <Link href="/admin/notices" className="btn-outline text-sm hidden sm:inline-flex">공지 작성</Link>
          </>
        }
      />

      {/* 오늘의 KPI */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">오늘 ({fmtDay(today)})</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="오늘 매출" value={formatKRW(todayRevenue._sum.totalAmount || 0)} sub="결제완료 기준" icon="💰" tone="success" href="/admin/orders?status=PAID" />
          <StatCard label="오늘 주문" value={todayOrders.toLocaleString()} sub="신규 발생" icon="🧾" tone="info" href="/admin/orders" />
          <StatCard label="결제대기" value={pendingOrders.toLocaleString()} sub="입금/취소 대상" icon="⏳" tone={pendingOrders > 0 ? "warning" : "default"} href="/admin/orders?status=PENDING" />
          <StatCard label="미답변 문의" value={supportOpen.toLocaleString()} sub="OPEN/PENDING" icon="💌" tone={supportOpen > 0 ? "warning" : "default"} href="/admin/support" />
        </div>
      </div>

      {/* 누적 KPI */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">누적</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="누적 매출" value={formatKRW(totalRevenue._sum.totalAmount || 0)} sub="결제완료 이상" icon="📈" href="/admin/reports" />
          <StatCard label="전체 주문" value={orderCount.toLocaleString()} sub={`결제완료 ${paidOrderCount}`} icon="📦" href="/admin/orders" />
          <StatCard label="회원 수" value={userCount.toLocaleString()} sub="누적 가입" icon="👤" href="/admin/users" />
          <StatCard label="품절 상품" value={outOfStockCount.toLocaleString()} sub={`전체 상품 ${activeProductCount}/${productCount}`} icon="⚠️" tone={outOfStockCount > 0 ? "danger" : "default"} href="/admin/stock" />
        </div>
      </div>

      {/* 매출 차트 */}
      <AdminCard title="최근 30일 매출 추이" desc="결제완료 기준 일자별 매출/주문 수">
        <SalesChart data={chartData} />
      </AdminCard>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <AdminCard
          title="최근 주문"
          actions={<Link href="/admin/orders" className="text-sm text-gray-500 hover:text-brand-600">전체보기 →</Link>}
          noPadding
        >
          <DataTable
            columns={[
              { key: "no", label: "주문번호", cell: (o: any) => (
                <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-brand-600 hover:underline">{o.orderNo}</Link>
              ) },
              { key: "recipient", label: "받는분", cell: (o: any) => o.recipient },
              { key: "items", label: "상품", cell: (o: any) => (
                <span className="text-gray-600 text-xs">
                  {o.items[0]?.name}{o.items.length > 1 && ` 외 ${o.items.length - 1}건`}
                </span>
              ) },
              { key: "amount", label: "금액", align: "right", cell: (o: any) => (
                <span className="font-bold">{formatKRW(o.totalAmount)}</span>
              ) },
              { key: "status", label: "상태", align: "center", cell: (o: any) => (
                <StatusBadge label={o.status} tone={STATUS_TONE[o.status] || "default"} />
              ) },
              { key: "date", label: "일시", align: "right", cell: (o: any) => (
                <span className="text-gray-500 text-xs">{o.createdAt.toLocaleDateString("ko-KR")}</span>
              ) },
            ]}
            rows={recentOrders}
            rowKey={(o: any) => o.id}
            empty={<EmptyState icon="🧾" title="주문이 없습니다." desc="첫 주문이 들어오면 여기에 표시됩니다." />}
          />
        </AdminCard>

        <AdminCard
          title="재고 부족 ⚠️"
          actions={<span className="text-[11px] text-gray-400">기준 ≤ {lowStockThreshold}</span>}
          noPadding
        >
          {lowStockProducts.length === 0 ? (
            <EmptyState icon="✅" title="재고 부족 상품이 없습니다." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {lowStockProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <Link href={`/admin/products/${p.id}/edit`} className="truncate hover:text-brand-600 flex-1 min-w-0">{p.name}</Link>
                  <span className={`ml-3 font-bold tabular-nums ${p.stock <= 3 ? "text-rose-600" : "text-amber-600"}`}>{p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      {/* 빠른 액션 */}
      <AdminCard title="빠른 액션">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { href: "/admin/products/new", label: "상품 등록", icon: "➕" },
            { href: "/admin/orders?status=PAID", label: "출고 처리", icon: "📦" },
            { href: "/admin/coupons", label: "쿠폰 발급", icon: "🎟" },
            { href: "/admin/notices", label: "공지 작성", icon: "📢" },
            { href: "/admin/site", label: "사이트 편집", icon: "🎨" },
            { href: "/admin/reports", label: "매출 리포트", icon: "📈" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center justify-center gap-1 py-4 rounded-lg border border-gray-200 hover:border-brand-500 hover:bg-brand-50/30 transition-colors"
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs text-gray-700 font-medium">{a.label}</span>
            </Link>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import {
  monthRange, currentYearMonth,
  getSummary, getDaily, getProviderBreakdown,
  getTopProducts, getCategoryBreakdown,
} from "@/lib/reports";
import { formatKRW } from "@/lib/utils";
import ReportFilters from "./ReportFilters";
import RevenueChart from "./RevenueChart";
import ExcelDownloadButton from "./ExcelDownloadButton";

export const dynamic = "force-dynamic";

type SP = { month?: string; from?: string; to?: string };

function formatRangeLabel(month: string, from?: string, to?: string) {
  if (from && to) return `${from} ~ ${to}`;
  return `${month.replace("-", "년 ")}월`;
}

export default async function AdminReportsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const month = searchParams.month || currentYearMonth();
  const fromStr = searchParams.from;
  const toStr = searchParams.to;

  let range;
  if (fromStr && toStr) {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    range = { from, to };
  } else {
    range = monthRange(month);
  }

  const [summary, daily, providers, topProducts, categories] = await Promise.all([
    getSummary(range),
    getDaily(range),
    getProviderBreakdown(range),
    getTopProducts(range, 20),
    getCategoryBreakdown(range),
  ]);

  const t = summary.totals;
  const cards = [
    { label: "총매출", value: formatKRW(t.grossRevenue), sub: `주문 ${t.orderCount.toLocaleString()}건`, color: "text-brand-700" },
    { label: "환불액", value: "-" + formatKRW(t.refundedAmount), sub: `취소/환불 ${t.refundedOrderCount.toLocaleString()}건`, color: "text-red-500" },
    { label: "순매출", value: formatKRW(t.netRevenue), sub: "총매출 - 환불액", color: "text-emerald-600" },
    { label: "객단가", value: formatKRW(t.averageOrderValue), sub: "주문당 평균", color: "text-gray-800" },
  ];

  return (
    <div className="space-y-5">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">매출 리포트</span>
      </nav>

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">매출 정산 리포트</h1>
          <p className="text-xs text-gray-500 mt-1">
            {formatRangeLabel(month, fromStr, toStr)} 기준 · 결제완료 이상 주문만 집계
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <ReportFilters initialMonth={month} initialFrom={fromStr} initialTo={toStr} />
          <ExcelDownloadButton month={month} from={fromStr} to={toStr} />
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded border border-gray-200 p-5">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className={`mt-1 text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="mt-1 text-[11px] text-gray-400">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* 부가 항목 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <SmallCard label="배송비 합계" value={formatKRW(t.shippingFee)} />
        <SmallCard label="쿠폰 할인" value={"-" + formatKRW(t.couponDiscount)} negative />
        <SmallCard label="적립금 사용" value={"-" + formatKRW(t.pointUsed)} negative />
        <SmallCard label="적립금 적립" value={formatKRW(t.pointEarned)} />
      </div>

      {/* 일별 차트 */}
      <RevenueChart data={daily.map((d) => ({
        date: d.date.slice(5),  // MM-DD
        revenue: d.netRevenue,
        orders: d.orderCount,
      }))} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 결제수단별 */}
        <Section title={`결제수단별 (${providers.length})`}>
          {providers.length === 0 ? (
            <Empty />
          ) : (
            <SimpleTable
              headers={["결제수단", "주문수", "매출", "비중"]}
              rows={providers.map((p) => [
                p.provider,
                `${p.orderCount.toLocaleString()}`,
                formatKRW(p.amount),
                t.grossRevenue > 0 ? `${((p.amount / t.grossRevenue) * 100).toFixed(1)}%` : "-",
              ])}
              alignRight={[1, 2, 3]}
            />
          )}
        </Section>

        {/* 카테고리별 */}
        <Section title={`카테고리별 (${categories.length})`}>
          {categories.length === 0 ? (
            <Empty />
          ) : (
            <SimpleTable
              headers={["카테고리", "수량", "매출", "비중"]}
              rows={categories.slice(0, 10).map((c) => [
                c.name,
                `${c.orderItemCount.toLocaleString()}`,
                formatKRW(c.amount),
                t.grossRevenue > 0 ? `${((c.amount / t.grossRevenue) * 100).toFixed(1)}%` : "-",
              ])}
              alignRight={[1, 2, 3]}
            />
          )}
        </Section>
      </div>

      {/* 상품 TOP 20 */}
      <Section title={`상품 매출 TOP 20`}>
        {topProducts.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 w-12">순위</th>
                  <th className="text-left px-3 py-2">상품명</th>
                  <th className="text-left px-3 py-2 w-28">SKU</th>
                  <th className="text-left px-3 py-2 w-24">카테고리</th>
                  <th className="text-right px-3 py-2 w-20">수량</th>
                  <th className="text-right px-3 py-2 w-32">매출</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.productId} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/products/${p.productId}/edit`} className="hover:text-brand-600">{p.name}</Link>
                      {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{p.category}</td>
                    <td className="px-3 py-2 text-right">{p.quantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold">{formatKRW(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function SmallCard({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="bg-white rounded border border-gray-200 px-4 py-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`mt-0.5 font-bold ${negative ? "text-amber-600" : "text-gray-800"}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 font-bold text-sm">{title}</div>
      <div>{children}</div>
    </section>
  );
}

function Empty() {
  return <div className="p-8 text-center text-gray-500 text-sm">데이터가 없습니다.</div>;
}

function SimpleTable({ headers, rows, alignRight }: { headers: string[]; rows: (string | number)[][]; alignRight?: number[] }) {
  const right = new Set(alignRight || []);
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-gray-600 text-xs">
        <tr>
          {headers.map((h, i) => (
            <th key={i} className={`px-3 py-2 ${right.has(i) ? "text-right" : "text-left"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-gray-100">
            {r.map((c, j) => (
              <td key={j} className={`px-3 py-2 ${right.has(j) ? "text-right" : ""}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma, OrderStatus } from "@prisma/client";
import { formatKRW } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/order-status";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const PAGE_SIZE = 20;

const STATUSES: (OrderStatus | "")[] = ["", "PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"];

export default async function AdminOrdersPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const q = (searchParams.q as string) || "";
  const status = (searchParams.status as string) || "";
  const from = (searchParams.from as string) || "";
  const to = (searchParams.to as string) || "";
  const page = Math.max(1, parseInt((searchParams.page as string) || "1", 10));

  const where: Prisma.OrderWhereInput = {};
  if (q) where.OR = [
    { orderNo: { contains: q, mode: "insensitive" } },
    { recipient: { contains: q, mode: "insensitive" } },
    { phone: { contains: q } },
  ];
  if (status) where.status = status as OrderStatus;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [items, total, summary] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { items: true },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = Object.fromEntries(summary.map((s: any) => [s.status, s._count._all]));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">주문 관리</h1>
          <p className="text-xs text-gray-500 mt-1">총 {total.toLocaleString()}건</p>
        </div>
      </div>

      {/* 상태 요약 탭 */}
      <div className="bg-white rounded border border-gray-200 p-3 flex flex-wrap gap-2 text-xs">
        <Link
          href="/admin/orders"
          className={`px-3 py-1.5 rounded ${!status ? "bg-brand-500 text-white" : "bg-gray-50 hover:bg-gray-100 text-gray-600"}`}
        >
          전체 <span className="ml-1 opacity-70">({total})</span>
        </Link>
        {STATUSES.filter((s) => s).map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`px-3 py-1.5 rounded ${status === s ? "bg-brand-500 text-white" : "bg-gray-50 hover:bg-gray-100 text-gray-600"}`}
          >
            {ORDER_STATUS_LABEL[s as OrderStatus]} <span className="ml-1 opacity-70">({counts[s as string] || 0})</span>
          </Link>
        ))}
      </div>

      {/* 검색바 */}
      <form className="bg-white rounded border border-gray-200 p-4 grid grid-cols-1 lg:grid-cols-[1fr_160px_160px_auto] gap-2 items-end">
        <div>
          <label className="label">검색어</label>
          <input name="q" defaultValue={q} placeholder="주문번호, 받는분, 전화번호" className="input h-9" />
        </div>
        <div>
          <label className="label">시작일</label>
          <input name="from" type="date" defaultValue={from} className="input h-9" />
        </div>
        <div>
          <label className="label">종료일</label>
          <input name="to" type="date" defaultValue={to} className="input h-9" />
        </div>
        <div className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <button type="submit" className="btn-primary h-9 text-sm">검색</button>
          <Link href="/admin/orders" className="btn-outline h-9 text-sm">초기화</Link>
        </div>
      </form>

      {/* 테이블 */}
      <div className="bg-white rounded border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2.5 w-44">주문번호</th>
              <th className="text-left px-3 py-2.5">상품</th>
              <th className="text-left px-3 py-2.5 w-28">받는분</th>
              <th className="text-right px-3 py-2.5 w-28">금액</th>
              <th className="text-center px-3 py-2.5 w-24">결제수단</th>
              <th className="text-center px-3 py-2.5 w-24">상태</th>
              <th className="text-right px-3 py-2.5 w-32">주문일시</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">주문 내역이 없습니다.</td></tr>
            ) : (
              items.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                      {o.orderNo}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    <span className="line-clamp-1">{o.items[0]?.name}{o.items.length > 1 && ` 외 ${o.items.length - 1}건`}</span>
                  </td>
                  <td className="px-3 py-2.5">{o.recipient}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{formatKRW(o.totalAmount)}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-gray-600">{o.provider || "-"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${ORDER_STATUS_COLOR[o.status]}`}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-gray-500">
                    {o.createdAt.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: totalPages }).slice(0, 20).map((_, i) => {
            const n = i + 1;
            return (
              <Link
                key={n}
                href={{ query: { ...searchParams, page: n } }}
                className={`min-w-9 h-9 px-3 inline-flex items-center justify-center rounded text-sm border ${
                  n === page ? "bg-brand-500 text-white border-brand-500" : "bg-white text-gray-700 border-gray-200 hover:border-brand-500"
                }`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

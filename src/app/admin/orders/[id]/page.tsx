import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatKRW } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/order-status";
import OrderActions from "./OrderActions";
import TrackingViewer from "@/components/TrackingViewer";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, user: true },
  });
  if (!order) notFound();

  const subtotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0);

  return (
    <div className="space-y-4">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <Link href="/admin/orders" className="hover:text-brand-600">주문 관리</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">{order.orderNo}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-3">
            주문 상세
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${ORDER_STATUS_COLOR[order.status]}`}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-mono">{order.orderNo}</p>
        </div>
        <Link href="/admin/orders" className="btn-outline text-sm">목록으로</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          {/* 주문 상품 */}
          <Section title="주문 상품">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2">상품명</th>
                  <th className="text-right py-2 w-24">단가</th>
                  <th className="text-right py-2 w-16">수량</th>
                  <th className="text-right py-2 w-28">합계</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-50">
                    <td className="py-2.5">
                      <Link href={`/products/${it.productId}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600">
                        {it.name}
                      </Link>
                    </td>
                    <td className="text-right">{formatKRW(it.price)}</td>
                    <td className="text-right">{it.quantity}</td>
                    <td className="text-right font-bold">{formatKRW(it.price * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* 결제 정보 */}
          <Section title="결제 정보">
            <dl className="text-sm space-y-1.5">
              <Row label="상품금액">{formatKRW(subtotal)}</Row>
              <Row label="배송비">{order.shippingFee === 0 ? "무료" : formatKRW(order.shippingFee)}</Row>
              <Row label="총 결제금액" bold>{formatKRW(order.totalAmount)}</Row>
              <Row label="결제수단">{order.provider || "-"}</Row>
              <Row label="PG 거래번호">{order.providerTxnId ? <span className="font-mono text-xs">{order.providerTxnId}</span> : "-"}</Row>
              <Row label="결제일시">{order.paidAt ? order.paidAt.toLocaleString("ko-KR") : "-"}</Row>
            </dl>
          </Section>

          {/* 배송 정보 */}
          <Section title="배송지 정보">
            <dl className="text-sm space-y-1.5">
              <Row label="받는분">{order.recipient}</Row>
              <Row label="연락처">{order.phone}</Row>
              <Row label="우편번호">{order.zipCode}</Row>
              <Row label="주소">{order.address1} {order.address2}</Row>
              <Row label="배송메모">{order.memo || "-"}</Row>
            </dl>
          </Section>

          {/* 배송 추적 */}
          {order.courier && order.trackingNo && (
            <Section title="배송 추적">
              <TrackingViewer courier={order.courier} invoice={order.trackingNo} />
            </Section>
          )}

          {/* 주문자 / 일시 */}
          <Section title="주문자 / 일시">
            <dl className="text-sm space-y-1.5">
              <Row label="주문자">
                {order.user ? (
                  <Link href={`/admin/users/${order.user.id}`} className="text-brand-600 hover:underline">
                    {order.user.name} ({order.user.email})
                  </Link>
                ) : "비회원"}
              </Row>
              <Row label="주문일시">{order.createdAt.toLocaleString("ko-KR")}</Row>
              <Row label="배송일시">{order.shippedAt?.toLocaleString("ko-KR") || "-"}</Row>
              <Row label="완료일시">{order.deliveredAt?.toLocaleString("ko-KR") || "-"}</Row>
              <Row label="취소일시">{order.cancelledAt?.toLocaleString("ko-KR") || "-"}</Row>
            </dl>
          </Section>
        </div>

        {/* 사이드: 처리 액션 */}
        <div>
          <OrderActions
            id={order.id}
            status={order.status}
            courier={order.courier}
            trackingNo={order.trackingNo}
            adminMemo={order.adminMemo}
          />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded border border-gray-200 p-5">
      <h2 className="font-bold text-sm pb-3 mb-3 border-b border-gray-100">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children, bold }: { label: string; children: React.ReactNode; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "pt-2 border-t border-gray-100 mt-2 font-bold" : ""}`}>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-800">{children}</dd>
    </div>
  );
}

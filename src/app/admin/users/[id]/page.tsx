import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatKRW } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/order-status";
import { getAdminEmails, requireAdmin } from "@/lib/admin-guard";
import UserRoleEditor from "./UserRoleEditor";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      addresses: { orderBy: { isDefault: "desc" } },
      orders: { orderBy: { createdAt: "desc" }, take: 50, include: { items: true } },
    },
  });
  if (!user) notFound();

  const totalPaid = user.orders
    .filter((o) => o.status === "PAID" || o.status === "PREPARING" || o.status === "SHIPPED" || o.status === "DELIVERED")
    .reduce((s, o) => s + o.totalAmount, 0);

  const isAdminByEnv = getAdminEmails().includes(user.email.toLowerCase());
  const isAdmin = isAdminByEnv || user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  return (
    <div className="space-y-4">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <Link href="/admin/users" className="hover:text-brand-600">회원 관리</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">{user.email}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          {user.name}
          {isAdmin && <span className="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 font-bold">ADMIN</span>}
        </h1>
        <Link href="/admin/users" className="btn-outline text-sm">목록으로</Link>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="총 주문수" value={user.orders.length.toString()} />
        <SummaryCard label="누적 결제금액" value={formatKRW(totalPaid)} />
        <SummaryCard label="가입일" value={user.createdAt.toLocaleDateString("ko-KR")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* 주문 내역 */}
        <section className="bg-white rounded border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 font-bold text-sm">주문 내역 ({user.orders.length})</div>
          {user.orders.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">주문 내역이 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">주문번호</th>
                  <th className="text-left px-3 py-2">상품</th>
                  <th className="text-right px-3 py-2 w-24">금액</th>
                  <th className="text-center px-3 py-2 w-24">상태</th>
                  <th className="text-right px-3 py-2 w-28">일시</th>
                </tr>
              </thead>
              <tbody>
                {user.orders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/admin/orders/${o.id}`} className="text-brand-600 hover:underline">{o.orderNo}</Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <span className="line-clamp-1">{o.items[0]?.name}{o.items.length > 1 && ` 외 ${o.items.length - 1}건`}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{formatKRW(o.totalAmount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${ORDER_STATUS_COLOR[o.status]}`}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      {o.createdAt.toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 회원 정보 + 주소 */}
        <aside className="space-y-4">
          <section className="bg-white rounded border border-gray-200 p-5">
            <h2 className="font-bold text-sm pb-3 mb-3 border-b border-gray-100">회원 정보</h2>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between"><dt className="text-gray-500">이메일</dt><dd className="text-gray-800 truncate ml-2">{user.email}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">이름</dt><dd className="text-gray-800">{user.name}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">연락처</dt><dd className="text-gray-800">{user.phone || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">권한</dt>
                <dd>{isAdmin ? <span className="text-purple-600 font-bold">관리자</span> : <span className="text-gray-700">일반</span>}</dd>
              </div>
              <div className="flex justify-between"><dt className="text-gray-500">가입일</dt>
                <dd className="text-gray-800 text-xs">{user.createdAt.toLocaleString("ko-KR")}</dd>
              </div>
            </dl>
          </section>

          <section className="bg-white rounded border border-gray-200 p-5">
            <h2 className="font-bold text-sm pb-3 mb-3 border-b border-gray-100">권한/상태 관리</h2>
            <UserRoleEditor
              userId={user.id}
              currentRole={user.role as any}
              currentStatus={user.status as any}
            />
            {isAdmin && (
              <p className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
                .env 의 <code className="font-mono">ADMIN_EMAILS</code> 에 포함된 계정은 자동으로 ADMIN 으로 부트스트랩됩니다.
              </p>
            )}
          </section>

          <section className="bg-white rounded border border-gray-200 p-5">
            <h2 className="font-bold text-sm pb-3 mb-3 border-b border-gray-100">배송지 ({user.addresses.length})</h2>
            {user.addresses.length === 0 ? (
              <p className="text-xs text-gray-500">등록된 배송지가 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {user.addresses.map((a) => (
                  <li key={a.id} className="text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-800">{a.recipient}</span>
                      {a.isDefault && <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-bold">기본</span>}
                    </div>
                    <div className="text-gray-600">{a.phone}</div>
                    <div className="text-gray-600 mt-1">[{a.zipCode}] {a.address1} {a.address2}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-800">{value}</div>
    </div>
  );
}

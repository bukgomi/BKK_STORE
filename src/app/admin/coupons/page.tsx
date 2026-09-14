import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatKRW } from "@/lib/utils";
import DeleteCouponButton from "./DeleteCouponButton";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">쿠폰 관리</h1>
          <p className="text-xs text-gray-500 mt-1">총 {coupons.length}개 쿠폰</p>
        </div>
        <Link href="/admin/coupons/new" className="btn-primary text-sm">+ 쿠폰 생성</Link>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2.5">쿠폰명 / 코드</th>
              <th className="text-right px-3 py-2.5 w-28">할인</th>
              <th className="text-right px-3 py-2.5 w-28">최소주문</th>
              <th className="text-center px-3 py-2.5 w-44">유효기간</th>
              <th className="text-right px-3 py-2.5 w-24">발급/사용</th>
              <th className="text-center px-3 py-2.5 w-24">상태</th>
              <th className="text-center px-3 py-2.5 w-32">액션</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">등록된 쿠폰이 없습니다.</td></tr>
            ) : (
              coupons.map((c) => {
                const expired = c.validUntil < now;
                const notStarted = c.validFrom > now;
                return (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{c.code}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-brand-600">
                      {c.discountType === "PERCENT" ? `${c.discountValue}%` : formatKRW(c.discountValue)}
                      {c.maxDiscount && <div className="text-[10px] text-gray-400 font-normal">최대 {formatKRW(c.maxDiscount)}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right">{c.minOrderAmount > 0 ? formatKRW(c.minOrderAmount) : "-"}</td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      {c.validFrom.toLocaleDateString("ko-KR")} ~ {c.validUntil.toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {c.issuedCount} / {c.totalQuantity ?? "∞"}
                      <div className="text-gray-400">사용 {c.usedCount}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {!c.isActive ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">비활성</span>
                      ) : expired ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-600">기간만료</span>
                      ) : notStarted ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700">예정</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700">활성</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      <Link href={`/admin/coupons/${c.id}/edit`} className="text-brand-600 hover:underline mr-2">수정</Link>
                      <DeleteCouponButton id={c.id} name={c.name} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

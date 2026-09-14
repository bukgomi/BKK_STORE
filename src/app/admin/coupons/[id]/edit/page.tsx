import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CouponForm, { type CouponFormValue } from "@/components/admin/CouponForm";

export const dynamic = "force-dynamic";

export default async function EditCouponPage({ params }: { params: { id: string } }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const coupon = await prisma.coupon.findUnique({ where: { id: params.id } });
  if (!coupon) notFound();

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const initial: CouponFormValue = {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    description: coupon.description || "",
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderAmount: coupon.minOrderAmount,
    maxDiscount: coupon.maxDiscount,
    totalQuantity: coupon.totalQuantity,
    validFrom: fmt(coupon.validFrom),
    validUntil: fmt(coupon.validUntil),
    isActive: coupon.isActive,
  };

  return (
    <div className="space-y-4">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <Link href="/admin/coupons" className="hover:text-brand-600">쿠폰 관리</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">수정</span>
      </nav>
      <h1 className="text-xl font-bold">쿠폰 수정</h1>
      <p className="text-xs text-gray-500">현재 발급/사용 현황: 발급 {coupon.issuedCount}건 / 사용 {coupon.usedCount}건</p>
      <CouponForm mode="edit" initial={initial} />
    </div>
  );
}

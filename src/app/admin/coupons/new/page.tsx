import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import CouponForm, { type CouponFormValue } from "@/components/admin/CouponForm";

export const dynamic = "force-dynamic";

function suggestCode(): string {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `COUP-${ym}-${rand}`;
}

export default async function NewCouponPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const today = new Date();
  const monthLater = new Date(); monthLater.setMonth(monthLater.getMonth() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const initial: CouponFormValue = {
    code: suggestCode(),
    name: "",
    description: "",
    discountType: "FIXED",
    discountValue: "",
    minOrderAmount: 0,
    maxDiscount: null,
    totalQuantity: null,
    validFrom: fmt(today),
    validUntil: fmt(monthLater),
    isActive: true,
  };

  return (
    <div className="space-y-4">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <Link href="/admin/coupons" className="hover:text-brand-600">쿠폰 관리</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">쿠폰 생성</span>
      </nav>
      <h1 className="text-xl font-bold">쿠폰 생성</h1>
      <CouponForm mode="create" initial={initial} />
    </div>
  );
}

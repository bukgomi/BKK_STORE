"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShippingPolicy } from "@/lib/use-shipping-policy";
import { calcShippingFee, formatMin } from "@/lib/shipping";
import { useEffect, useState } from "react";
import { useCart, cartKeyOf } from "@/store/cart";
import { formatKRW } from "@/lib/utils";

export default function CartPage() {
  const router = useRouter();
  const { items, setQty, remove, clear, totalPrice } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const policy = useShippingPolicy();

  if (!mounted) return null;

  const subtotal = totalPrice();
  const shipping = calcShippingFee(subtotal, policy);
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="container-mall py-20 text-center">
        <h1 className="text-xl font-bold mb-4">장바구니</h1>
        <p className="text-gray-500 mb-6">장바구니가 비어 있습니다.</p>
        <Link href="/products" className="btn-primary">상품 둘러보기</Link>
      </div>
    );
  }

  return (
    <div className="container-mall py-6">
      <h1 className="text-xl font-bold mb-6">장바구니 ({items.length})</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <table className="w-full border-t-2 border-gray-800 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="border-b border-gray-200">
                <th className="py-3 text-left pl-4">상품정보</th>
                <th className="py-3 w-32">수량</th>
                <th className="py-3 w-32">금액</th>
                <th className="py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const key = cartKeyOf(it);
                return (
                  <tr key={key} className="border-b border-gray-200">
                    <td className="py-4 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden border border-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={it.thumbnail || "/images/placeholder.svg"} alt={it.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="max-w-[300px]">
                          <Link href={`/products/${it.productId}`} className="hover:text-brand-600 line-clamp-2">
                            {it.name}
                          </Link>
                          {it.variantName && (
                            <div className="mt-1 text-xs text-gray-500">옵션: {it.variantName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => setQty(key, it.quantity - 1)} className="w-7 h-7 border border-gray-300 rounded">−</button>
                        <input
                          value={it.quantity}
                          onChange={(e) => setQty(key, parseInt(e.target.value || "1", 10) || 1)}
                          className="w-12 h-7 border border-gray-300 rounded text-center"
                        />
                        <button onClick={() => setQty(key, it.quantity + 1)} className="w-7 h-7 border border-gray-300 rounded">+</button>
                      </div>
                    </td>
                    <td className="text-center font-bold">{formatKRW(it.price * it.quantity)}</td>
                    <td className="text-center">
                      <button onClick={() => remove(key)} className="text-gray-400 hover:text-red-500">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-3 flex justify-between text-sm">
            <button onClick={clear} className="text-gray-500 hover:text-red-500">전체 삭제</button>
            <Link href="/products" className="text-gray-500 hover:text-brand-600">계속 쇼핑하기 →</Link>
          </div>
        </div>

        {/* 결제 요약 */}
        <aside className="border border-gray-200 rounded p-5 h-fit sticky top-32">
          <h3 className="font-bold mb-4">결제 예정 금액</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">상품금액</dt><dd>{formatKRW(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">배송비</dt><dd>{shipping === 0 ? "무료" : formatKRW(shipping)}</dd></div>
          </dl>
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-baseline">
            <span className="text-sm font-bold">총 결제금액</span>
            <span className="text-2xl font-bold text-brand-700">{formatKRW(total)}</span>
          </div>
          <button onClick={() => router.push("/checkout")} className="btn-primary w-full h-12 mt-4 text-base">
            주문하기
          </button>
          <p className="mt-2 text-[11px] text-gray-400">{formatMin(policy.freeShippingMin, "만")} 이상 구매시 배송비 무료 · 쿠폰/적립금은 결제 단계에서 적용</p>
        </aside>
      </div>
    </div>
  );
}

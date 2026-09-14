"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useShippingPolicy } from "@/lib/use-shipping-policy";
import { calcShippingFee } from "@/lib/shipping";
import { useCart } from "@/store/cart";
import { toast } from "@/store/toast";
import { formatKRW } from "@/lib/utils";
import AddressSearch from "@/components/AddressSearch";

type Provider = "TOSS" | "INICIS" | "NAVERPAY";

const PROVIDERS: { value: Provider; label: string; desc: string }[] = [
  { value: "TOSS", label: "토스페이먼츠", desc: "신용/체크카드, 가상계좌, 간편결제" },
  { value: "INICIS", label: "KG이니시스", desc: "신용카드, 실시간계좌이체, 휴대폰결제" },
  { value: "NAVERPAY", label: "네이버페이", desc: "네이버 ID로 간편결제" },
];

type AvailCoupon = {
  id: string;          // userCouponId
  couponName: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  expiresAt: string;
};

type AvailMe = {
  pointBalance: number;
  coupons: AvailCoupon[];
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [memo, setMemo] = useState("");
  const [provider, setProvider] = useState<Provider>("TOSS");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  const [me, setMe] = useState<AvailMe | null>(null);
  const [selectedCouponId, setSelectedCouponId] = useState<string>("");
  const [pointInput, setPointInput] = useState<number>(0);

  useEffect(() => {
    fetch("/api/me/checkout-options")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setMe(d))
      .catch(() => {});
  }, []);

  // 모든 훅을 조건부 리턴 위에서 호출 (React hooks 규칙)
  const policy = useShippingPolicy();
  const subtotal = totalPrice();
  const shipping = calcShippingFee(subtotal, policy);

  const selectedCoupon = useMemo(
    () => me?.coupons.find((c) => c.id === selectedCouponId) || null,
    [me, selectedCouponId]
  );

  const couponDiscount = useMemo(() => {
    if (!selectedCoupon) return 0;
    if (subtotal < selectedCoupon.minOrderAmount) return 0;
    let d = 0;
    if (selectedCoupon.discountType === "PERCENT") {
      d = Math.floor(subtotal * selectedCoupon.discountValue / 100);
      if (selectedCoupon.maxDiscount && d > selectedCoupon.maxDiscount) d = selectedCoupon.maxDiscount;
    } else {
      d = selectedCoupon.discountValue;
    }
    return Math.min(d, subtotal);
  }, [selectedCoupon, subtotal]);

  // 빈 장바구니 자동 리다이렉트 (마운트 후)
  useEffect(() => {
    if (mounted && items.length === 0) {
      router.replace("/cart");
    }
  }, [mounted, items.length, router]);

  if (!mounted) return null;
  if (items.length === 0) return null;

  const maxPoint = Math.max(0, Math.min(me?.pointBalance ?? 0, subtotal - couponDiscount));
  const usedPoint = Math.max(0, Math.min(pointInput, maxPoint));

  const total = Math.max(0, subtotal - couponDiscount - usedPoint + shipping);

  const submit = async () => {
    if (loading) return; // 더블클릭 방어
    if (!recipient || !phone || !zipCode || !address1) {
      toast.warning("배송 정보를 모두 입력해주세요.");
      return;
    }
    if (!agree) {
      toast.warning("주문 내용을 확인하고 동의해주세요.");
      return;
    }

    setLoading(true);
    // 멱등키: 동일 주문 시도 중복 방지 (서버에서 lib/idempotency 로 검증)
    const idempotencyKey =
      (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let willRedirect = false;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId || null,
            quantity: i.quantity,
          })),
          recipient, phone, zipCode, address1, address2, memo, provider,
          userCouponId: selectedCouponId || null,
          pointUsed: usedPoint,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "주문 생성 실패");

      if (provider === "TOSS") {
        const { loadTossPayments } = await import("@/lib/payments/toss-client");
        willRedirect = true;
        await loadTossPayments({
          orderId: data.orderNo,
          orderName: items[0].name + (items.length > 1 ? ` 외 ${items.length - 1}건` : ""),
          amount: total,
          customerName: recipient,
        });
      } else if (provider === "INICIS") {
        const form = await (await fetch("/api/payments/inicis/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ orderNo: data.orderNo, amount: total, name: recipient, phone, items }),
        })).json();
        const { startInicisPay } = await import("@/lib/payments/inicis-client");
        willRedirect = true;
        await startInicisPay(form);
      } else if (provider === "NAVERPAY") {
        const naver = await (await fetch("/api/payments/naver/reserve", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ orderNo: data.orderNo, amount: total, items }),
        })).json();
        if (naver.redirectUrl) {
          willRedirect = true;
          window.location.href = naver.redirectUrl;
        } else {
          throw new Error(naver.error || "네이버페이 예약 실패");
        }
      }
    } catch (e: any) {
      toast.error(e.message || "주문 처리 중 오류가 발생했습니다.");
    } finally {
      // 외부 결제창/리다이렉트가 시작되지 않은 경우만 버튼 복구
      if (!willRedirect) setLoading(false);
    }
  };

  return (
    <div className="container-mall py-6">
      <h1 className="text-xl font-bold mb-6">주문/결제</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-8">
          {/* 주문상품 */}
          <section>
            <h2 className="font-bold mb-3 pb-2 border-b-2 border-gray-800">주문상품</h2>
            <ul className="divide-y divide-gray-200">
              {items.map((it, idx) => (
                <li key={idx} className="py-3 flex items-center gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.thumbnail || "/images/placeholder.svg"} alt={it.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm line-clamp-1">{it.name}</div>
                    <div className="text-xs text-gray-500">
                      {it.variantName && <span className="mr-2">옵션: {it.variantName}</span>}
                      <span>수량 {it.quantity}개</span>
                    </div>
                  </div>
                  <div className="font-bold text-sm">{formatKRW(it.price * it.quantity)}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* 배송정보 */}
          <section>
            <h2 className="font-bold mb-3 pb-2 border-b-2 border-gray-800">배송지</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">받는 분 *</label>
                <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              </div>
              <div>
                <label className="label">연락처 *</label>
                <input className="input" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="label">우편번호 *</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={zipCode} readOnly placeholder="우편번호 검색" />
                  <AddressSearch onSelect={({ zipCode: z, address1: a }) => { setZipCode(z); setAddress1(a); }} />
                </div>
              </div>
              <div>
                <label className="label">기본 주소 *</label>
                <input className="input" value={address1} readOnly placeholder="우편번호 검색을 먼저 진행하세요" />
              </div>
              <div className="col-span-2">
                <label className="label">상세 주소</label>
                <input className="input" value={address2} onChange={(e) => setAddress2(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">배송 메모</label>
                <input className="input" placeholder="예) 부재시 경비실에 맡겨주세요" value={memo} onChange={(e) => setMemo(e.target.value)} />
              </div>
            </div>
          </section>

          {/* 할인 적용 */}
          {me && (
            <section>
              <h2 className="font-bold mb-3 pb-2 border-b-2 border-gray-800">할인 적용</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">쿠폰</label>
                  <select className="input" value={selectedCouponId} onChange={(e) => setSelectedCouponId(e.target.value)}>
                    <option value="">사용 안함</option>
                    {me.coupons
                      .filter((c) => subtotal >= c.minOrderAmount)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.discountType === "PERCENT" ? `${c.discountValue}%` : formatKRW(c.discountValue)}] {c.couponName}
                          {c.minOrderAmount > 0 && ` (최소 ${formatKRW(c.minOrderAmount)})`}
                        </option>
                      ))}
                  </select>
                  {me.coupons.filter((c) => subtotal < c.minOrderAmount).length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      추가 {formatKRW(Math.min(...me.coupons.filter((c) => subtotal < c.minOrderAmount).map((c) => c.minOrderAmount - subtotal)))} 결제시 더 많은 쿠폰 사용 가능
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">
                    적립금 사용 <span className="text-xs text-gray-400 font-normal">(보유 {formatKRW(me.pointBalance)} · 사용가능 {formatKRW(maxPoint)})</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number" min={0} max={maxPoint} className="input flex-1"
                      value={pointInput}
                      onChange={(e) => setPointInput(Math.max(0, Math.min(maxPoint, parseInt(e.target.value || "0", 10) || 0)))}
                    />
                    <button type="button" onClick={() => setPointInput(maxPoint)} className="btn-outline text-xs h-10 px-3">전액 사용</button>
                    <button type="button" onClick={() => setPointInput(0)} className="btn-outline text-xs h-10 px-3">초기화</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 결제수단 */}
          <section>
            <h2 className="font-bold mb-3 pb-2 border-b-2 border-gray-800">결제수단</h2>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setProvider(p.value)}
                  className={`border rounded p-4 text-left transition-colors ${
                    provider === p.value ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <div className="font-bold">{p.label}</div>
                  <div className="text-xs text-gray-500 mt-1 leading-snug">{p.desc}</div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* 결제 요약 */}
        <aside className="border border-gray-200 rounded p-5 h-fit sticky top-32 bg-white">
          <h3 className="font-bold mb-4">결제 정보</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">상품금액</dt><dd>{formatKRW(subtotal)}</dd></div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-brand-600"><dt>쿠폰 할인</dt><dd>-{formatKRW(couponDiscount)}</dd></div>
            )}
            {usedPoint > 0 && (
              <div className="flex justify-between text-amber-600"><dt>적립금 사용</dt><dd>-{formatKRW(usedPoint)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-gray-500">배송비</dt><dd>{shipping === 0 ? "무료" : formatKRW(shipping)}</dd></div>
          </dl>
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-baseline">
            <span className="text-sm font-bold">최종 결제금액</span>
            <span className="text-2xl font-bold text-brand-700">{formatKRW(total)}</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-600">
            결제시 약 {formatKRW(Math.floor((subtotal - couponDiscount - usedPoint) * 0.01 / 10) * 10)} 적립 예정
          </p>

          <label className="mt-4 flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            <span>주문 내용을 확인하였으며, 결제진행에 동의합니다.</span>
          </label>

          <button onClick={submit} disabled={loading} className="btn-primary w-full h-12 mt-4 text-base">
            {loading ? "처리 중..." : `${formatKRW(total)} 결제하기`}
          </button>
          <p className="mt-2 text-[11px] text-gray-400 text-center">SSL/TLS 암호화 통신 · 결제정보는 PG사를 통해 안전하게 처리됩니다</p>
        </aside>
      </div>
    </div>
  );
}


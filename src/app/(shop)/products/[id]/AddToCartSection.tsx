"use client";
/**
 * 구매 패널 (스마트스토어 스타일)
 * - 옵션은 드롭다운으로 선택. 조합 옵션(optionType "combo:무게|색상")은 무게 → 색상 순서로 드롭다운이 이어진다.
 * - 선택한 옵션은 아래 목록에 쌓이고 수량을 조절한다.
 * - 버튼: [구매하기] 크게, 그 아래 [찜하기 | 장바구니]
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/store/cart";
import { toast } from "@/store/toast";
import { formatKRW } from "@/lib/utils";
import StockNotifyButton from "@/components/StockNotifyButton";
import WishlistButton from "@/components/WishlistButton";

type Variant = {
  id: string;
  name: string;
  colorHex?: string | null;
  optionType: string;
  stock: number;
  priceModifier: number;
  thumbnail?: string | null;
};

type Props = {
  product: {
    id: string;
    name: string;
    price: number;
    thumbnail?: string | null;
    stock: number;
  };
  variants: Variant[];
  wishlist: { initialActive: boolean; signedIn: boolean };
};

type SelectedItem = {
  variantId: string | null;
  variantName: string | null;
  unitPrice: number;
  stock: number;
  thumbnail?: string | null;
  quantity: number;
};

const SEP = " / ";

export default function AddToCartSection({ product, variants, wishlist }: Props) {
  const router = useRouter();
  const add = useCart((s) => s.add);

  const hasVariants = variants.length > 0;
  const optionLabel = (() => {
    const t = variants[0]?.optionType;
    if (t === "color") return "색상";
    if (t === "size") return "사이즈";
    if (t === "weight") return "무게";
    return "옵션";
  })();
  // 조합 옵션: optionType "combo:무게|색상", name "17g / LT13D"
  const comboTitles: string[] | null = (() => {
    const t = variants[0]?.optionType;
    if (!t || !t.startsWith("combo:") || !variants.every((v) => v.optionType === t)) return null;
    const titles = t.slice("combo:".length).split("|").map((s) => s.trim()).filter(Boolean);
    return titles.length >= 2 ? titles : null;
  })();
  const comboParts = (v: Variant) => v.name.split(SEP).map((s) => s.trim());
  const [comboPick, setComboPick] = useState<string[]>([]);
  const [singleQty, setSingleQty] = useState(1);
  const [selected, setSelected] = useState<SelectedItem[]>([]);

  const addVariant = (v: Variant) => {
    if (v.stock === 0) return;
    if (selected.find((s) => s.variantId === v.id)) { toast.info("이미 선택한 옵션입니다."); return; }
    setSelected((prev) => [
      ...prev,
      { variantId: v.id, variantName: v.name, unitPrice: product.price + v.priceModifier, stock: v.stock, thumbnail: v.thumbnail || product.thumbnail || null, quantity: 1 },
    ]);
  };

  /** i번째 그룹 선택지 (앞 그룹 선택과 일치하는 조합만) */
  const comboChoicesFor = (pick: string[], i: number) => {
    const seen = new Map<string, { inStock: boolean; extra: number }>();
    for (const v of variants) {
      const parts = comboParts(v);
      if (pick.slice(0, i).some((p, j) => parts[j] !== p)) continue;
      const val = parts[i];
      if (val == null) continue;
      const cur = seen.get(val);
      seen.set(val, { inStock: (cur?.inStock || false) || v.stock > 0, extra: cur?.extra ?? v.priceModifier });
    }
    return [...seen].map(([value, m]) => ({ value, ...m }));
  };
  /** 선택지가 하나뿐인 그룹은 자동 선택 */
  const resolvePick = (pick: string[]) => {
    const cur = [...pick];
    while (comboTitles && cur.length < comboTitles.length) {
      const ch = comboChoicesFor(cur, cur.length);
      if (ch.length === 1) cur.push(ch[0].value); else break;
    }
    return cur;
  };
  const effPick = comboTitles ? resolvePick(comboPick) : [];
  const pickCombo = (i: number, value: string) => {
    if (!value) { setComboPick(effPick.slice(0, i)); return; }
    const next = resolvePick([...effPick.slice(0, i), value]);
    if (comboTitles && next.length === comboTitles.length) {
      const v = variants.find((x) => comboParts(x).every((p, j) => p === next[j]));
      if (v) addVariant(v);
      setComboPick([]);
      return;
    }
    setComboPick(next);
  };

  const removeSelected = (variantId: string | null) => setSelected((prev) => prev.filter((s) => s.variantId !== variantId));
  const updateQty = (variantId: string | null, qty: number) =>
    setSelected((prev) => prev.map((s) => (s.variantId === variantId ? { ...s, quantity: Math.max(1, Math.min(qty, s.stock)) } : s)));

  const totalQty = hasVariants ? selected.reduce((n, s) => n + s.quantity, 0) : singleQty;
  const totalPrice = hasVariants ? selected.reduce((n, s) => n + s.quantity * s.unitPrice, 0) : product.price * singleQty;
  const allSoldOut = hasVariants ? variants.every((v) => v.stock === 0) : product.stock === 0;
  const canSubmit = hasVariants ? selected.length > 0 : product.stock > 0;

  const submit = (goCheckout: boolean) => {
    if (hasVariants) {
      if (selected.length === 0) { toast.warning("옵션을 선택해주세요."); return; }
      for (const s of selected) {
        add({ productId: product.id, variantId: s.variantId, variantName: s.variantName, name: product.name, price: s.unitPrice, thumbnail: s.thumbnail, quantity: s.quantity, stock: s.stock });
      }
    } else {
      if (product.stock === 0) return;
      add({ productId: product.id, variantId: null, variantName: null, name: product.name, price: product.price, thumbnail: product.thumbnail, quantity: singleQty, stock: product.stock });
    }
    if (goCheckout) router.push("/cart");
    else toast.success("장바구니에 담았어요!", { href: "/cart", hrefLabel: "장바구니" });
  };

  const selectCls = "w-full h-12 px-4 pr-10 rounded-lg border border-gray-300 bg-white text-[15px] text-gray-800 appearance-none focus:outline-none focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400";
  const chevron = (
    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </span>
  );

  return (
    <div className="mt-5 space-y-4">
      {/* ── 옵션 선택 ── */}
      {hasVariants && (
        <div>
          <div className="text-sm font-bold text-gray-900 mb-2">옵션 선택 (필수) <span className="text-red-500">*</span></div>
          <div className="space-y-2">
            {comboTitles ? (
              comboTitles.map((title, i) => {
                const enabled = i <= effPick.length;
                const choices = enabled ? comboChoicesFor(effPick, i) : [];
                const single = choices.length === 1;
                return (
                  <div key={title} className="relative">
                    <select
                      className={selectCls}
                      disabled={!enabled || single}
                      value={effPick[i] ?? ""}
                      onChange={(e) => pickCombo(i, e.target.value)}
                    >
                      <option value="">{title}{single ? "" : " 선택"}</option>
                      {choices.map((c) => (
                        <option key={c.value} value={c.value} disabled={!c.inStock}>
                          {c.value}{i === 0 && c.extra ? ` (${c.extra > 0 ? "+" : ""}${formatKRW(c.extra)})` : ""}{c.inStock ? "" : " (품절)"}
                        </option>
                      ))}
                    </select>
                    {chevron}
                  </div>
                );
              })
            ) : (
              <div className="relative">
                <select
                  className={selectCls}
                  value=""
                  onChange={(e) => { const v = variants.find((x) => x.id === e.target.value); if (v) addVariant(v); }}
                >
                  <option value="">{optionLabel} 선택</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.stock === 0}>
                      {v.name}{v.priceModifier ? ` (${v.priceModifier > 0 ? "+" : ""}${formatKRW(v.priceModifier)})` : ""}{v.stock === 0 ? " (품절)" : ""}
                    </option>
                  ))}
                </select>
                {chevron}
              </div>
            )}
          </div>

          {/* 선택한 옵션 목록 */}
          {selected.length > 0 && (
            <div className="mt-3 space-y-2">
              {selected.map((s) => (
                <div key={s.variantId} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-gray-800">{s.variantName}</span>
                    <button type="button" onClick={() => removeSelected(s.variantId)} aria-label="삭제" className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center border border-gray-300 rounded bg-white">
                      <button type="button" onClick={() => updateQty(s.variantId, s.quantity - 1)} className="w-8 h-8 text-gray-600 hover:bg-gray-100">−</button>
                      <input
                        value={s.quantity}
                        onChange={(e) => updateQty(s.variantId, parseInt(e.target.value || "1", 10) || 1)}
                        className="w-10 h-8 text-center text-sm border-x border-gray-300 outline-none"
                        aria-label="수량"
                      />
                      <button type="button" onClick={() => updateQty(s.variantId, s.quantity + 1)} className="w-8 h-8 text-gray-600 hover:bg-gray-100">+</button>
                    </div>
                    <div className="text-sm font-bold text-gray-900">{formatKRW(s.unitPrice * s.quantity)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 단일 상품 수량 ── */}
      {!hasVariants && (
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
          <span className="text-sm text-gray-700">수량</span>
          <div className="inline-flex items-center border border-gray-300 rounded bg-white">
            <button type="button" onClick={() => setSingleQty((q) => Math.max(1, q - 1))} disabled={product.stock === 0} className="w-8 h-8 text-gray-600 hover:bg-gray-100">−</button>
            <input
              value={singleQty}
              onChange={(e) => setSingleQty(Math.max(1, Math.min(product.stock || 1, parseInt(e.target.value || "1", 10) || 1)))}
              className="w-10 h-8 text-center text-sm border-x border-gray-300 outline-none"
              disabled={product.stock === 0}
              aria-label="수량"
            />
            <button type="button" onClick={() => setSingleQty((q) => Math.min(product.stock || 1, q + 1))} disabled={product.stock === 0} className="w-8 h-8 text-gray-600 hover:bg-gray-100">+</button>
          </div>
        </div>
      )}

      {/* ── 합계 ── */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <span className="text-sm text-gray-700">총 상품 금액 <span className="text-gray-400">({totalQty}개)</span></span>
        <span className="text-2xl font-extrabold text-gray-900">{formatKRW(totalPrice)}</span>
      </div>

      {/* ── 버튼 ── */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={!canSubmit}
          className="w-full h-14 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white text-lg font-bold transition-colors"
        >
          {allSoldOut ? "품절" : "구매하기"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <WishlistButton productId={product.id} initialActive={wishlist.initialActive} signedIn={wishlist.signedIn} variant="wide" />
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={!canSubmit}
            className="h-12 rounded-lg border border-gray-300 bg-white text-base font-medium text-gray-800 hover:border-gray-400 disabled:text-gray-400 flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            장바구니
          </button>
        </div>
        {allSoldOut && <StockNotifyButton productId={product.id} variantId={null} className="w-full" />}
      </div>
    </div>
  );
}

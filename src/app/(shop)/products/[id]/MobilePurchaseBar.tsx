"use client";
/**
 * 모바일 하단 고정 구매 바 (lg 미만에서만 표시)
 * - [찜] [장바구니] [구매하기] 가 항상 화면 아래에 붙어 있어 상세페이지를 보다가 바로 옵션을 고를 수 있다
 * - 장바구니/구매하기를 누르면 아래에서 옵션 시트가 올라오고, 그 안에 AddToCartSection 이 그대로 들어간다
 */
import { useEffect, useState } from "react";
import AddToCartSection from "./AddToCartSection";
import WishlistButton from "@/components/WishlistButton";
import { formatKRW } from "@/lib/utils";

type Props = Parameters<typeof AddToCartSection>[0];

export default function MobilePurchaseBar(props: Props) {
  const [open, setOpen] = useState(false);
  const { product, variants, wishlist } = props;
  const soldOut = variants.length > 0 ? variants.every((v) => v.stock === 0) : product.stock === 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* 하단 바 */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <WishlistButton productId={product.id} initialActive={wishlist.initialActive} signedIn={wishlist.signedIn} />
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={soldOut}
            className="flex-1 h-12 rounded-lg border border-gray-300 bg-white text-base font-medium text-gray-800 disabled:text-gray-400"
          >
            장바구니
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={soldOut}
            className="flex-[1.4] h-12 rounded-lg bg-brand-600 text-white text-base font-bold disabled:bg-gray-300"
          >
            {soldOut ? "품절" : `${formatKRW(product.price)} 구매하기`}
          </button>
        </div>
      </div>

      {/* 옵션 시트 */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" aria-label="닫기" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="sticky top-0 bg-white pt-3 pb-2">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate">{product.name}</div>
                  <div className="text-lg font-extrabold text-red-500">{formatKRW(product.price)}</div>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="text-2xl leading-none text-gray-400 px-1">×</button>
              </div>
            </div>
            <AddToCartSection {...props} />
          </div>
        </div>
      )}
    </>
  );
}

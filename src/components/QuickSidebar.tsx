"use client";
// 우측 고정 퀵 패널: 최근 본 상품(최대 3개) + 위로 가기 버튼
// - 넓은 화면(≥1640px): 컨테이너 바깥 우측 여백에 패널 + 버튼
// - 그 이하: 위로 가기 버튼만 우하단에 표시
import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecentProducts, removeRecentProduct, subscribeRecentProducts, type RecentProduct } from "@/lib/recent-products";

const SHOW = 3;

export default function QuickSidebar() {
  const [recent, setRecent] = useState<RecentProduct[]>([]);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const load = () => setRecent(getRecentProducts().slice(0, SHOW));
    load();
    const unsub = subscribeRecentProducts(load);
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { unsub(); window.removeEventListener("scroll", onScroll); };
  }, []);

  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <>
      {/* 넓은 화면: 우측 패널 */}
      <aside
        aria-label="최근 본 상품"
        className="hidden min-[1640px]:flex fixed top-1/2 -translate-y-1/2 z-30 w-[136px] max-h-[calc(100vh-40px)] flex-col gap-2"
        style={{ right: "max(16px, calc((100vw - 1260px) / 2 - 158px))" }}
      >
        <div className="card shadow-sm overflow-hidden">
          <div className="px-3 py-2 text-[12px] font-bold text-gray-800 border-b border-gray-100 flex items-center justify-between">
            <span>최근 본 상품</span>
            <span className="text-[11px] text-gray-400 font-medium">{recent.length}</span>
          </div>
          {recent.length === 0 ? (
            <div className="px-2 py-6 text-center text-[11px] text-gray-400 leading-relaxed break-keep">최근 본 상품이<br />없습니다</div>
          ) : (
            <ul className="p-2 flex flex-col gap-2">
              {recent.map((p) => (
                <li key={p.id} className="group relative">
                  <Link href={`/products/${p.id}`} className="block" title={p.name}>
                    <div className="w-[84px] h-[84px] mx-auto rounded-md bg-gray-100 overflow-hidden border border-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumbnail || "/images/placeholder.svg"} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    </div>
                    <div className="mt-1 px-0.5 text-[11px] text-gray-700 text-center leading-snug line-clamp-2 break-keep">{p.name}</div>
                  </Link>
                  <button
                    type="button"
                    aria-label="목록에서 제거"
                    onClick={() => removeRecentProduct(p.id)}
                    className="absolute top-0 right-3.5 w-[18px] h-[18px] rounded-full bg-black/55 text-white text-[11px] leading-none hidden group-hover:flex items-center justify-center hover:bg-black/75"
                  >×</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={toTop}
          className="card shadow-sm py-2.5 text-[12px] font-bold text-gray-700 hover:text-brand-600 hover:border-brand-400 flex items-center justify-center gap-1"
        >
          <ArrowUp /> 위로
        </button>
      </aside>

      {/* 좁은 화면: 우하단 위로 가기 버튼 (모바일은 하단 탭바 위로 띄움) */}
      <button
        type="button"
        onClick={toTop}
        aria-label="맨 위로"
        className={`min-[1640px]:hidden fixed right-4 bottom-[76px] md:bottom-6 z-30 w-11 h-11 rounded-full bg-white border border-gray-200 shadow-md text-gray-700 hover:text-brand-600 hover:border-brand-400 flex items-center justify-center transition-opacity ${showTop ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <ArrowUp />
      </button>
    </>
  );
}

function ArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
    </svg>
  );
}

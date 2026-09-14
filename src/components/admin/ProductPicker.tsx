"use client";
/** 상품 검색 → 선택 목록 (순서 조정) — 기획전/채비도 등에서 공용 */
import { useEffect, useState } from "react";
import { formatKRW } from "@/lib/utils";

export type PickedProduct = { id: string; name: string; thumbnail: string | null; price: number; salePrice: number | null };

export default function ProductPicker({ products, onChange, compact = false, placeholder = "상품명 또는 상품번호로 검색해서 추가" }: { products: PickedProduct[]; onChange: (p: PickedProduct[]) => void; compact?: boolean; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedProduct[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const s = q.trim();
    if (!s) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(s)}`);
        const d = await res.json();
        setResults((d.products || []).map((p: any) => ({ id: p.id, name: p.name, thumbnail: p.thumbnail, price: p.price, salePrice: p.salePrice })));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const add = (p: PickedProduct) => { if (!products.find((x) => x.id === p.id)) onChange([...products, p]); setQ(""); setResults([]); };
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= products.length) return; const c = [...products]; [c[i], c[j]] = [c[j], c[i]]; onChange(c); };
  const size = compact ? "w-8 h-8" : "w-10 h-10";
  return (
    <div className="space-y-2">
      <div className="relative">
        <input className={`input ${compact ? "h-9 text-sm" : ""}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
        {(results.length > 0 || searching) && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {searching && <div className="px-3 py-2 text-xs text-gray-400">검색 중...</div>}
            {results.map((p) => (
              <button key={p.id} type="button" onClick={() => add(p)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnail || "/images/placeholder.svg"} alt="" className={`${size} rounded object-cover bg-gray-100`} />
                <span className="flex-1 text-sm truncate">{p.name}</span>
                <span className="text-xs text-gray-500">{formatKRW(p.salePrice ?? p.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {products.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {products.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="w-4 text-[11px] text-gray-400 text-right">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnail || "/images/placeholder.svg"} alt="" className={`${size} rounded object-cover bg-gray-100`} />
              <span className="flex-1 text-sm truncate">{p.name}</span>
              <span className="text-xs text-gray-500 hidden sm:inline">{formatKRW(p.salePrice ?? p.price)}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 py-0.5 text-xs border border-gray-300 rounded disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === products.length - 1} className="px-1.5 py-0.5 text-xs border border-gray-300 rounded disabled:opacity-30">↓</button>
              <button type="button" onClick={() => onChange(products.filter((x) => x.id !== p.id))} className="px-1.5 py-0.5 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50">삭제</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

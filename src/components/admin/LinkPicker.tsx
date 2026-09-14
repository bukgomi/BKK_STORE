"use client";
/**
 * 링크 선택기 — 슬라이드/배너의 링크를 URL 을 외우지 않고 고른다
 *  기획전 · 카테고리 · 상품 · 모아보기(신상품/베스트/할인) · 직접 입력
 */
import { useEffect, useState } from "react";

type Promo = { id: string; slug: string; title: string; isPublished: boolean };
type Cat = { id: string; slug: string; name: string; parentId: string | null };
type Prod = { id: string; name: string; thumbnail: string | null };

const COLLECTIONS = [
  { label: "전체상품", value: "/products" },
  { label: "신상품", value: "/products?sort=new" },
  { label: "베스트", value: "/products?sort=best" },
  { label: "할인특가", value: "/products?sale=1" },
  { label: "기획전 목록", value: "/event" },
  { label: "공지사항", value: "/notice" },
];

type Kind = "promo" | "category" | "product" | "collection" | "custom";
function detectKind(href: string): Kind {
  if (href.startsWith("/event/")) return "promo";
  if (href.startsWith("/category/")) return "category";
  if (href.startsWith("/products/")) return "product";
  if (COLLECTIONS.some((c) => c.value === href)) return "collection";
  return "custom";
}

let promoCache: Promo[] | null = null;
let catCache: Cat[] | null = null;

export default function LinkPicker({ value, onChange }: { value: string; onChange: (href: string) => void }) {
  const [kind, setKind] = useState<Kind>(() => detectKind(value || ""));
  const [promos, setPromos] = useState<Promo[]>(promoCache || []);
  const [cats, setCats] = useState<Cat[]>(catCache || []);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Prod[]>([]);
  const [picked, setPicked] = useState<Prod | null>(null);

  useEffect(() => {
    if (kind === "promo" && !promoCache) fetch("/api/admin/promotions").then((r) => r.json()).then((d) => { promoCache = d; setPromos(d); }).catch(() => {});
    if (kind === "category" && !catCache) fetch("/api/admin/categories").then((r) => r.json()).then((d) => { catCache = d; setCats(d); }).catch(() => {});
  }, [kind]);

  useEffect(() => {
    if (kind !== "product") return;
    const s = q.trim(); if (!s) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(s)}`).then((r) => r.json()).then((d) => setResults(d.products || [])).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, kind]);

  const sel = "input h-9 text-sm";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {([["promo", "기획전"], ["category", "카테고리"], ["product", "상품"], ["collection", "모아보기"], ["custom", "직접 입력"]] as [Kind, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={`px-3 h-8 rounded-full text-xs border ${kind === k ? "bg-brand-600 text-white border-brand-600" : "bg-white border-gray-300 text-gray-600 hover:border-brand-400"}`}>
            {label}
          </button>
        ))}
      </div>

      {kind === "promo" && (
        <select className={sel} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">기획전 선택</option>
          {promos.map((p) => <option key={p.id} value={`/event/${p.slug}`}>{p.title}{p.isPublished ? "" : " (비공개)"}</option>)}
        </select>
      )}
      {kind === "category" && (
        <select className={sel} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">카테고리 선택</option>
          {cats.filter((c) => !c.parentId).map((top) => (
            <optgroup key={top.id} label={top.name}>
              <option value={`/category/${top.slug}`}>{top.name} 전체</option>
              {cats.filter((c) => c.parentId === top.id).map((c) => <option key={c.id} value={`/category/${c.slug}`}>ㄴ {c.name}</option>)}
            </optgroup>
          ))}
        </select>
      )}
      {kind === "product" && (
        <div className="relative">
          <input className={sel} value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명으로 검색" />
          {results.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {results.map((p) => (
                <button key={p.id} type="button" onClick={() => { onChange(`/products/${p.id}`); setPicked(p); setQ(""); setResults([]); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbnail || "/images/placeholder.svg"} alt="" className="w-8 h-8 rounded object-cover bg-gray-100" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          {picked && <p className="text-xs text-gray-500 mt-1">선택: {picked.name}</p>}
        </div>
      )}
      {kind === "collection" && (
        <select className={sel} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">페이지 선택</option>
          {COLLECTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      )}
      {kind === "custom" && (
        <input className={sel} value={value} onChange={(e) => onChange(e.target.value)} placeholder="/products?sale=1 또는 https://..." />
      )}
      <p className="text-[11px] text-gray-400">현재 링크: <code className="text-gray-600">{value || "(없음)"}</code></p>
    </div>
  );
}

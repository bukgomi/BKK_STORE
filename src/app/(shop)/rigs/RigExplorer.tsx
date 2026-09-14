"use client";
/**
 * 채비도 탐색기 — 월 → 지역(지도) → 낚시 종류 → 어종 → 채비 → 채비도 상세 + 구성품별 추천상품
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FISHING_TYPES, MONTHS, REGIONS, regionLabel, type RigComponent } from "@/lib/rig";
import { formatKRW } from "@/lib/utils";

export type RigProduct = { id: string; name: string; brand: string | null; thumbnail: string | null; price: number; salePrice: number | null; stock: number };
export type RigData = {
  id: string; slug: string; title: string; species: string; speciesImage: string | null; fishingType: string;
  regions: string[]; months: number[]; summary: string | null; diagramImage: string | null; contentHtml: string; components: RigComponent[];
};

export default function RigExplorer({ rigs, productMap, initialMonth, initialRigSlug }: { rigs: RigData[]; productMap: Record<string, RigProduct>; initialMonth: number; initialRigSlug: string | null }) {
  const initialRig = initialRigSlug ? rigs.find((r) => r.slug === initialRigSlug) || null : null;
  const [month, setMonth] = useState<number>(initialRig?.months[0] && !initialRig.months.includes(initialMonth) ? initialRig.months[0] : initialMonth);
  const [region, setRegion] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(initialRig?.fishingType ?? null);
  const [species, setSpecies] = useState<string | null>(initialRig?.species ?? null);
  const [rigSlug, setRigSlug] = useState<string | null>(initialRig?.slug ?? null);
  const [compFilter, setCompFilter] = useState<string | null>(null);

  // 월/지역 조건에 맞는 채비
  const byMonth = useMemo(() => rigs.filter((r) => r.months.includes(month)), [rigs, month]);
  const byRegion = useMemo(() => (region ? byMonth.filter((r) => r.regions.includes(region)) : byMonth), [byMonth, region]);
  const regionCounts = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const r of byMonth) for (const k of r.regions) (m[k] ||= new Set()).add(r.species);
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.size]));
  }, [byMonth]);
  const typeCounts = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const r of byRegion) (m[r.fishingType] ||= new Set()).add(r.species);
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.size]));
  }, [byRegion]);
  const byType = useMemo(() => (type ? byRegion.filter((r) => r.fishingType === type) : byRegion), [byRegion, type]);
  const speciesList = useMemo(() => {
    const seen = new Map<string, RigData>();
    for (const r of byType) if (!seen.has(r.species)) seen.set(r.species, r);
    return [...seen.values()];
  }, [byType]);
  const rigsOfSpecies = useMemo(() => (species ? byType.filter((r) => r.species === species) : []), [byType, species]);
  const rig = rigsOfSpecies.find((r) => r.slug === rigSlug) || rigsOfSpecies[0] || null;

  // 상위 선택이 바뀌어 현재 어종/채비가 목록에서 사라지면 정리
  useEffect(() => { if (species && !speciesList.some((s) => s.species === species)) { setSpecies(null); setRigSlug(null); } }, [speciesList, species]);
  useEffect(() => { setCompFilter(null); }, [rig?.slug]);
  useEffect(() => {
    if (!rig) return;
    const url = new URL(window.location.href); url.searchParams.set("rig", rig.slug); url.searchParams.set("month", String(month));
    window.history.replaceState(null, "", url.toString());
  }, [rig?.slug, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const recommended = useMemo(() => {
    if (!rig) return [] as { comp: string; product: RigProduct }[];
    const out: { comp: string; product: RigProduct }[] = [];
    const seen = new Set<string>();
    for (const c of rig.components) {
      if (compFilter && c.name !== compFilter) continue;
      for (const id of c.productIds) { const p = productMap[id]; if (p && !seen.has(id)) { seen.add(id); out.push({ comp: c.name, product: p }); } }
    }
    return out;
  }, [rig, compFilter, productMap]);

  return (
    <div className="space-y-6">
      {/* 1) 월 + 지역 지도 + 종류/어종 */}
      <div className="grid lg:grid-cols-[72px_minmax(0,1fr)_minmax(0,1.2fr)] gap-4 border border-gray-200 rounded-xl p-4 bg-white">
        {/* 월 */}
        <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
          {MONTHS.map((m) => (
            <button key={m} type="button" onClick={() => setMonth(m)}
              className={`shrink-0 h-9 lg:h-8 px-3 lg:px-0 rounded lg:rounded-md text-sm font-medium ${month === m ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              {m}월
            </button>
          ))}
        </div>

        {/* 지역 지도 (간이 배치) */}
        <div className="relative aspect-[2/3] w-full max-w-[300px] mx-auto rounded-lg bg-sky-50 border border-sky-100 overflow-hidden">
          {/* 대한민국 윤곽 지도 — Wikimedia Commons "Map of South Korea-blank.svg" (Public domain) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/korea-map.svg" alt="대한민국 지도" className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none" draggable={false} />
          <button type="button" onClick={() => setRegion(null)} className={`absolute top-2 right-2 text-[11px] px-2 h-6 rounded-full border ${region ? "bg-white border-gray-300 text-gray-600" : "bg-brand-600 text-white border-brand-600"}`}>전체 지역</button>
          {REGIONS.map((r) => {
            const n = regionCounts[r.key] || 0;
            const on = region === r.key;
            return (
              <button key={r.key} type="button" onClick={() => setRegion(on ? null : r.key)} disabled={n === 0}
                style={{ left: `${r.x}%`, top: `${r.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 h-8 rounded-full text-xs font-semibold shadow-sm border transition-colors ${
                  on ? "bg-brand-600 text-white border-brand-600" : n === 0 ? "bg-white/70 text-gray-300 border-gray-200 cursor-not-allowed" : "bg-white text-gray-800 border-gray-300 hover:border-brand-500 hover:text-brand-600"}`}>
                {r.label} <span className={on ? "text-white/80" : "text-brand-600"}>{n}종</span>
              </button>
            );
          })}
        </div>

        {/* 낚시 종류 + 어종 */}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button type="button" onClick={() => setType(null)} className={`px-3 h-9 rounded-lg text-sm font-medium border ${!type ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-300 text-gray-700"}`}>전체</button>
            {FISHING_TYPES.filter((t) => typeCounts[t.key]).map((t) => (
              <button key={t.key} type="button" onClick={() => setType(type === t.key ? null : t.key)}
                className={`px-3 h-9 rounded-lg text-sm font-medium border ${type === t.key ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-300 text-gray-700 hover:border-gray-500"}`}>
                {t.label} <span className="text-brand-500">{typeCounts[t.key]}</span>
              </button>
            ))}
          </div>
          {speciesList.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">{month}월{region ? ` ${regionLabel(region)}` : ""}에 등록된 채비가 없습니다.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {speciesList.map((s) => (
                <button key={s.species} type="button" onClick={() => { setSpecies(s.species); setRigSlug(null); }}
                  className={`group rounded-xl border p-2 text-center transition-colors ${species === s.species ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-brand-400"}`}>
                  <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden mb-1.5">
                    {s.speciesImage
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.speciesImage} alt={s.species} className="w-full h-full object-contain" />
                      : <div className="w-full h-full flex items-center justify-center text-3xl">🐟</div>}
                  </div>
                  <div className={`text-sm font-semibold ${species === s.species ? "text-brand-700" : "text-gray-800"}`}>{s.species}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2) 채비 선택 탭 + 상세 */}
      {species && rig && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="flex overflow-x-auto no-scrollbar border-b border-gray-200 bg-gray-50">
            {rigsOfSpecies.map((r) => (
              <button key={r.slug} type="button" onClick={() => setRigSlug(r.slug)}
                className={`shrink-0 px-5 h-12 text-sm font-semibold border-b-2 -mb-px ${rig.slug === r.slug ? "border-brand-600 text-brand-700 bg-white" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
                {r.species} {r.title}
              </button>
            ))}
          </div>

          <div className="p-5 md:p-6 space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">{rig.species} {rig.title}</h2>
              {rig.summary && <p className="text-sm text-gray-600 mt-1">{rig.summary}</p>}
              <p className="text-xs text-gray-400 mt-1">
                시즌 {rig.months.length === 12 ? "연중" : rig.months.map((m) => `${m}월`).join(" · ")}{rig.regions.length ? ` · 지역 ${rig.regions.map(regionLabel).join(", ")}` : ""}
              </p>
            </div>

            <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
              {/* 채비도 그림 */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 min-h-[260px] flex items-center justify-center overflow-hidden">
                {rig.diagramImage
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={rig.diagramImage} alt={`${rig.species} ${rig.title} 채비도`} className="w-full h-auto object-contain" />
                  : <div className="text-sm text-gray-400">채비도 그림 준비 중</div>}
              </div>
              {/* 구성품 표 */}
              <table className="w-full text-sm">
                <tbody>
                  {rig.components.map((c, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <th className="w-28 py-2.5 pr-3 text-left align-top">
                        <button type="button" onClick={() => setCompFilter(compFilter === c.name ? null : c.name)}
                          className={`inline-flex items-center gap-1.5 font-semibold ${compFilter === c.name ? "text-brand-700" : "text-gray-800 hover:text-brand-600"}`}>
                          <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center">{i + 1}</span>{c.name}
                        </button>
                      </th>
                      <td className="py-2.5 text-gray-700 align-top">{c.spec || <span className="text-gray-400">-</span>}{c.productIds.length > 0 && <span className="ml-2 text-[11px] text-brand-600">추천 {c.productIds.filter((id) => productMap[id]).length}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rig.contentHtml && <div className="product-detail" dangerouslySetInnerHTML={{ __html: rig.contentHtml }} />}

            {/* 추천 상품 */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="text-lg font-bold mr-2">이 채비에 맞는 탑캐스팅 상품</h3>
                <button type="button" onClick={() => setCompFilter(null)} className={`px-3 h-8 rounded-full text-xs border ${!compFilter ? "bg-brand-600 text-white border-brand-600" : "bg-white border-gray-300 text-gray-600"}`}>전체</button>
                {rig.components.filter((c) => c.productIds.some((id) => productMap[id])).map((c) => (
                  <button key={c.name} type="button" onClick={() => setCompFilter(compFilter === c.name ? null : c.name)} className={`px-3 h-8 rounded-full text-xs border ${compFilter === c.name ? "bg-brand-600 text-white border-brand-600" : "bg-white border-gray-300 text-gray-600 hover:border-brand-400"}`}>{c.name}</button>
                ))}
              </div>
              {recommended.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-300 rounded-lg">연결된 추천 상품이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {recommended.map(({ comp, product: p }) => (
                    <Link key={p.id} href={`/products/${p.id}`} className="group block">
                      <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumbnail || "/images/placeholder.svg"} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute top-2 left-2 badge-soft">{comp}</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-800 line-clamp-2 leading-snug group-hover:text-brand-600">{p.name}</div>
                      <div className="mt-1 text-base font-extrabold">{formatKRW(p.salePrice ?? p.price)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {species && !rig && <p className="text-sm text-gray-400">채비가 없습니다.</p>}
    </div>
  );
}

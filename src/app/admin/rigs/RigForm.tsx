"use client";
/**
 * 채비도 편집 폼 — 어종·낚시 종류·시즌(월)·지역·채비도 그림·구성품(스펙 + 추천상품)·본문
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/store/toast";
import RichDescriptionEditor from "@/components/admin/RichDescriptionEditor";
import ProductPicker, { type PickedProduct } from "@/components/admin/ProductPicker";
import { FISHING_TYPES, MONTHS, REGIONS, slugifyRig } from "@/lib/rig";

export type RigFormValue = {
  id?: string;
  title: string;
  slug: string;
  species: string;
  speciesImage: string;
  fishingType: string;
  regions: string[];
  months: number[];
  summary: string;
  diagramImage: string;
  content: string;
  components: { name: string; spec: string; products: PickedProduct[] }[];
  sortOrder: number;
  isPublished: boolean;
};

const DEFAULT_COMPONENTS = [
  { name: "낚싯대", spec: "", products: [] as PickedProduct[] },
  { name: "릴", spec: "", products: [] as PickedProduct[] },
  { name: "원줄", spec: "", products: [] as PickedProduct[] },
  { name: "목줄", spec: "", products: [] as PickedProduct[] },
  { name: "루어", spec: "", products: [] as PickedProduct[] },
];

export default function RigForm({ initial, speciesSuggestions = [] }: { initial?: RigFormValue; speciesSuggestions?: string[] }) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [f, setF] = useState<RigFormValue>(initial || {
    title: "", slug: "", species: "", speciesImage: "", fishingType: "lure", regions: [], months: [],
    summary: "", diagramImage: "", content: "", components: DEFAULT_COMPONENTS, sortOrder: 0, isPublished: true,
  });
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = <K extends keyof RigFormValue>(k: K, v: RigFormValue[K]) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => { if (!slugTouched) set("slug", f.species || f.title ? slugifyRig(f.species, f.title) : ""); }, [f.species, f.title, slugTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (arr: (string | number)[], v: string | number) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const setComp = (i: number, patch: Partial<RigFormValue["components"][number]>) => set("components", f.components.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const moveComp = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= f.components.length) return; const c = [...f.components]; [c[i], c[j]] = [c[j], c[i]]; set("components", c); };

  const save = async () => {
    if (!f.species.trim()) { toast.warning("어종을 입력해주세요."); return; }
    if (!f.title.trim()) { toast.warning("채비 이름을 입력해주세요."); return; }
    if (f.months.length === 0) { toast.warning("시즌(월)을 하나 이상 선택해주세요."); return; }
    setSaving(true);
    try {
      const body = { ...f, months: [...f.months].sort((a, b) => a - b), components: f.components.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), spec: c.spec, productIds: c.products.map((p) => p.id) })) };
      const res = await fetch(isEdit ? `/api/admin/rigs/${initial!.id}` : "/api/admin/rigs", { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast.success(isEdit ? "수정되었습니다." : "채비도가 등록되었습니다.", { href: `/rigs?rig=${data.slug || f.slug}`, hrefLabel: "페이지 보기" });
      router.push("/admin/rigs"); router.refresh();
    } catch (e: any) { toast.error(e.message || "저장 실패"); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!isEdit || !confirm("이 채비도를 삭제할까요?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/rigs/${initial!.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      toast.success("삭제되었습니다."); router.push("/admin/rigs"); router.refresh();
    } catch (e: any) { toast.error(e.message); setDeleting(false); }
  };

  const chip = (on: boolean) => `px-3 h-8 rounded-full text-xs border ${on ? "bg-brand-600 text-white border-brand-600" : "bg-white border-gray-300 text-gray-600 hover:border-brand-400"}`;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">어종 *</label>
            <input className="input" list="species-list" value={f.species} onChange={(e) => set("species", e.target.value)} maxLength={40} placeholder="예) 갑오징어" />
            <datalist id="species-list">{speciesSuggestions.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label className="label">채비 이름 *</label>
            <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={80} placeholder="예) 에깅 채비 (선상)" />
          </div>
          <div>
            <label className="label">낚시 종류 *</label>
            <select className="input" value={f.fishingType} onChange={(e) => set("fishingType", e.target.value)}>
              {FISHING_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">주소 (slug)</label>
            <div className="flex items-center gap-1"><span className="text-sm text-gray-400 shrink-0">/rigs?rig=</span><input className="input" value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} maxLength={80} /></div>
          </div>
          <div className="md:col-span-2">
            <label className="label">시즌 (월) *</label>
            <div className="flex flex-wrap gap-1.5">
              {MONTHS.map((m) => <button key={m} type="button" className={chip(f.months.includes(m))} onClick={() => set("months", toggle(f.months, m) as number[])}>{m}월</button>)}
              <button type="button" className="px-3 h-8 rounded-full text-xs border border-dashed border-gray-300 text-gray-500" onClick={() => set("months", f.months.length === 12 ? [] : [...MONTHS])}>{f.months.length === 12 ? "전체 해제" : "연중"}</button>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="label">지역</label>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map((r) => <button key={r.key} type="button" className={chip(f.regions.includes(r.key))} onClick={() => set("regions", toggle(f.regions, r.key) as string[])}>{r.label}</button>)}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="label">한 줄 요약</label>
            <input className="input" value={f.summary} onChange={(e) => set("summary", e.target.value)} maxLength={300} placeholder="예) 가을 서해 갑오징어·쭈꾸미 선상 에깅 기본 채비" />
          </div>
          <div>
            <label className="label">어종 사진 (정사각형 권장)</label>
            <ImageUploadField value={f.speciesImage} onChange={(v) => set("speciesImage", v)} />
          </div>
          <div>
            <label className="label">채비도 그림</label>
            <ImageUploadField value={f.diagramImage} onChange={(v) => set("diagramImage", v)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <label className="label mb-0">구성품 <span className="font-normal text-gray-400">(이름 · 규격 · 추천상품)</span></label>
          <button type="button" className="btn-outline h-8 text-xs" onClick={() => set("components", [...f.components, { name: "", spec: "", products: [] }])}>+ 구성품 추가</button>
        </div>
        <div className="space-y-3">
          {f.components.map((c, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                <input className="input h-9 text-sm w-36" value={c.name} onChange={(e) => setComp(i, { name: e.target.value })} placeholder="구성품 (예: 릴)" maxLength={40} />
                <input className="input h-9 text-sm flex-1" value={c.spec} onChange={(e) => setComp(i, { spec: e.target.value })} placeholder="규격 (예: 스피닝릴 2500번, PE 0.6호 150m)" maxLength={200} />
                <button type="button" onClick={() => moveComp(i, -1)} disabled={i === 0} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">↑</button>
                <button type="button" onClick={() => moveComp(i, 1)} disabled={i === f.components.length - 1} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">↓</button>
                <button type="button" onClick={() => set("components", f.components.filter((_, j) => j !== i))} className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50">삭제</button>
              </div>
              <div className="pl-8">
                <ProductPicker compact products={c.products} onChange={(p) => setComp(i, { products: p })} placeholder="이 구성품으로 추천할 우리 상품 검색" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <label className="label">설명 / 운용 팁</label>
        <RichDescriptionEditor value={f.content} onChange={(html) => set("content", html)} placeholder="채비 운용법, 포인트, 주의사항을 적어주세요." />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.isPublished} onChange={(e) => set("isPublished", e.target.checked)} /><span className="text-sm">공개</span></label>
        <label className="flex items-center gap-2"><span className="text-sm text-gray-600">정렬 순서</span><input type="number" className="input h-9 w-20 text-sm" value={f.sortOrder} onChange={(e) => set("sortOrder", Math.max(0, parseInt(e.target.value || "0", 10) || 0))} /></label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>{isEdit && <button onClick={remove} disabled={deleting} className="btn-outline text-rose-600 border-rose-300 hover:bg-rose-50">{deleting ? "삭제 중..." : "삭제"}</button>}</div>
        <div className="flex gap-2">
          {isEdit && <Link href={`/rigs?rig=${f.slug}`} target="_blank" className="btn-outline">페이지 보기 ↗</Link>}
          <Link href="/admin/rigs" className="btn-outline">취소</Link>
          <button onClick={save} disabled={saving} className="btn-primary min-w-[120px]">{saving ? "저장 중..." : (isEdit ? "수정" : "등록")}</button>
        </div>
      </div>
    </div>
  );
}

function ImageUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      onChange(data.largeUrl || data.url || data.mediumUrl);
    } catch (e: any) { toast.error(e.message || "업로드 실패"); }
    finally { setUploading(false); }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="input flex-1" placeholder="https://... 또는 업로드" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-outline whitespace-nowrap">{uploading ? "업로드 중..." : "📷 업로드"}</button>
        {value && <button type="button" onClick={() => onChange("")} className="btn-ghost text-gray-400 hover:text-red-500">×</button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(x); e.target.value = ""; }} />
      {value && (
        <div className="h-28 bg-gray-100 rounded border border-gray-200 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full h-full object-contain" />
        </div>
      )}
    </div>
  );
}

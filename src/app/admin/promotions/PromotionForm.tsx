"use client";
/**
 * 기획전/이벤트 게시물 편집 폼
 * - 제목/주소(slug)/라벨/부제목/커버 이미지/배경/본문(편집기)/함께 보여줄 상품/공개·기간
 * - "메인 히어로 슬라이드에 올리기" 체크 시 저장과 동시에 슬라이드가 추가·갱신된다
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/store/toast";
import RichDescriptionEditor from "@/components/admin/RichDescriptionEditor";
import { slugifyTitle, promotionHref } from "@/lib/promotion";
import { formatKRW } from "@/lib/utils";

export const BG_PRESETS = [
  { label: "브랜드 블루", value: "bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500" },
  { label: "다크 슬레이트", value: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600" },
  { label: "오렌지 강렬", value: "bg-gradient-to-br from-orange-600 via-accent-500 to-amber-400" },
  { label: "에메랄드", value: "bg-gradient-to-br from-emerald-700 via-emerald-500 to-teal-400" },
  { label: "퍼플 핑크", value: "bg-gradient-to-br from-purple-700 via-fuchsia-500 to-pink-400" },
  { label: "단색 블랙", value: "bg-gray-900" },
];

export type PickedProduct = { id: string; name: string; thumbnail: string | null; price: number; salePrice: number | null };

export type PromotionFormValue = {
  id?: string;
  title: string;
  slug: string;
  eyebrow: string;
  subtitle: string;
  coverImage: string;
  bgClass: string;
  content: string;
  productIds: string[];
  isPublished: boolean;
  startsAt: string; // "YYYY-MM-DDTHH:mm" 로컬 입력값, 빈 문자열이면 없음
  endsAt: string;
};

export default function PromotionForm({ initial, initialProducts = [], inHero = false }: { initial?: PromotionFormValue; initialProducts?: PickedProduct[]; inHero?: boolean }) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [f, setF] = useState<PromotionFormValue>(initial || {
    title: "", slug: "", eyebrow: "기획전", subtitle: "", coverImage: "", bgClass: BG_PRESETS[0].value,
    content: "", productIds: [], isPublished: true, startsAt: "", endsAt: "",
  });
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [products, setProducts] = useState<PickedProduct[]>(initialProducts);
  const [addToHero, setAddToHero] = useState(!isEdit ? true : inHero);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = <K extends keyof PromotionFormValue>(k: K, v: PromotionFormValue[K]) => setF((p) => ({ ...p, [k]: v }));

  // 제목을 치면 주소를 자동 생성 (직접 고치기 전까지)
  useEffect(() => { if (!slugTouched) set("slug", f.title ? slugifyTitle(f.title) : ""); }, [f.title, slugTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!f.title.trim()) { toast.warning("제목을 입력해주세요."); return; }
    if (!f.slug.trim()) { toast.warning("주소(slug)를 입력해주세요."); return; }
    setSaving(true);
    try {
      const body = {
        ...f, productIds: products.map((p) => p.id),
        startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : "",
        endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : "",
        addToHero, removeFromHero: isEdit && inHero && !addToHero,
      };
      const res = await fetch(isEdit ? `/api/admin/promotions/${initial!.id}` : "/api/admin/promotions", {
        method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast.success(isEdit ? "수정되었습니다." : "기획전이 등록되었습니다.", { href: promotionHref(data.slug || f.slug), hrefLabel: "페이지 보기" });
      router.push("/admin/promotions");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isEdit || !confirm("이 기획전을 삭제할까요? 메인 슬라이드에 올라가 있으면 함께 내려갑니다.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/promotions/${initial!.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "삭제 실패");
      toast.success("삭제되었습니다.");
      router.push("/admin/promotions");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "삭제 실패");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 미리보기 (히어로 슬라이드 모양) */}
      <div className={`relative rounded-xl overflow-hidden text-white px-8 py-8 ${f.bgClass || "bg-brand-600"}`}>
        {f.coverImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/45" />
          </>
        )}
        <div className="relative">
          <div className="text-sm opacity-80">{f.eyebrow || "(작은 라벨)"}</div>
          <div className="text-3xl font-extrabold mt-1.5">{f.title || "(제목)"}</div>
          {f.subtitle && <div className="mt-2 opacity-90">{f.subtitle}</div>}
          <span className="mt-4 inline-block bg-white text-brand-700 text-sm font-bold px-4 py-2 rounded">자세히 보기 →</span>
        </div>
        <div className="absolute top-3 right-3 text-[11px] bg-black/40 px-2 py-0.5 rounded">미리보기 · 메인 슬라이드 모양</div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">제목 *</label>
            <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="예) 실전 검증된 루어 컬렉션" />
          </div>
          <div>
            <label className="label">주소 (slug) *</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400 shrink-0">/event/</span>
              <input className="input" value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} maxLength={80} placeholder="spring-sale" />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">영문 소문자·숫자·한글·하이픈. 제목에서 자동 생성되며 직접 고칠 수 있습니다.</p>
          </div>
          <div>
            <label className="label">작은 라벨 (eyebrow)</label>
            <input className="input" value={f.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} maxLength={40} placeholder="예) 시즌 특가" />
          </div>
          <div className="md:col-span-2">
            <label className="label">부제목</label>
            <input className="input" value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} maxLength={160} placeholder="예) 수만 명의 낚시인이 선택한 인기 모델" />
          </div>
          <div className="md:col-span-2">
            <label className="label">커버 이미지 (슬라이드·페이지 상단 배경, 권장 1600×600)</label>
            <ImageUploadField value={f.coverImage} onChange={(v) => set("coverImage", v)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">배경 색 (커버 이미지가 없을 때)</label>
            <div className="flex flex-wrap gap-2">
              {BG_PRESETS.map((o) => (
                <button key={o.value} type="button" onClick={() => set("bgClass", o.value)}
                  className={`h-9 px-3 rounded text-xs text-white ${o.value} ${f.bgClass === o.value ? "ring-2 ring-offset-2 ring-brand-500" : "opacity-80 hover:opacity-100"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <label className="label">본문 (기획전 페이지 내용)</label>
        <RichDescriptionEditor value={f.content} onChange={(html) => set("content", html)} placeholder="기획전 소개 글과 이미지를 넣으세요. 사진은 끌어다 놓아도 됩니다." />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <label className="label">함께 보여줄 상품 <span className="font-normal text-gray-400">(페이지 아래에 카드로 나열, 선택)</span></label>
        <ProductPicker products={products} onChange={setProducts} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">시작일시 (선택)</label>
            <input type="datetime-local" className="input" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </div>
          <div>
            <label className="label">종료일시 (선택)</label>
            <input type="datetime-local" className="input" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            <p className="text-[11px] text-gray-400 mt-1">기간이 지나면 페이지는 자동으로 닫히고 슬라이드에서도 빠집니다.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 pt-3 border-t border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
            <span className="text-sm">공개</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={addToHero} onChange={(e) => setAddToHero(e.target.checked)} />
            <span className="text-sm">메인 히어로 슬라이드에 올리기 <span className="text-gray-400">(제목·부제목·커버가 슬라이드로 들어감. 문구는 사이트 설정에서 따로 손볼 수 있음)</span></span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          {isEdit && (
            <button onClick={remove} disabled={deleting} className="btn-outline text-rose-600 border-rose-300 hover:bg-rose-50">
              {deleting ? "삭제 중..." : "삭제"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {isEdit && <Link href={promotionHref(f.slug)} target="_blank" className="btn-outline">페이지 보기 ↗</Link>}
          <Link href="/admin/promotions" className="btn-outline">취소</Link>
          <button onClick={save} disabled={saving} className="btn-primary min-w-[120px]">{saving ? "저장 중..." : (isEdit ? "수정" : "등록")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── 커버 이미지 업로드 ── */
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
    </div>
  );
}

/* ── 상품 선택기 (검색 → 추가, 순서 조정) ── */
function ProductPicker({ products, onChange }: { products: PickedProduct[]; onChange: (p: PickedProduct[]) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedProduct[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const s = q.trim();
    if (s.length < 1) { setResults([]); return; }
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
  return (
    <div className="space-y-3">
      <div className="relative">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명 또는 상품번호로 검색해서 추가" />
        {(results.length > 0 || searching) && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
            {searching && <div className="px-3 py-2 text-xs text-gray-400">검색 중...</div>}
            {results.map((p) => (
              <button key={p.id} type="button" onClick={() => add(p)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnail || "/images/placeholder.svg"} alt="" className="w-10 h-10 rounded object-cover bg-gray-100" />
                <span className="flex-1 text-sm truncate">{p.name}</span>
                <span className="text-xs text-gray-500">{formatKRW(p.salePrice ?? p.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {products.length === 0 ? (
        <p className="text-xs text-gray-400">선택한 상품이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {products.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-5 text-xs text-gray-400 text-right">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnail || "/images/placeholder.svg"} alt="" className="w-10 h-10 rounded object-cover bg-gray-100" />
              <span className="flex-1 text-sm truncate">{p.name}</span>
              <span className="text-xs text-gray-500">{formatKRW(p.salePrice ?? p.price)}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === products.length - 1} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">↓</button>
              <button type="button" onClick={() => onChange(products.filter((x) => x.id !== p.id))} className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50">삭제</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

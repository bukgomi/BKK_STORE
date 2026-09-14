"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/store/toast";
import type { SiteSettings, HeroSlide, SideBanner } from "@/lib/site-settings";
import LinkPicker from "@/components/admin/LinkPicker";

const BG_PRESETS = [
  { label: "브랜드 블루", value: "bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500" },
  { label: "다크 슬레이트", value: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600" },
  { label: "오렌지 강렬", value: "bg-gradient-to-br from-orange-600 via-accent-500 to-amber-400" },
  { label: "에메랄드", value: "bg-gradient-to-br from-emerald-700 via-emerald-500 to-teal-400" },
  { label: "퍼플 핑크", value: "bg-gradient-to-br from-purple-700 via-fuchsia-500 to-pink-400" },
  { label: "단색 블랙", value: "bg-gray-900" },
];

const NOTICE_BG_PRESETS = [
  { label: "브랜드 블루", value: "bg-brand-700" },
  { label: "블랙", value: "bg-gray-900" },
  { label: "오렌지", value: "bg-accent-500" },
  { label: "그린", value: "bg-emerald-600" },
  { label: "레드", value: "bg-rose-600" },
];

export default function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState<SiteSettings>(initial);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast.success("저장되었습니다.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 상단 고지 띠 */}
      <Card title="🔔 상단 고지 띠" desc="페이지 최상단에 표시되는 안내 문구. 휴무, 이벤트, 긴급 공지 등에 사용하세요.">
        <Toggle
          label="고지 띠 노출"
          value={settings.noticeBar.enabled}
          onChange={(v) => update("noticeBar", { ...settings.noticeBar, enabled: v })}
        />
        <Field label="문구">
          <input
            type="text"
            value={settings.noticeBar.text}
            onChange={(e) => update("noticeBar", { ...settings.noticeBar, text: e.target.value })}
            className="input"
            placeholder="예) 5/5 어린이날 배송 휴무 안내"
            maxLength={200}
          />
        </Field>
        <Field label="링크 URL (선택)">
          <input
            type="text"
            value={settings.noticeBar.href || ""}
            onChange={(e) => update("noticeBar", { ...settings.noticeBar, href: e.target.value })}
            className="input"
            placeholder="/notice/holiday  또는  비워두면 클릭 안됨"
          />
        </Field>
        <Field label="배경색">
          <PresetSelect
            value={settings.noticeBar.bgColor || ""}
            onChange={(v) => update("noticeBar", { ...settings.noticeBar, bgColor: v })}
            options={NOTICE_BG_PRESETS}
          />
        </Field>
        {settings.noticeBar.enabled && (
          <Preview>
            <div className={`${settings.noticeBar.bgColor || "bg-brand-700"} ${settings.noticeBar.fgColor || "text-white"} px-4 py-2 text-xs text-center`}>
              {settings.noticeBar.text || "(문구 미입력)"}
            </div>
          </Preview>
        )}
      </Card>

      {/* 히어로 캐러셀 */}
      <Card title="🎬 히어로 캐러셀" desc="홈 메인 큰 배너 영역의 슬라이드. 5초마다 자동 전환됩니다. 최대 10개.">
        <SlideEditor
          slides={settings.heroSlides}
          onChange={(s) => update("heroSlides", s)}
        />
      </Card>

      {/* 사이드 배너 */}
      <Card title="📐 사이드 배너 (홈 우측)" desc="히어로 캐러셀 옆 2개 배너 카드 (데스크톱 전용). 최대 4개.">
        <SideBannerEditor
          banners={settings.sideBanners}
          onChange={(b) => update("sideBanners", b)}
        />
      </Card>

      {/* 섹션 노출 토글 */}
      <Card title="🧩 홈 섹션 노출" desc="홈 화면 각 섹션을 켜고 끌 수 있습니다.">
        <Toggle label="카테고리 쇼트컷" value={settings.showCategoryShortcut} onChange={(v) => update("showCategoryShortcut", v)} />
        <Toggle label="실시간 베스트" value={settings.showBestSection} onChange={(v) => update("showBestSection", v)} />
        <Toggle label="추천상품" value={settings.showFeaturedSection} onChange={(v) => update("showFeaturedSection", v)} />
        <Toggle label="신상품" value={settings.showNewSection} onChange={(v) => update("showNewSection", v)} />
      </Card>

      {/* 무료배송 기준 */}
      <Card title="🚚 무료배송 기준" desc="이 금액 이상 주문 시 배송비가 무료로 처리됩니다. (체크아웃 금액 계산에는 별도 코드 반영 필요)">
        <Field label="기준 금액 (원)">
          <input
            type="number"
            min={0}
            step={1000}
            value={settings.freeShippingMin}
            onChange={(e) => update("freeShippingMin", parseInt(e.target.value || "0", 10) || 0)}
            className="input max-w-[200px]"
          />
          <span className="ml-2 text-xs text-gray-500">현재: {settings.freeShippingMin.toLocaleString()}원 이상</span>
        </Field>
      </Card>

      {/* 푸터 정보 */}
      <Card title="🏢 푸터 사업자 정보" desc=".env 환경변수 대신 여기서 관리할 수 있습니다. 비워두면 .env 값을 사용합니다.">
        <Field label="캐치프레이즈 (푸터 상단)">
          <input
            type="text"
            value={settings.footer.tagline || ""}
            onChange={(e) => update("footer", { ...settings.footer, tagline: e.target.value })}
            className="input"
            placeholder="낚시 입문자부터 베테랑까지, 필요한 모든 장비를 합리적인 가격으로"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="상호"><FooterInput k="name" settings={settings} setSettings={setSettings} ph="탑캐스팅" /></Field>
          <Field label="대표자"><FooterInput k="ceo" settings={settings} setSettings={setSettings} ph="홍길동" /></Field>
          <Field label="사업자등록번호"><FooterInput k="bizNo" settings={settings} setSettings={setSettings} ph="000-00-00000" /></Field>
          <Field label="통신판매업"><FooterInput k="ecommNo" settings={settings} setSettings={setSettings} ph="제0000-서울XX-0000호" /></Field>
          <div className="md:col-span-2"><Field label="주소"><FooterInput k="address" settings={settings} setSettings={setSettings} ph="서울특별시 OO구 OO로 00, 0층" /></Field></div>
          <Field label="고객센터 전화"><FooterInput k="csPhone" settings={settings} setSettings={setSettings} ph="00-000-0000" /></Field>
          <Field label="고객센터 이메일"><FooterInput k="csEmail" settings={settings} setSettings={setSettings} ph="help@example.com" /></Field>
          <div className="md:col-span-2"><Field label="운영시간"><FooterInput k="csHours" settings={settings} setSettings={setSettings} ph="평일 09:00 ~ 18:00 (점심 12:00~13:00)" /></Field></div>
          <Field label="개인정보보호책임자"><FooterInput k="privacyOfficer" settings={settings} setSettings={setSettings} ph="홍길동" /></Field>
          <Field label="개인정보 이메일"><FooterInput k="privacyEmail" settings={settings} setSettings={setSettings} ph="privacy@example.com" /></Field>
        </div>
      </Card>

      {/* 저장 바 (sticky) */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-6 px-6 py-3 flex items-center justify-end gap-2">
        <span className="text-xs text-gray-400 mr-auto">변경 사항은 저장 즉시 사이트에 반영됩니다 (캐시 60초).</span>
        <button onClick={() => setSettings(initial)} className="btn-outline">되돌리기</button>
        <button onClick={save} disabled={saving} className="btn-primary min-w-[120px]">
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

// ===== Slide Editor =====
function SlideEditor({ slides, onChange }: { slides: HeroSlide[]; onChange: (s: HeroSlide[]) => void }) {
  const add = () => onChange([...slides, {
    eyebrow: "신규",
    title: "새 슬라이드",
    subtitle: "",
    cta: "보러가기",
    href: "/products",
    bgClass: BG_PRESETS[0].value,
  }]);
  const remove = (i: number) => onChange(slides.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const copy = [...slides];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const setField = (i: number, key: keyof HeroSlide, value: string) =>
    onChange(slides.map((s, j) => j === i ? { ...s, [key]: value } : s));
  const setFlag = (i: number, key: "imageOnly", value: boolean) =>
    onChange(slides.map((s, j) => j === i ? { ...s, [key]: value } : s));

  return (
    <div className="space-y-3">
      {slides.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-300 rounded">
          슬라이드가 없습니다. 아래 버튼으로 추가하세요.
        </p>
      )}
      {slides.map((s, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* 미리보기 */}
          <div className={`${s.bgClass || "bg-brand-500"} text-white px-6 py-4 relative`}>
            {s.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" className={`absolute inset-0 w-full h-full object-cover ${s.imageOnly ? "" : "opacity-40"}`} />
            )}
            <div className={`relative ${s.imageOnly ? "invisible" : ""}`}>
              <div className="text-xs opacity-80">{s.eyebrow || "(eyebrow)"}</div>
              <div className="text-lg font-bold mt-1">{s.title || "(title)"}</div>
              {s.subtitle && <div className="text-xs opacity-90 mt-0.5">{s.subtitle}</div>}
            </div>
          </div>

          {/* 폼 */}
          <div className="p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">슬라이드 #{i + 1}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === slides.length - 1} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">↓</button>
                <button type="button" onClick={() => remove(i)} className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50">삭제</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="작은 라벨 (eyebrow)">
                <input value={s.eyebrow} onChange={(e) => setField(i, "eyebrow", e.target.value)} className="input" maxLength={40} placeholder="예) 시즌 특가" />
              </Field>
              <Field label="버튼 문구 (CTA)">
                <input value={s.cta} onChange={(e) => setField(i, "cta", e.target.value)} className="input" maxLength={40} placeholder="예) 보러가기" />
              </Field>
              <div className="md:col-span-2">
                <Field label="제목">
                  <input value={s.title} onChange={(e) => setField(i, "title", e.target.value)} className="input" maxLength={80} placeholder="예) 봄 시즌 낚시용품 대전" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="부제목 (선택)">
                  <input value={s.subtitle || ""} onChange={(e) => setField(i, "subtitle", e.target.value)} className="input" maxLength={120} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="링크 (누르면 이동할 곳)">
                  <LinkPicker value={s.href} onChange={(v) => setField(i, "href", v)} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="배경 그라디언트">
                  <PresetSelect
                    value={s.bgClass || ""}
                    onChange={(v) => setField(i, "bgClass", v)}
                    options={BG_PRESETS}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="배경 이미지 URL (선택, 우선 적용)">
                  <ImageUploadField
                    value={s.image || ""}
                    onChange={(v) => setField(i, "image", v)}
                  />
                </Field>
                <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!s.imageOnly} onChange={(e) => setFlag(i, "imageOnly", e.target.checked)} />
                  이미지만 표시 <span className="text-xs text-gray-400">(문구·버튼·어두운 덮개 없이 배너 이미지 그대로. 브랜드 배너용)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} disabled={slides.length >= 10} className="w-full border border-dashed border-gray-300 rounded py-3 text-sm text-gray-600 hover:border-brand-500 hover:text-brand-600 disabled:opacity-50">
        + 슬라이드 추가
      </button>
    </div>
  );
}

// ===== Side Banner Editor =====
function SideBannerEditor({ banners, onChange }: { banners: SideBanner[]; onChange: (b: SideBanner[]) => void }) {
  const add = () => onChange([...banners, {
    eyebrow: "추천",
    title: "새 배너",
    href: "/products",
    bgClass: BG_PRESETS[0].value,
    emoji: "🎁",
  }]);
  const remove = (i: number) => onChange(banners.filter((_, j) => j !== i));
  const setField = (i: number, key: keyof SideBanner, value: string) =>
    onChange(banners.map((b, j) => j === i ? { ...b, [key]: value } : b));

  return (
    <div className="space-y-3">
      {banners.map((b, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">배너 #{i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50">삭제</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="작은 라벨"><input value={b.eyebrow} onChange={(e) => setField(i, "eyebrow", e.target.value)} className="input" maxLength={40} /></Field>
            <Field label="이모지"><input value={b.emoji || ""} onChange={(e) => setField(i, "emoji", e.target.value)} className="input" maxLength={8} placeholder="🎁" /></Field>
            <div className="md:col-span-2"><Field label="제목"><input value={b.title} onChange={(e) => setField(i, "title", e.target.value)} className="input" maxLength={60} /></Field></div>
            <div className="md:col-span-2"><Field label="링크"><LinkPicker value={b.href} onChange={(v) => setField(i, "href", v)} /></Field></div>
            <div className="md:col-span-2"><Field label="배경"><PresetSelect value={b.bgClass || ""} onChange={(v) => setField(i, "bgClass", v)} options={BG_PRESETS} /></Field></div>
          </div>
          <Preview>
            <div className={`${b.bgClass || "bg-brand-500"} text-white rounded-lg px-6 py-4 flex items-center justify-between`}>
              <div>
                <div className="text-xs opacity-80">{b.eyebrow}</div>
                <div className="text-base font-bold mt-0.5">{b.title}</div>
              </div>
              <div className="text-3xl opacity-50">{b.emoji}</div>
            </div>
          </Preview>
        </div>
      ))}
      <button type="button" onClick={add} disabled={banners.length >= 4} className="w-full border border-dashed border-gray-300 rounded py-3 text-sm text-gray-600 hover:border-brand-500 hover:text-brand-600 disabled:opacity-50">
        + 배너 추가
      </button>
    </div>
  );
}

// ===== 공통 UI 헬퍼 =====
function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6">
      <header className="mb-4">
        <h2 className="font-bold text-base text-gray-900">{title}</h2>
        {desc && <p className="text-xs text-gray-500 mt-1">{desc}</p>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-gray-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors ${value ? "bg-brand-500" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function PresetSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {!options.find((o) => o.value === value) && value && <option value={value}>커스텀: {value.slice(0, 30)}...</option>}
    </select>
  );
}

function Preview({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-gray-400 mb-1">미리보기</div>
      {children}
    </div>
  );
}

function FooterInput({
  k, settings, setSettings, ph,
}: {
  k: keyof NonNullable<SiteSettings["footer"]>;
  settings: SiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
  ph: string;
}) {
  return (
    <input
      type="text"
      value={(settings.footer[k] as string) || ""}
      onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, [k]: e.target.value } }))}
      className="input"
      placeholder={ph}
    />
  );
}

// ===== 이미지 업로드 + URL 직접 입력 =====
function ImageUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      onChange(data.largeUrl || data.url || data.mediumUrl);
      toast.success("이미지가 업로드되었습니다.");
    } catch (e: any) {
      toast.error(e.message || "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input flex-1"
          placeholder="https://... 또는 업로드"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-outline whitespace-nowrap"
        >
          {uploading ? "업로드 중..." : "📷 업로드"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")} className="btn-ghost text-gray-400 hover:text-red-500">×</button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {value && (
        <div className="aspect-[3/1] bg-gray-100 rounded border border-gray-200 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="배경" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

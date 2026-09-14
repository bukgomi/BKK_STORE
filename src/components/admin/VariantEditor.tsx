"use client";
/**
 * 상품 옵션 편집기 (스마트스토어 방식)
 *  1) 옵션명 개수(1~3) 선택 → 옵션명(색상/무게/…)과 옵션값(쉼표 구분) 입력
 *  2) "옵션목록으로 적용" → 옵션값 조합 목록 생성 (옵션명이 2개 이상이면 조합형)
 *  3) 목록에서 옵션별 옵션가(추가금)·재고수량·사용여부 설정, 선택 일괄수정
 *
 * 저장 형식: 조합은 name "17g / 1-LT13D", optionType "combo:무게|색상" — 상품 페이지가 무게 → 색상 2단계로 그린다.
 * 단일 옵션은 name "1-LT13D", optionType color/weight/size/option.
 */
import { useMemo, useState } from "react";

export type VariantRow = {
  id?: string;          // 기존 옵션 PK (수정 시)
  name: string;
  optionType: string;
  colorHex?: string | null;
  stock: number | "";
  priceModifier: number | "";
  sortOrder: number;
  isActive: boolean;
};

export const EMPTY_VARIANT: VariantRow = { name: "", optionType: "option", colorHex: null, stock: 0, priceModifier: 0, sortOrder: 0, isActive: true };

const SEP = " / ";
const MAX_GROUPS = 3;

function typeOfTitle(t: string): string {
  const s = t.replace(/\s/g, "");
  if (/색상|컬러|색/.test(s)) return "color";
  if (/무게|중량/.test(s)) return "weight";
  if (/사이즈|크기|호수|인치|길이/.test(s)) return "size";
  return "option";
}
function labelOfType(t: string): string {
  return t === "color" ? "색상" : t === "weight" ? "무게" : t === "size" ? "사이즈" : "옵션";
}
const splitValues = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);

/** 저장된 옵션 행 → 옵션명/옵션값 입력칸 초기값 */
function groupsFromRows(rows: VariantRow[]): { titles: string[]; values: string[] } {
  if (!rows.length) return { titles: ["색상"], values: [""] };
  const t = rows[0].optionType || "";
  if (t.startsWith("combo:")) {
    const titles = t.slice(6).split("|").map((s) => s.trim()).filter(Boolean);
    const vals = titles.map(() => [] as string[]);
    for (const r of rows) r.name.split(SEP).forEach((p, i) => { if (vals[i] && !vals[i].includes(p.trim())) vals[i].push(p.trim()); });
    return { titles, values: vals.map((v) => v.join(",")) };
  }
  return { titles: [labelOfType(t)], values: [rows.map((r) => r.name).join(",")] };
}

export default function VariantEditor({ variants, onChange }: { variants: VariantRow[]; onChange: (next: VariantRow[]) => void }) {
  const init = useMemo(() => groupsFromRows(variants), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [titles, setTitles] = useState<string[]>(init.titles);
  const [values, setValues] = useState<string[]>(init.values);
  const [defaultStock, setDefaultStock] = useState<number>(999);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [bulkPrice, setBulkPrice] = useState<string>("");
  const [bulkStock, setBulkStock] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  const groupCount = titles.length;
  const setGroupCount = (n: number) => {
    const t = [...titles], v = [...values];
    while (t.length < n) { t.push(t.length === 0 ? "색상" : t.length === 1 ? "무게" : "옵션"); v.push(""); }
    setTitles(t.slice(0, n)); setValues(v.slice(0, n));
  };

  /** 옵션명/옵션값 → 옵션 목록 생성. 이미 있는 행(같은 이름)은 옵션가·재고·id 유지 */
  const apply = () => {
    const ts = titles.map((t) => t.trim());
    if (ts.some((t) => !t)) { setNotice("옵션명을 모두 입력하세요."); return; }
    const groups = values.map(splitValues);
    const emptyIdx = groups.findIndex((g) => !g.length);
    if (emptyIdx >= 0) { setNotice(`"${ts[emptyIdx]}" 옵션값을 입력하세요. (쉼표로 구분)`); return; }

    let combos: string[][] = [[]];
    for (const g of groups) combos = combos.flatMap((c) => g.map((x) => [...c, x]));
    if (combos.length > 500) { setNotice(`옵션 조합이 ${combos.length}개입니다. 500개 이하로 줄여 주세요.`); return; }

    const optionType = ts.length > 1 ? `combo:${ts.join("|")}` : typeOfTitle(ts[0]);
    const prev = new Map(variants.map((v) => [v.name, v]));
    const next: VariantRow[] = combos.map((c, i) => {
      const name = c.join(SEP);
      const ex = prev.get(name);
      return ex
        ? { ...ex, optionType, sortOrder: i }
        : { name, optionType, colorHex: null, stock: defaultStock, priceModifier: 0, sortOrder: i, isActive: true };
    });
    const kept = next.filter((r) => r.id).length;
    onChange(next);
    setChecked(new Set());
    setNotice(`옵션 ${next.length}개 생성 (기존 유지 ${kept}, 새로 추가 ${next.length - kept}). 저장 버튼을 눌러야 반영됩니다.`);
  };

  const update = (i: number, patch: Partial<VariantRow>) => onChange(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const remove = (i: number) => { onChange(variants.filter((_, idx) => idx !== i).map((v, idx) => ({ ...v, sortOrder: idx }))); setChecked(new Set()); };
  const removeChecked = () => { onChange(variants.filter((_, idx) => !checked.has(idx)).map((v, idx) => ({ ...v, sortOrder: idx }))); setChecked(new Set()); };
  const toggleAll = (on: boolean) => setChecked(on ? new Set(variants.map((_, i) => i)) : new Set());
  const bulkApply = (field: "priceModifier" | "stock" | "isActive", val: number | boolean) => {
    const targets = checked.size ? checked : new Set(variants.map((_, i) => i));
    onChange(variants.map((v, idx) => (targets.has(idx) ? { ...v, [field]: val } : v)));
  };

  // 목록의 그룹 열 (저장된 optionType 기준 — 입력칸과 다를 수 있음)
  const listTitles = useMemo(() => {
    const t = variants[0]?.optionType || "";
    return t.startsWith("combo:") ? t.slice(6).split("|") : [labelOfType(t || typeOfTitle(titles[0] || ""))];
  }, [variants, titles]);
  const parts = (name: string) => name.split(SEP);

  const inputCls = "input h-8 text-xs";

  return (
    <div className="space-y-4">
      {/* ── 옵션 입력 ── */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-gray-600 w-16">옵션명 개수</span>
            <select className="input h-8 text-xs w-24" value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))}>
              {Array.from({ length: MAX_GROUPS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}개</option>)}
            </select>
          </label>
          <span className="text-gray-500">{groupCount > 1 ? "조합형 — 옵션값을 모두 조합한 목록이 만들어집니다 (예: 무게 → 색상)" : "단독형 — 옵션값 하나가 옵션 하나입니다"}</span>
          <label className="flex items-center gap-2 ml-auto">
            <span className="text-gray-600">새 옵션 기본 재고</span>
            <input type="number" min={0} className="input h-8 text-xs w-20 text-right" value={defaultStock} onChange={(e) => setDefaultStock(Math.max(0, Number(e.target.value) || 0))} />
          </label>
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: "180px 1fr" }}>
          <div className="text-[11px] text-gray-500">옵션명</div>
          <div className="text-[11px] text-gray-500">옵션값 (쉼표로 구분, 입력 순서대로 표시)</div>
          {titles.map((t, i) => (
            <div key={i} className="contents">
              <input className={inputCls} placeholder={i === 0 ? "예) 색상" : "예) 무게"} value={t}
                onChange={(e) => setTitles(titles.map((x, j) => (j === i ? e.target.value : x)))} />
              <input className={inputCls} placeholder={i === 0 ? "예) 001,002,003 또는 1-A390,2-A767" : "예) 17g,21g,25g,30g"} value={values[i]}
                onChange={(e) => setValues(values.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={apply} className="btn-primary h-9 text-xs px-5">옵션목록으로 적용 ↓</button>
          {notice && <span className="text-xs text-brand-700">{notice}</span>}
        </div>
      </div>

      {/* ── 옵션 목록 ── */}
      {variants.length === 0 ? (
        <p className="text-xs text-gray-500">옵션 목록이 비어 있습니다. 옵션값을 입력하고 "옵션목록으로 적용"을 누르세요. 옵션이 없으면 단일 상품으로 판매됩니다.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-gray-700">옵션목록 <span className="text-gray-400">(총 {variants.length}개{checked.size ? `, 선택 ${checked.size}` : ""})</span></span>
            <button type="button" onClick={removeChecked} disabled={!checked.size} className="btn-outline h-7 text-xs px-2 disabled:opacity-40">선택삭제</button>
            <span className="ml-auto flex items-center gap-1">
              <span className="text-gray-500">옵션가</span>
              <input type="number" className="input h-7 text-xs w-20 text-right" placeholder="0" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
              <span className="text-gray-500 ml-2">재고수량</span>
              <input type="number" min={0} className="input h-7 text-xs w-20 text-right" placeholder="999" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} />
              <span className="text-gray-500 ml-2">사용여부</span>
              <select className="input h-7 text-xs w-14" defaultValue="" onChange={(e) => { if (e.target.value) bulkApply("isActive", e.target.value === "Y"); e.target.value = ""; }}>
                <option value="">-</option><option value="Y">Y</option><option value="N">N</option>
              </select>
              <button type="button" className="btn-outline h-7 text-xs px-2 ml-1"
                onClick={() => { if (bulkPrice !== "") bulkApply("priceModifier", Number(bulkPrice) || 0); if (bulkStock !== "") bulkApply("stock", Math.max(0, Number(bulkStock) || 0)); setBulkPrice(""); setBulkStock(""); }}>
                {checked.size ? "선택목록 일괄수정" : "전체 일괄수정"}
              </button>
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-2 w-8"><input type="checkbox" checked={checked.size === variants.length} onChange={(e) => toggleAll(e.target.checked)} /></th>
                  <th className="py-2 w-14">번호</th>
                  {listTitles.map((t) => <th key={t} className="py-2 text-left px-2">{t}</th>)}
                  <th className="py-2 w-28 text-right pr-2">옵션가(추가금)</th>
                  <th className="py-2 w-24 text-right pr-2">재고수량</th>
                  <th className="py-2 w-16">사용여부</th>
                  <th className="py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => {
                  const ps = parts(v.name);
                  return (
                    <tr key={v.id || `n-${i}`} className={`border-t border-gray-100 ${v.isActive ? "" : "bg-gray-50 text-gray-400"}`}>
                      <td className="text-center"><input type="checkbox" checked={checked.has(i)} onChange={(e) => { const s = new Set(checked); e.target.checked ? s.add(i) : s.delete(i); setChecked(s); }} /></td>
                      <td className="text-center text-gray-400">{i + 1}</td>
                      {listTitles.map((_, gi) => (
                        <td key={gi} className="px-2 py-1">
                          {listTitles.length === 1 ? (
                            <input className={inputCls} value={v.name} onChange={(e) => update(i, { name: e.target.value })} />
                          ) : (
                            <input className={inputCls} value={ps[gi] ?? ""}
                              onChange={(e) => { const np = [...ps]; np[gi] = e.target.value; update(i, { name: np.join(SEP) }); }} />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-1">
                        <input type="number" className={`${inputCls} text-right`} placeholder="0" value={v.priceModifier}
                          onChange={(e) => update(i, { priceModifier: e.target.value === "" ? "" : Number(e.target.value) })} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" min={0} className={`${inputCls} text-right`} value={v.stock}
                          onChange={(e) => update(i, { stock: e.target.value === "" ? "" : Number(e.target.value) })} />
                      </td>
                      <td className="text-center">
                        <select className="input h-8 text-xs w-14 mx-auto" value={v.isActive ? "Y" : "N"} onChange={(e) => update(i, { isActive: e.target.value === "Y" })}>
                          <option value="Y">Y</option><option value="N">N</option>
                        </select>
                      </td>
                      <td className="text-center">
                        <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 text-base" title="삭제">×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400">
            옵션가는 기본 판매가에 더해지는 금액입니다 (음수 가능). 옵션이 1개 이상이면 상품의 "재고" 값 대신 옵션별 재고로 판매됩니다.
            옵션값을 추가하려면 위 입력칸을 고치고 다시 "옵션목록으로 적용"을 누르세요. 기존 옵션의 옵션가·재고는 유지됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

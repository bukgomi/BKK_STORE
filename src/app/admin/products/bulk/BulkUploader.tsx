"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  HEADER_DEFINITIONS,
  TEMPLATE_ORDER,
  normalizeRow,
  splitList,
  parseIntCell,
  parseOptionColumns,
  isImageUrl,
  type StandardKey,
  type ParsedVariant,
} from "@/lib/bulk-headers";

type Category = { id: string; name: string; slug: string; parentId: string | null };

type RawRow = Record<StandardKey, string>;

type ValidatedRow = {
  index: number;          // 엑셀 기준 행번호
  raw: RawRow;
  ok: boolean;
  errors: string[];
  warnings: string[];
  willUpdate: boolean;
  variants: ParsedVariant[];
  imageRefs: string[];    // 대표 + 추가 (파일명 또는 URL)
};

type Result = { created: number; updated: number; failed: number; variantsWritten?: number; errors: string[] };

const UPLOAD_CONCURRENCY = 3;

export default function BulkUploader({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [filename, setFilename] = useState("");
  const [imageFiles, setImageFiles] = useState<Map<string, File>>(new Map());
  const [imageFolderName, setImageFolderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const slugSet = useMemo(() => new Set(categories.map((c) => c.slug)), [categories]);

  /** 파일에서 행 배열 읽기 (CSV/XLSX 자동 감지) */
  const readFile = async (file: File): Promise<RawRow[]> => {
    const ext = file.name.toLowerCase().split(".").pop();

    if (ext === "csv") {
      return new Promise((resolve, reject) => {
        Papa.parse<Record<string, any>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (parsed) => resolve((parsed.data as Record<string, any>[]).map(normalizeRow)),
          error: (err) => reject(err),
        });
      });
    }

    if (ext === "xlsx" || ext === "xls") {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames.find((n) => n.includes("상품")) || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      if (!sheet) throw new Error("엑셀 시트를 찾을 수 없습니다.");
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", raw: false, blankrows: false });
      return json.map(normalizeRow);
    }

    throw new Error("지원하지 않는 파일 형식입니다. (.csv, .xlsx, .xls)");
  };

  /** 행별 유효성 검증 (+ 기존 SKU 조회로 신규/수정 판별) */
  const validate = async (rawRows: RawRow[], files: Map<string, File>): Promise<ValidatedRow[]> => {
    const skus = rawRows.map((r) => (r.sku || "").trim()).filter(Boolean);
    const existing = await fetch("/api/admin/products/bulk/check-sku", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skus }),
    }).then((r) => r.json()).catch(() => ({ existing: [] }));
    const existSet = new Set<string>(existing.existing || []);
    const dupSku = new Set<string>();
    const seenSku = new Set<string>();

    return rawRows.map((row, i): ValidatedRow => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const sku = (row.sku || "").trim();
      const name = (row.name || "").trim();
      const categorySlug = (row.categorySlug || "").trim();
      const price = parseIntCell(row.price);
      const salePrice = parseIntCell(row.salePrice);
      const stock = parseIntCell(row.stock);

      if (!sku) errors.push("상품코드 누락");
      else if (seenSku.has(sku)) { dupSku.add(sku); errors.push("같은 상품코드가 파일 안에 두 번 이상"); }
      seenSku.add(sku);
      if (!name) errors.push("상품명 누락");
      if (!categorySlug) errors.push("카테고리코드 누락");
      else if (!slugSet.has(categorySlug)) errors.push(`존재하지 않는 카테고리: ${categorySlug}`);
      if (price === null || price < 0) errors.push("판매가 오류");
      if ((row.salePrice || "").trim()) {
        if (salePrice === null || salePrice < 0) errors.push("할인가 오류");
        else if (price !== null && salePrice >= price) errors.push("할인가가 판매가 이상");
      }
      if (stock === null || stock < 0) errors.push("재고수량 오류");

      const { variants, errors: optErrors } = parseOptionColumns(row, stock ?? 0);
      errors.push(...optErrors);
      if (variants.length && !(row.optionTitle || "").trim()) warnings.push("옵션명이 비어 있어 '옵션'으로 표시됨");

      const imageRefs = [(row.thumbnail || "").trim(), ...splitList(row.images)].filter(Boolean);
      for (const ref of imageRefs) {
        if (!isImageUrl(ref) && !files.has(ref.toLowerCase())) {
          warnings.push(`이미지 파일 없음: ${ref}`);
        }
      }
      if (imageRefs.length === 0) warnings.push("이미지 없음");

      return { index: i + 2, raw: row, ok: errors.length === 0, errors, warnings, willUpdate: existSet.has(sku), variants, imageRefs };
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setResult(null);
    setRows([]);
    try {
      const raw = await readFile(file);
      setRows(await validate(raw, imageFiles));
    } catch (e: any) {
      alert("파일 읽기 실패: " + e.message);
    }
  };

  /** 이미지 폴더(또는 여러 파일) 선택 → 파일명(소문자) → File */
  const onImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []).filter((f) => /^image\//.test(f.type));
    const map = new Map<string, File>();
    for (const f of list) map.set(f.name.toLowerCase(), f);
    setImageFiles(map);
    const first = list[0] as (File & { webkitRelativePath?: string }) | undefined;
    setImageFolderName(first?.webkitRelativePath?.split("/")[0] || (list.length ? `${list.length}개 파일` : ""));
    // 이미 엑셀을 읽었으면 이미지 존재 여부 재검증
    if (rows.length) setRows(await validate(rows.map((r) => r.raw), map));
  };

  /** 파일명 → 업로드 URL (같은 파일은 한 번만) */
  const uploadImages = async (refs: string[]): Promise<Map<string, { url: string; large: string }>> => {
    const targets = Array.from(new Set(refs.filter((r) => !isImageUrl(r) && imageFiles.has(r.toLowerCase()))));
    const out = new Map<string, { url: string; large: string }>();
    let done = 0;
    setProgress({ done: 0, total: targets.length, label: "이미지 업로드" });
    const queue = [...targets];
    const worker = async () => {
      while (queue.length) {
        const ref = queue.shift()!;
        const file = imageFiles.get(ref.toLowerCase())!;
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(`${ref}: ${data.error || "업로드 실패"}`);
        out.set(ref, { url: data.url, large: data.largeUrl || data.url });
        done++;
        setProgress({ done, total: targets.length, label: "이미지 업로드" });
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, targets.length) }, worker));
    return out;
  };

  const submit = async () => {
    const ok = rows.filter((r) => r.ok);
    if (ok.length === 0) { alert("등록 가능한 행이 없습니다."); return; }
    const missing = ok.reduce((n, r) => n + r.warnings.filter((w) => w.startsWith("이미지 파일 없음")).length, 0);
    const msg = `${ok.length}건을 등록/수정합니다.` + (missing ? `\n\n⚠ 찾지 못한 이미지 ${missing}개는 비워둔 채 등록됩니다.` : "");
    if (!confirm(msg + "\n\n진행하시겠습니까?")) return;

    setSubmitting(true);
    setResult(null);
    try {
      const uploaded = await uploadImages(ok.flatMap((r) => r.imageRefs));
      const resolve = (ref: string, large = false) => {
        if (isImageUrl(ref)) return ref;
        const u = uploaded.get(ref);
        return u ? (large ? u.large : u.url) : null;
      };

      setProgress({ done: 0, total: ok.length, label: "상품 등록" });
      const payload = ok.map((r) => {
        const thumb = (r.raw.thumbnail || "").trim();
        const images = splitList(r.raw.images).map((x) => resolve(x, true)).filter((x): x is string => !!x);
        const thumbnail = thumb ? resolve(thumb) : images[0] ?? null;
        return {
          sku: r.raw.sku.trim(),
          name: r.raw.name.trim(),
          brand: r.raw.brand?.trim() || null,
          description: r.raw.description?.trim() || null,
          price: parseIntCell(r.raw.price)!,
          salePrice: parseIntCell(r.raw.salePrice),
          stock: parseIntCell(r.raw.stock)!,
          lowStockThreshold: parseIntCell(r.raw.lowStockThreshold),
          categorySlug: r.raw.categorySlug.trim(),
          thumbnail,
          images,
          optionTitle: r.raw.optionTitle?.trim() || null,
          variants: r.variants,
          isActive: (r.raw.isActive || "Y").trim().toUpperCase() !== "N",
          isFeatured: (r.raw.isFeatured || "N").trim().toUpperCase() === "Y",
        };
      });

      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "처리 실패");
      setResult(data);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  /** 엑셀 템플릿 다운로드 (3시트: 안내 / 상품등록 / 카테고리목록) */
  const downloadXlsxTemplate = () => {
    const wb = XLSX.utils.book_new();

    const guideRows: (string | number)[][] = [
      ["상품 일괄등록 안내"],
      [],
      ["1.  '상품등록' 시트에 한 행에 하나씩 상품을 입력하세요. 예시 행 2개는 지우고 쓰셔도 됩니다."],
      ["2.  '카테고리코드'는 '카테고리목록' 시트의 코드 값을 복사해 넣습니다."],
      ["3.  이미지는 URL 을 몰라도 됩니다. 사진 파일명(예: spoon-gold.jpg)만 적고, 업로드 화면에서 사진 폴더를 함께 선택하면 자동으로 올라갑니다."],
      ["4.  옵션이 있으면 '옵션명'(예: 색상)과 '옵션값'(예: 금 | 은 | 동)을 적습니다. 추가금·재고는 같은 순서로 | 구분, 비우면 0 / 재고수량 값."],
      ["5.  같은 상품코드를 다시 올리면 수정됩니다. 엑셀에서 뺀 옵션은 삭제되지 않고 숨김 처리됩니다."],
      ["6.  Y/N 칸은 대문자 Y 또는 N."],
      [],
      ["[컬럼 설명]"],
      ["컬럼명", "필수", "설명", "예시"],
      ...TEMPLATE_ORDER.map((k) => {
        const d = HEADER_DEFINITIONS[k];
        return [d.primaryKo, d.required ? "필수" : "선택", d.description, d.example] as (string | number)[];
      }),
    ];
    const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
    guideSheet["!cols"] = [{ wch: 18 }, { wch: 6 }, { wch: 60 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, guideSheet, "안내");

    const headers = TEMPLATE_ORDER.map((k) => HEADER_DEFINITIONS[k].primaryKo);
    const firstCat = categories.find((c) => c.parentId) || categories[0];
    const sample1: Record<StandardKey, string> = {
      sku: "TC-0001", name: "TPIAA 털스푼 (금색)", brand: "탑캐스팅(TPIAA)", categorySlug: firstCat?.slug || "spoon",
      price: "5000", salePrice: "", stock: "999", lowStockThreshold: "",
      thumbnail: "spoon-gold.jpg", images: "spoon-gold-2.jpg | spoon-gold-detail.jpg",
      optionTitle: "무게", options: "5g | 7g | 9g | 11g", optionPrices: "0 | 0 | 0 | 1000", optionStocks: "",
      description: "얕은 수심 배스·쏘가리용 털스푼", isActive: "Y", isFeatured: "N",
    };
    const sample2: Record<StandardKey, string> = {
      sku: "TC-0002", name: "사파이어 미노우 117", brand: "탑캐스팅(TPIAA)", categorySlug: firstCat?.slug || "floating-minnow",
      price: "8000", salePrice: "7000", stock: "999", lowStockThreshold: "",
      thumbnail: "minnow-117.jpg", images: "",
      optionTitle: "색상", options: "A390 블루 | F331 핑크 | N004 내추럴", optionPrices: "", optionStocks: "999 | 0 | 999",
      description: "", isActive: "Y", isFeatured: "Y",
    };
    const productSheet = XLSX.utils.aoa_to_sheet([
      headers,
      TEMPLATE_ORDER.map((k) => sample1[k]),
      TEMPLATE_ORDER.map((k) => sample2[k]),
    ]);
    productSheet["!cols"] = TEMPLATE_ORDER.map((k) => ({
      wch: k === "description" ? 40 : k === "name" ? 28 : k === "images" || k === "options" ? 34 : k === "optionPrices" || k === "optionStocks" ? 18 : 14,
    }));
    XLSX.utils.book_append_sheet(wb, productSheet, "상품등록");

    const catRows: (string | number)[][] = [
      ["카테고리코드 (이 값을 복사)", "이름", "상위 카테고리"],
      ...categories.map((c) => {
        const parent = categories.find((p) => p.id === c.parentId);
        return [c.slug, c.name, parent ? parent.name : "(최상위)"];
      }),
    ];
    const catSheet = XLSX.utils.aoa_to_sheet(catRows);
    catSheet["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, catSheet, "카테고리목록");

    XLSX.writeFile(wb, "상품_일괄등록_템플릿.xlsx");
  };

  /** 검증 실패 행만 모아서 엑셀로 다운로드 */
  const downloadErrors = () => {
    const errs = rows.filter((r) => !r.ok);
    if (errs.length === 0) return;
    const headers = ["행번호", "오류사유", ...TEMPLATE_ORDER.map((k) => HEADER_DEFINITIONS[k].primaryKo)];
    const data = errs.map((r) => [r.index, r.errors.join(", "), ...TEMPLATE_ORDER.map((k) => r.raw[k] || "")]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "오류행");
    XLSX.writeFile(wb, "일괄등록_오류행.xlsx");
  };

  const okCount = rows.filter((r) => r.ok).length;
  const errorCount = rows.length - okCount;
  const updateCount = rows.filter((r) => r.ok && r.willUpdate).length;
  const createCount = okCount - updateCount;
  const missingImageCount = rows.reduce((n, r) => n + r.warnings.filter((w) => w.startsWith("이미지 파일 없음")).length, 0);

  return (
    <div className="space-y-4">
      {/* 3단계 안내 */}
      <section className="bg-white rounded border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold mb-3">세 단계면 끝납니다</h2>
            <ol className="text-sm text-gray-700 space-y-2">
              <li><b>①</b> 오른쪽 <b>엑셀 템플릿</b>을 받아 상품을 한 행에 하나씩 적습니다. 이미지는 <b>파일명만</b> 적으면 됩니다 (예: <span className="font-mono">spoon-gold.jpg</span>).</li>
              <li><b>②</b> 아래에서 <b>엑셀 파일</b>과 <b>사진 폴더</b>를 선택합니다. 파일명이 맞는지 미리보기에서 바로 확인됩니다.</li>
              <li><b>③</b> <b>등록</b> 버튼을 누르면 사진이 자동 업로드되고 상품·옵션이 한 번에 들어갑니다. 같은 상품코드는 수정 처리됩니다.</li>
            </ol>
            <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>옵션은 <span className="font-mono">옵션명</span>(색상) + <span className="font-mono">옵션값</span>(금 | 은 | 동) 두 칸이면 되고, 추가금·재고는 필요할 때만 같은 순서로 적습니다.</li>
              <li>재고를 따로 관리하지 않으면 재고수량에 <span className="font-mono">999</span>를 넣으세요.</li>
              <li>한 번에 최대 2,000행. CSV 도 지원합니다.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2 min-w-[180px]">
            <button onClick={downloadXlsxTemplate} className="btn-primary text-xs h-9">📊 엑셀 템플릿 받기</button>
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">컬럼 명세 보기</summary>
              <table className="mt-2 w-[520px] max-w-full text-[11px] border border-gray-100">
                <tbody>
                  {TEMPLATE_ORDER.map((k) => {
                    const d = HEADER_DEFINITIONS[k];
                    return (
                      <tr key={k} className="border-t border-gray-100 align-top">
                        <td className="px-2 py-1 font-medium whitespace-nowrap">{d.primaryKo}{d.required && <span className="text-red-500">*</span>}</td>
                        <td className="px-2 py-1 text-gray-600">{d.description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          </div>
        </div>
      </section>

      {/* 파일 선택 */}
      <section className="bg-white rounded border border-gray-200 p-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="btn-primary inline-block cursor-pointer">
            📂 ② 엑셀 파일 선택 (.xlsx / .csv)
            <input type="file" accept=".xlsx,.xls,.csv,text/csv" hidden onChange={onFile} />
          </label>
          <div className="mt-2 text-sm text-gray-600 min-h-[20px]">{filename ? `${filename} · ${rows.length}행` : "아직 선택 안 함"}</div>
        </div>
        <div>
          <label className="btn-outline inline-block cursor-pointer">
            🖼 사진 폴더 선택
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={onImages}
              // @ts-expect-error — 폴더 선택 (Chrome/Edge/Safari 지원)
              webkitdirectory=""
            />
          </label>
          <label className="btn-outline inline-block cursor-pointer ml-2">
            여러 파일 선택
            <input type="file" accept="image/*" multiple hidden onChange={onImages} />
          </label>
          <div className="mt-2 text-sm text-gray-600 min-h-[20px]">
            {imageFiles.size ? `${imageFolderName} · 이미지 ${imageFiles.size}개` : "이미지 파일명을 엑셀에 적었다면 여기서 폴더를 선택하세요"}
          </div>
        </div>
      </section>

      {/* 미리보기 */}
      {rows.length > 0 && (
        <section className="bg-white rounded border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-wrap gap-2">
            <div className="text-sm">
              <span>미리보기 ({rows.length}행)</span>
              <span className="ml-3 text-brand-600">신규 {createCount}</span>
              <span className="ml-2 text-amber-600">수정 {updateCount}</span>
              {errorCount > 0 && <span className="ml-2 text-red-500">오류 {errorCount}</span>}
              {missingImageCount > 0 && <span className="ml-2 text-orange-500">이미지 못 찾음 {missingImageCount}</span>}
            </div>
            <div className="flex gap-2 items-center">
              {progress && (
                <span className="text-xs text-gray-500">{progress.label} {progress.done}/{progress.total}</span>
              )}
              {errorCount > 0 && (
                <button onClick={downloadErrors} className="btn-outline text-xs h-9">⚠️ 오류행 다운로드</button>
              )}
              <button onClick={submit} disabled={submitting || okCount === 0} className="btn-primary text-sm h-9">
                {submitting ? "처리 중..." : `③ ${okCount}건 등록/수정`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1200px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-2 py-2 w-10">행</th>
                  <th className="px-2 py-2 w-16">상태</th>
                  <th className="px-2 py-2 w-28">상품코드</th>
                  <th className="px-2 py-2">상품명</th>
                  <th className="px-2 py-2 w-28">카테고리</th>
                  <th className="px-2 py-2 w-20 text-right">판매가</th>
                  <th className="px-2 py-2 w-16 text-right">재고</th>
                  <th className="px-2 py-2 w-40">옵션</th>
                  <th className="px-2 py-2 w-16 text-center">이미지</th>
                  <th className="px-2 py-2">메시지</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => {
                  const foundImages = r.imageRefs.filter((x) => isImageUrl(x) || imageFiles.has(x.toLowerCase())).length;
                  return (
                    <tr key={i} className={`border-t border-gray-100 ${!r.ok ? "bg-red-50" : ""}`}>
                      <td className="px-2 py-1.5 text-gray-400">{r.index}</td>
                      <td className="px-2 py-1.5">
                        {r.ok ? (
                          r.willUpdate ?
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">수정</span> :
                            <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">신규</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">오류</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{r.raw.sku}</td>
                      <td className="px-2 py-1.5 truncate max-w-xs">{r.raw.name}</td>
                      <td className="px-2 py-1.5 font-mono">{r.raw.categorySlug}</td>
                      <td className="px-2 py-1.5 text-right">{r.raw.price}</td>
                      <td className="px-2 py-1.5 text-right">{r.raw.stock}</td>
                      <td className="px-2 py-1.5 truncate max-w-[160px]" title={r.variants.map((v) => v.name).join(", ")}>
                        {r.variants.length ? `${r.raw.optionTitle || "옵션"} ${r.variants.length}개` : <span className="text-gray-400">-</span>}
                      </td>
                      <td className={`px-2 py-1.5 text-center ${foundImages < r.imageRefs.length ? "text-orange-600" : "text-gray-600"}`}>
                        {r.imageRefs.length ? `${foundImages}/${r.imageRefs.length}` : "-"}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.errors.length > 0 && <span className="text-red-600">{r.errors.join(", ")}</span>}
                        {r.errors.length > 0 && r.warnings.length > 0 && " · "}
                        {r.warnings.length > 0 && <span className="text-orange-600">{r.warnings.join(", ")}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 200 && <p className="p-3 text-xs text-gray-500">처음 200행만 미리보기로 표시 중. 전체 {rows.length}행이 처리됩니다.</p>}
          </div>
        </section>
      )}

      {/* 결과 */}
      {result && (
        <section className="bg-white rounded border border-gray-200 p-5">
          <h2 className="font-bold mb-2">처리 결과</h2>
          <ul className="text-sm space-y-1">
            <li>✅ 신규 등록: <b>{result.created}</b>건</li>
            <li>♻️ 수정: <b>{result.updated}</b>건</li>
            {typeof result.variantsWritten === "number" && result.variantsWritten > 0 && <li>🧩 옵션 반영: <b>{result.variantsWritten}</b>개</li>}
            {result.failed > 0 && <li>❌ 실패: <b className="text-red-500">{result.failed}</b>건</li>}
          </ul>
          {result.errors?.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-gray-500">실패 사유 보기</summary>
              <ul className="mt-2 space-y-0.5 text-red-600">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

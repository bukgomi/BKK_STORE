"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { calcDiscountRate, formatKRW } from "@/lib/utils";
import VariantEditor, { type VariantRow } from "@/components/admin/VariantEditor";
import RichDescriptionEditor from "@/components/admin/RichDescriptionEditor";

export type ProductFormValue = {
  id?: string;
  sku: string;
  name: string;
  brand: string;
  description: string;
  price: number | "";
  salePrice: number | "" | null;
  stock: number | "";
  lowStockThreshold: number | "" | null;
  thumbnail: string;
  images: string[];
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string;
  variants: VariantRow[];
};

type Category = { id: string; name: string; slug: string; parentId: string | null };

type Props = {
  mode: "create" | "edit";
  initial: ProductFormValue;
  categories: Category[];
};

const EMPTY_INITIAL: ProductFormValue = {
  sku: "",
  name: "",
  brand: "",
  description: "",
  price: "",
  salePrice: null,
  stock: 0,
  lowStockThreshold: null,
  thumbnail: "",
  images: [],
  isActive: true,
  isFeatured: false,
  categoryId: "",
  variants: [],
};

export default function ProductForm({ mode, initial, categories }: Props) {
  const router = useRouter();
  const [v, setV] = useState<ProductFormValue>({ ...EMPTY_INITIAL, ...initial });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  const finalPrice = typeof v.salePrice === "number" ? v.salePrice : (typeof v.price === "number" ? v.price : 0);
  const discountRate = typeof v.price === "number" && typeof v.salePrice === "number"
    ? calcDiscountRate(v.price, v.salePrice)
    : 0;

  const validate = (): string | null => {
    if (!v.sku.trim()) return "SKU(상품번호)를 입력하세요.";
    if (!v.name.trim()) return "상품명을 입력하세요.";
    if (!v.categoryId) return "카테고리를 선택하세요.";
    if (typeof v.price !== "number" || v.price < 0) return "올바른 판매가를 입력하세요.";
    if (v.salePrice !== null && v.salePrice !== "" && (typeof v.salePrice !== "number" || v.salePrice < 0)) return "올바른 할인가를 입력하세요.";
    if (typeof v.salePrice === "number" && typeof v.price === "number" && v.salePrice >= v.price) return "할인가는 판매가보다 낮아야 합니다.";
    if (typeof v.stock !== "number" || v.stock < 0) return "올바른 재고를 입력하세요.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e1 = validate();
    if (e1) { setErr(e1); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setErr(""); setLoading(true);

    // 옵션 검증
    const validVariants: any[] = [];
    for (const vr of v.variants) {
      if (!vr.name.trim()) { setErr("옵션명을 모두 입력하세요."); setLoading(false); return; }
      if (typeof vr.stock !== "number" || vr.stock < 0) { setErr(`옵션 "${vr.name}"의 재고를 올바르게 입력하세요.`); setLoading(false); return; }
      validVariants.push({
        id: vr.id,
        name: vr.name.trim(),
        optionType: vr.optionType || "option",
        colorHex: vr.colorHex ?? null,
        stock: vr.stock,
        priceModifier: typeof vr.priceModifier === "number" ? vr.priceModifier : 0,
        sortOrder: vr.sortOrder,
        isActive: vr.isActive,
      });
    }

    const payload = {
      sku: v.sku.trim(),
      name: v.name.trim(),
      brand: v.brand.trim() || null,
      description: v.description.trim() || null,
      price: v.price,
      salePrice: typeof v.salePrice === "number" ? v.salePrice : null,
      stock: v.stock,
      lowStockThreshold: typeof v.lowStockThreshold === "number" ? v.lowStockThreshold : null,
      thumbnail: v.thumbnail.trim() || null,
      images: v.images.filter((s) => s.trim()),
      isActive: v.isActive,
      isFeatured: v.isFeatured,
      categoryId: v.categoryId,
      variants: validVariants,
    };

    try {
      const url = mode === "create" ? "/api/admin/products" : `/api/admin/products/${v.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      router.push("/admin/products");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  };

  // 이미지 업로드 (단일 또는 다중)
  const uploadFiles = async (files: FileList | null, target: "thumbnail" | "images") => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "업로드 실패");
        uploaded.push(data.url);
      }
      if (target === "thumbnail") {
        set("thumbnail", uploaded[0]);
      } else {
        set("images", [...v.images, ...uploaded]);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* 메인 컬럼 */}
        <div className="space-y-5">
          {/* 기본정보 */}
          <Section title="기본정보">
            <Field label="상품명 *" required>
              <input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU(상품번호) *" required>
                <input
                  className="input"
                  value={v.sku}
                  disabled={mode === "edit"}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="예) SKU-00001"
                />
                {mode === "edit" && <p className="text-[11px] text-gray-400 mt-1">SKU는 등록 후 변경할 수 없습니다.</p>}
              </Field>
              <Field label="브랜드">
                <input className="input" value={v.brand} onChange={(e) => set("brand", e.target.value)} />
              </Field>
            </div>
            <Field label="카테고리 *" required>
              <select className="input" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">선택하세요</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? "└ " : ""}{c.name}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          {/* 가격/재고 */}
          <Section title="가격 / 재고">
            <div className="grid grid-cols-3 gap-3">
              <Field label="판매가 (원) *" required>
                <input
                  type="number" min={0} className="input"
                  value={v.price}
                  onChange={(e) => set("price", e.target.value === "" ? "" : Number(e.target.value))}
                />
              </Field>
              <Field label="할인가 (원)">
                <input
                  type="number" min={0} className="input"
                  value={v.salePrice ?? ""}
                  placeholder="비워두면 할인 없음"
                  onChange={(e) => set("salePrice", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
              <Field label="재고 *" required>
                <input
                  type="number" min={0} className="input"
                  value={v.stock}
                  onChange={(e) => set("stock", e.target.value === "" ? "" : Number(e.target.value))}
                />
              </Field>
            </div>
            <Field label="재고 부족 임계치 (개별 설정)">
              <input
                type="number" min={0} className="input"
                value={v.lowStockThreshold ?? ""}
                placeholder="비워두면 글로벌 설정값 사용"
                onChange={(e) => set("lowStockThreshold", e.target.value === "" ? null : Number(e.target.value))}
              />
              <p className="text-[11px] text-gray-400 mt-1">이 값 이하로 재고가 떨어지면 관리자 알림이 발송됩니다.</p>
            </Field>
            {discountRate > 0 && (
              <div className="text-xs text-accent-500 mt-1 font-semibold">
                할인 적용시: {discountRate}% 할인 → {formatKRW(finalPrice)}
              </div>
            )}
          </Section>

          {/* 옵션 */}
          <Section title="옵션">
            <p className="text-xs text-gray-500 -mt-1 mb-2">
              옵션이 1개 이상 등록되면 위의 "재고" 값은 무시되고 옵션별 재고로 판매됩니다.
            </p>
            <VariantEditor
              variants={v.variants}
              onChange={(next) => set("variants", next)}
            />
          </Section>

          {/* 상품 설명 */}
          <Section title="상품 상세설명 (상세페이지)">
            <p className="text-xs text-gray-500 -mt-1 mb-2">
              직접 작성 탭에서 글과 사진으로 꾸미거나, HTML 작성 탭에 상세페이지 HTML 을 그대로 붙여 넣으세요. 권장 이미지 가로 860px.
            </p>
            <RichDescriptionEditor
              value={v.description}
              onChange={(html) => set("description", html)}
            />
          </Section>

          {/* 이미지 */}
          <Section title="이미지">
            <Field label="대표 이미지 (썸네일)">
              <div className="flex items-start gap-3">
                <div className="w-24 h-24 rounded bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumbnail || "/images/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text" className="input"
                    placeholder="이미지 URL 또는 /uploads/xxx.jpg"
                    value={v.thumbnail}
                    onChange={(e) => set("thumbnail", e.target.value)}
                  />
                  <label className="btn-outline text-xs cursor-pointer inline-block">
                    {uploading ? "업로드 중..." : "파일 선택"}
                    <input
                      type="file" accept="image/*" hidden
                      onChange={(e) => uploadFiles(e.target.files, "thumbnail")}
                    />
                  </label>
                </div>
              </div>
            </Field>

            <Field label="추가 이미지">
              <label className="btn-outline text-xs cursor-pointer inline-block mb-2">
                {uploading ? "업로드 중..." : "+ 파일 추가 (다중 선택 가능)"}
                <input
                  type="file" accept="image/*" multiple hidden
                  onChange={(e) => uploadFiles(e.target.files, "images")}
                />
              </label>
              {v.images.length === 0 ? (
                <p className="text-xs text-gray-400">추가된 이미지가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {v.images.map((src, i) => (
                    <div key={i} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded border border-gray-200 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => set("images", v.images.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          </Section>
        </div>

        {/* 사이드 컬럼 */}
        <div className="space-y-5">
          <Section title="판매 설정">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} />
              <span>판매중 (체크해제시 스토어에 노출되지 않습니다)</span>
            </label>
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={v.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
              <span>추천상품 (홈 메인에 노출)</span>
            </label>
          </Section>

          <Section title="미리보기">
            <div className="aspect-square bg-gray-100 rounded border border-gray-200 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.thumbnail || "/images/placeholder.svg"} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="mt-3">
              {v.brand && <div className="text-xs text-gray-500">{v.brand}</div>}
              <div className="text-sm font-medium line-clamp-2">{v.name || "(상품명)"}</div>
              <div className="mt-1 flex items-baseline gap-2">
                {discountRate > 0 && <span className="text-accent-500 font-bold text-sm">{discountRate}%</span>}
                <span className="text-base font-bold">{typeof finalPrice === "number" ? formatKRW(finalPrice) : "-"}</span>
              </div>
            </div>
          </Section>

          <div className="bg-white rounded border border-gray-200 p-4 space-y-2">
            <button type="submit" disabled={loading} className="btn-primary w-full h-11">
              {loading ? "저장 중..." : (mode === "create" ? "상품 등록" : "변경 저장")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/products")}
              className="btn-outline w-full h-11"
            >취소</button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded border border-gray-200 p-5">
      <h2 className="font-bold text-sm pb-3 mb-4 border-b border-gray-100">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

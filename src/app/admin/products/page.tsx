import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { formatKRW } from "@/lib/utils";
import DeleteProductButton from "./DeleteProductButton";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const PAGE_SIZE = 20;

export default async function AdminProductsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const q = (searchParams.q as string) || "";
  const category = (searchParams.category as string) || "";
  const status = (searchParams.status as string) || ""; // "active" | "inactive" | ""
  const stock = (searchParams.stock as string) || "";   // "0" 품절만
  const page = Math.max(1, parseInt((searchParams.page as string) || "1", 10));

  const where: Prisma.ProductWhereInput = {};
  if (q) where.OR = [
    { name: { contains: q, mode: "insensitive" } },
    { sku: { contains: q, mode: "insensitive" } },
    { brand: { contains: q, mode: "insensitive" } },
  ];
  if (category) where.category = { slug: category };
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (stock === "0") where.stock = 0;

  const [items, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { category: true },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">상품 관리</h1>
          <p className="text-xs text-gray-500 mt-1">총 {total.toLocaleString()}개</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/products/bulk" className="btn-outline text-sm">📊 엑셀/CSV 일괄 등록</Link>
          <Link href="/admin/products/new" className="btn-primary text-sm">+ 상품 등록</Link>
        </div>
      </div>

      {/* 검색/필터 바 */}
      <form className="bg-white rounded border border-gray-200 p-4 grid grid-cols-1 lg:grid-cols-[1fr_180px_140px_140px_auto] gap-2 items-end">
        <div>
          <label className="label">검색어</label>
          <input name="q" defaultValue={q} placeholder="상품명, SKU, 브랜드" className="input h-9" />
        </div>
        <div>
          <label className="label">카테고리</label>
          <select name="category" defaultValue={category} className="input h-9">
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">판매상태</label>
          <select name="status" defaultValue={status} className="input h-9">
            <option value="">전체</option>
            <option value="active">판매중</option>
            <option value="inactive">미판매</option>
          </select>
        </div>
        <div>
          <label className="label">재고</label>
          <select name="stock" defaultValue={stock} className="input h-9">
            <option value="">전체</option>
            <option value="0">품절</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary h-9 text-sm">검색</button>
          <Link href="/admin/products" className="btn-outline h-9 text-sm">초기화</Link>
        </div>
      </form>

      {/* 테이블 */}
      <div className="bg-white rounded border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2.5 w-16">이미지</th>
              <th className="text-left px-3 py-2.5">상품명</th>
              <th className="text-left px-3 py-2.5 w-32">SKU</th>
              <th className="text-left px-3 py-2.5 w-28">카테고리</th>
              <th className="text-right px-3 py-2.5 w-28">판매가</th>
              <th className="text-right px-3 py-2.5 w-20">재고</th>
              <th className="text-center px-3 py-2.5 w-20">상태</th>
              <th className="text-center px-3 py-2.5 w-32">액션</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-500">조건에 맞는 상품이 없습니다.</td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="w-12 h-12 rounded bg-gray-100 overflow-hidden border border-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumbnail || "/images/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/products/${p.id}/edit`} className="text-gray-800 hover:text-brand-600 line-clamp-1">{p.name}</Link>
                    {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{p.sku}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{p.category.name}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-bold">{formatKRW(p.salePrice ?? p.price)}</div>
                    {p.salePrice && <div className="text-xs text-gray-400 line-through">{formatKRW(p.price)}</div>}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${p.stock === 0 ? "text-red-500" : "text-gray-800"}`}>{p.stock}</td>
                  <td className="px-3 py-2 text-center">
                    {p.isActive ? (
                      <span className="px-2 py-0.5 text-xs rounded bg-brand-50 text-brand-700">판매중</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">미판매</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    <Link href={`/admin/products/${p.id}/edit`} className="text-brand-600 hover:underline mr-2">수정</Link>
                    <DeleteProductButton id={p.id} name={p.name} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: totalPages }).slice(0, 20).map((_, i) => {
            const n = i + 1;
            return (
              <Link
                key={n}
                href={{ query: { ...searchParams, page: n } }}
                className={`min-w-9 h-9 px-3 inline-flex items-center justify-center rounded text-sm border ${
                  n === page
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white text-gray-700 border-gray-200 hover:border-brand-500"
                }`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

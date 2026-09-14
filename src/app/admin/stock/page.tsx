import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLowStockThreshold } from "@/lib/notify";
import StockNotifyButton from "./StockNotifyButton";

export const dynamic = "force-dynamic";

export default async function AdminStockPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const threshold = getLowStockThreshold();

  const items = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { stock: "asc" },
    select: {
      id: true, name: true, sku: true, brand: true, stock: true,
      lowStockThreshold: true, price: true, salePrice: true,
      category: { select: { name: true } },
    },
  });

  const lowStock = items.filter((p) => p.stock <= (p.lowStockThreshold ?? threshold));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">재고 부족 관리</h1>
          <p className="text-xs text-gray-500 mt-1">
            글로벌 임계치: <b>{threshold}</b>개 이하 ·
            상품별 임계치는 상품 수정에서 개별 설정 가능
          </p>
        </div>
        <StockNotifyButton count={lowStock.length} />
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2.5">상품명</th>
              <th className="text-left px-3 py-2.5 w-32">SKU</th>
              <th className="text-left px-3 py-2.5 w-28">카테고리</th>
              <th className="text-right px-3 py-2.5 w-24">재고</th>
              <th className="text-right px-3 py-2.5 w-24">임계치</th>
              <th className="text-center px-3 py-2.5 w-24">액션</th>
            </tr>
          </thead>
          <tbody>
            {lowStock.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">재고 부족 상품이 없습니다 ✅</td></tr>
            ) : (
              lowStock.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/products/${p.id}/edit`} className="hover:text-brand-600">{p.name}</Link>
                    {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{p.category.name}</td>
                  <td className={`px-3 py-2.5 text-right font-bold ${p.stock === 0 ? "text-red-500" : p.stock <= 3 ? "text-red-500" : "text-amber-600"}`}>
                    {p.stock}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500">
                    {p.lowStockThreshold ?? <span className="text-gray-400">기본 ({threshold})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs">
                    <Link href={`/admin/products/${p.id}/edit`} className="text-brand-600 hover:underline">수정</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

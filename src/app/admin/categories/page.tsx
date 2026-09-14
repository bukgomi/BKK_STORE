import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import CategoryManager from "./CategoryManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  // 직렬화 가능한 형태로 변환
  const serialized = categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentId: c.parentId,
    sortOrder: c.sortOrder,
    description: c.description,
    bannerImage: c.bannerImage,
    iconEmoji: c.iconEmoji,
    productCount: c._count.products,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">카테고리 관리</h1>
        <p className="text-xs text-gray-500 mt-1">
          상품 분류 트리를 관리합니다. 1depth 카테고리(상위)와 2depth(하위)를 지원합니다.
        </p>
      </div>
      <CategoryManager initial={serialized} />
    </div>
  );
}

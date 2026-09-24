import { prisma } from "@/lib/prisma";
import { parseComponents } from "@/lib/rig";
import { descriptionToHtml } from "@/lib/product-html";
import RigExplorer, { type RigData, type RigProduct } from "./RigExplorer";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const metadata = { title: "시즌·지역 어종별 채비도", description: "월별·지역별로 잘 잡히는 어종과 그에 맞는 채비, 추천 상품을 한눈에 보세요." };

export default async function RigsPage({ searchParams }: { searchParams: { rig?: string; month?: string } }) {
  const rows = await prisma.rigGuide.findMany({ where: { isPublished: true }, orderBy: [{ species: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }).catch(() => []);
  const rigs: RigData[] = rows.map((r) => ({
    id: r.id, slug: r.slug, title: r.title, species: r.species, speciesImage: r.speciesImage, fishingType: r.fishingType,
    regions: r.regions, months: r.months, summary: r.summary, diagramImage: r.diagramImage,
    contentHtml: descriptionToHtml(r.content), components: parseComponents(r.components),
  }));
  const ids = [...new Set(rigs.flatMap((r) => r.components.flatMap((c) => c.productIds)))];
  const products = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, name: true, brand: true, thumbnail: true, price: true, salePrice: true, stock: true } }).catch(() => [])
    : [];
  const productMap: Record<string, RigProduct> = Object.fromEntries(products.map((p) => [p.id, p]));
  // 어종 사진 출처 (위키미디어 공용 CC 라이선스 — 페이지 하단에 표기)
  type Credit = { title: string; artist: string; license: string; source: string };
  const credits: Credit[] = await readFile(path.join(process.cwd(), "public/images/rigs/species/credits.json"), "utf8").then((t) => Object.values(JSON.parse(t)) as Credit[]).catch(() => [] as Credit[]);
  const initialMonth = Math.min(12, Math.max(1, parseInt(searchParams.month || "", 10) || new Date().getMonth() + 1));

  return (
    <div className="container-mall py-6 md:py-8">
      <h1 className="section-title">시즌·지역 어종별 채비도</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">월과 지역을 고르면 그때 잘 잡히는 어종과 채비, 그에 맞는 탑캐스팅 상품을 보여드립니다.</p>
      <RigExplorer rigs={rigs} productMap={productMap} initialMonth={initialMonth} initialRigSlug={searchParams.rig || null} />
      {credits.length > 0 && (
        <details className="mt-10 text-[11px] text-gray-400">
          <summary className="cursor-pointer hover:text-gray-600">지도·어종 사진 출처 (Wikimedia Commons)</summary>
          <ul className="mt-2 space-y-0.5">
            <li><a href="https://commons.wikimedia.org/wiki/File:Map_of_South_Korea-blank.svg" target="_blank" rel="noopener noreferrer" className="hover:underline">Map of South Korea-blank.svg</a> · Public domain</li>
            {credits.map((c) => (
              <li key={c.source}><a href={c.source} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.title}</a>{c.artist ? ` — ${c.artist}` : ""} · {c.license}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

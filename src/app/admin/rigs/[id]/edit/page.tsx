import { requireAdmin } from "@/lib/admin-guard";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/AdminUI";
import RigForm from "../../RigForm";
import { parseComponents } from "@/lib/rig";

export const dynamic = "force-dynamic";

export default async function AdminRigEditPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const r = await prisma.rigGuide.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!r) notFound();
  const comps = parseComponents(r.components);
  const ids = [...new Set(comps.flatMap((c) => c.productIds))];
  const [products, species] = await Promise.all([
    ids.length ? prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, thumbnail: true, price: true, salePrice: true } }) : Promise.resolve([]),
    prisma.rigGuide.findMany({ select: { species: true }, distinct: ["species"], orderBy: { species: "asc" } }).catch(() => []),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  return (
    <div className="max-w-4xl">
      <PageHeader title="채비도 수정" breadcrumbs={[{ href: "/admin", label: "관리자" }, { href: "/admin/rigs", label: "채비도" }, { label: "수정" }]} />
      <RigForm
        speciesSuggestions={species.map((s) => s.species)}
        initial={{
          id: r.id, title: r.title, slug: r.slug, species: r.species, speciesImage: r.speciesImage || "", fishingType: r.fishingType,
          regions: r.regions, months: r.months, summary: r.summary || "", diagramImage: r.diagramImage || "", content: r.content,
          components: comps.map((c) => ({ name: c.name, spec: c.spec, products: c.productIds.map((id) => byId.get(id)).filter(Boolean) as any })),
          sortOrder: r.sortOrder, isPublished: r.isPublished,
        }}
      />
    </div>
  );
}

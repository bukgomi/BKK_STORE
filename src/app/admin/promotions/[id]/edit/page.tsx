import { requireAdmin } from "@/lib/admin-guard";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHeader } from "@/components/admin/AdminUI";
import PromotionForm from "../../PromotionForm";
import { promotionHref } from "@/lib/promotion";

export const dynamic = "force-dynamic";

const toLocalInput = (d: Date | null) => {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default async function AdminPromotionEditPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const p = await prisma.promotion.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!p) notFound();
  const [products, settings] = await Promise.all([
    p.productIds.length
      ? prisma.product.findMany({ where: { id: { in: p.productIds } }, select: { id: true, name: true, thumbnail: true, price: true, salePrice: true } })
      : Promise.resolve([]),
    getSiteSettings(),
  ]);
  const ordered = p.productIds.map((id) => products.find((x) => x.id === id)).filter(Boolean) as typeof products;
  const inHero = settings.heroSlides.some((s) => s.href === promotionHref(p.slug));

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="기획전 수정"
        breadcrumbs={[{ href: "/admin", label: "관리자" }, { href: "/admin/promotions", label: "기획전 / 이벤트" }, { label: "수정" }]}
      />
      <PromotionForm
        inHero={inHero}
        initialProducts={ordered}
        initial={{
          id: p.id, title: p.title, slug: p.slug, eyebrow: p.eyebrow || "", subtitle: p.subtitle || "",
          coverImage: p.coverImage || "", bgClass: p.bgClass || "", content: p.content, productIds: p.productIds,
          isPublished: p.isPublished, startsAt: toLocalInput(p.startsAt), endsAt: toLocalInput(p.endsAt),
        }}
      />
    </div>
  );
}

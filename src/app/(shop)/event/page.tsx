import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPromotionLive, promotionHref } from "@/lib/promotion";

export const dynamic = "force-dynamic";
export const metadata = { title: "기획전 / 이벤트" };

export default async function PromotionListPage() {
  const all = await prisma.promotion.findMany({ where: { isPublished: true }, orderBy: { createdAt: "desc" }, take: 60 }).catch(() => []);
  const now = new Date();
  const live = all.filter((p) => isPromotionLive(p, now));
  const ended = all.filter((p) => !isPromotionLive(p, now) && p.endsAt && p.endsAt < now);

  const Card = ({ p, dim = false }: { p: (typeof all)[number]; dim?: boolean }) => (
    <Link href={promotionHref(p.slug)} className={`group block rounded-xl overflow-hidden border border-gray-200 ${dim ? "opacity-60" : ""}`}>
      <div className={`relative aspect-[16/7] text-white ${p.coverImage ? "bg-gray-900" : (p.bgClass || "bg-brand-600")}`}>
        {p.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        )}
        {p.coverImage && <div className="absolute inset-0 bg-black/35" />}
        <div className="absolute inset-0 p-5 flex flex-col justify-end">
          {p.eyebrow && <div className="text-xs opacity-80">{p.eyebrow}</div>}
          <div className="text-xl font-extrabold leading-tight">{p.title}</div>
          {p.subtitle && <div className="text-sm opacity-90 mt-1 line-clamp-1">{p.subtitle}</div>}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="container-mall py-8 md:py-10">
      <h1 className="section-title">기획전 / 이벤트</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">지금 진행 중인 기획전과 이벤트를 모아봤습니다.</p>
      {live.length === 0 ? (
        <p className="text-center text-gray-500 py-16 border border-dashed border-gray-300 rounded-lg">진행 중인 기획전이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{live.map((p) => <Card key={p.id} p={p} />)}</div>
      )}
      {ended.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-bold text-gray-700 mb-4">종료된 기획전</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{ended.slice(0, 6).map((p) => <Card key={p.id} p={p} dim />)}</div>
        </div>
      )}
    </div>
  );
}

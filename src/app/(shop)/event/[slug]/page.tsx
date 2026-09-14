import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";
import { descriptionToHtml, descriptionToText } from "@/lib/product-html";
import { isPromotionLive } from "@/lib/promotion";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await prisma.promotion.findUnique({ where: { slug: params.slug } }).catch(() => null);
  if (!p || !isPromotionLive(p)) return { title: "기획전을 찾을 수 없습니다", robots: { index: false } };
  const desc = p.subtitle || descriptionToText(p.content) || p.title;
  return {
    title: p.title,
    description: desc,
    openGraph: { title: p.title, description: desc, images: p.coverImage ? [{ url: p.coverImage.startsWith("http") ? p.coverImage : `${SITE}${p.coverImage}` }] : undefined },
  };
}

export default async function PromotionPage({ params }: { params: { slug: string } }) {
  const p = await prisma.promotion.findUnique({ where: { slug: params.slug } }).catch(() => null);
  if (!p || !isPromotionLive(p)) notFound();

  prisma.promotion.update({ where: { id: p.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const products = p.productIds.length
    ? await prisma.product.findMany({ where: { id: { in: p.productIds }, isActive: true } }).catch(() => [])
    : [];
  const ordered = p.productIds.map((id) => products.find((x) => x.id === id)).filter(Boolean) as typeof products;
  const html = descriptionToHtml(p.content);

  return (
    <div>
      {/* 상단 커버 */}
      <section className={`relative overflow-hidden text-white ${p.coverImage ? "bg-gray-900" : (p.bgClass || "bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500")}`}>
        {p.coverImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/25" />
          </>
        )}
        <div className="container-mall relative py-12 md:py-20">
          <nav className="text-xs text-white/70 mb-3 flex items-center gap-1">
            <Link href="/" className="hover:text-white">홈</Link><span>›</span>
            <Link href="/event" className="hover:text-white">기획전</Link>
          </nav>
          {p.eyebrow && <div className="text-sm md:text-base opacity-80">{p.eyebrow}</div>}
          <h1 className="text-3xl md:text-5xl font-extrabold mt-1.5 leading-tight">{p.title}</h1>
          {p.subtitle && <p className="mt-3 text-base md:text-lg opacity-90 max-w-2xl">{p.subtitle}</p>}
          {(p.startsAt || p.endsAt) && (
            <p className="mt-4 text-xs md:text-sm opacity-75">
              {p.startsAt ? p.startsAt.toLocaleDateString("ko-KR") : ""} ~ {p.endsAt ? p.endsAt.toLocaleDateString("ko-KR") : ""}
            </p>
          )}
        </div>
      </section>

      <div className="container-mall py-8 md:py-12 space-y-12">
        {html && <div className="product-detail max-w-[860px] mx-auto" dangerouslySetInnerHTML={{ __html: html }} />}

        {ordered.length > 0 && (
          <section>
            <h2 className="section-title mb-4">기획전 상품</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {ordered.map((prod) => <ProductCard key={prod.id} {...prod} />)}
            </div>
          </section>
        )}

        {!html && ordered.length === 0 && (
          <p className="text-center text-gray-500 py-12">준비 중인 기획전입니다.</p>
        )}
      </div>
    </div>
  );
}

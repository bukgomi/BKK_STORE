import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * Next.js 자동 sitemap.xml 생성
 * - 정적 페이지 + 활성 상품 + 카테고리
 * - 운영시 SEO 도구가 /sitemap.xml 으로 자동 접근
 */
// 빌드 시점(더미 DB, env 없음)에 굳지 않도록 런타임 생성
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: `${SITE}/`,           changeFrequency: "daily",   priority: 1.0 },
    { url: `${SITE}/products`,   changeFrequency: "daily",   priority: 0.9 },
    { url: `${SITE}/categories`, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${SITE}/notice`,     changeFrequency: "weekly",  priority: 0.5 },
    { url: `${SITE}/faq`,        changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/login`,      changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/register`,   changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/terms`,      changeFrequency: "yearly",  priority: 0.4 },
    { url: `${SITE}/privacy`,    changeFrequency: "yearly",  priority: 0.4 },
    { url: `${SITE}/shipping`,   changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/refund`,     changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/youth-protection`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({ select: { slug: true } }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 10000, // 사이트맵당 50,000 URL 제한 — 분할 권장 시점은 그 이후
      }),
    ]);

    const categoryUrls: MetadataRoute.Sitemap = categories.flatMap((c) => [
      { url: `${SITE}/category/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 },
      { url: `${SITE}/products?category=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.6 },
    ]);

    const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${SITE}/products/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...base, ...categoryUrls, ...productUrls];
  } catch {
    return base;
  }
}

import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

// 빌드 시점에 굳지 않도록 런타임 평가 (도커 빌드에는 NEXT_PUBLIC_SITE_URL 이 없어 Disallow:/ 가 굳는 사고 방지)
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // 운영 외 환경에서는 전체 차단 (스테이징/개발이 검색에 잡히지 않도록)
  const isProd = process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SITE_URL;

  if (!isProd) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/mypage/",
          "/checkout",
          "/cart",
          "/orders/",          // 본인 인증 필요한 영역
          "/_next/",
          "/uploads/",
          "*?utm_*",            // UTM 파라미터 노이즈 차단
          "*?gclid=*",
          "*?fbclid=*",
        ],
      },
      // AI 학습 봇은 별도 정책 (필요시 차단)
      {
        userAgent: ["GPTBot", "ChatGPT-User", "CCBot", "anthropic-ai"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

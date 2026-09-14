import type { MetadataRoute } from "next";

const SITE_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";

/**
 * PWA Manifest
 * 사용자가 모바일 브라우저에서 "홈 화면에 추가" 가능
 * 데스크탑 Chrome/Edge 에서도 설치 가능
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - 낚시용품 전문 쇼핑몰`,
    short_name: SITE_NAME,
    description: "낚싯대, 릴, 라인, 루어 등 낚시용품을 합리적인 가격으로",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1e6fdc",
    lang: "ko",
    scope: "/",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "장바구니", url: "/cart", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "마이페이지", url: "/mypage", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    categories: ["shopping"],
  };
}

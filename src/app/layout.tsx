import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import GAScript from "@/components/GAScript";
import Toaster from "@/components/Toaster";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const SITE_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";
const SITE_DESC = "낚싯대, 릴, 라인, 루어, 채비 등 낚시용품을 합리적인 가격으로. 3만원 이상 무료배송.";

export const metadata: Metadata = {
  metadataBase: (() => { try { return new URL(SITE); } catch { return new URL("http://localhost:3000"); } })(),
  title: {
    default: `${SITE_NAME} - 낚시용품 전문 쇼핑몰`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESC,
  keywords: ["낚시용품", "낚싯대", "릴", "루어", "채비", "낚시쇼핑몰", "바다낚시", "민물낚시"],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: { email: false, telephone: false, address: false },

  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - 낚시용품 전문 쇼핑몰`,
    description: SITE_DESC,
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - 낚시용품 전문 쇼핑몰`,
    description: SITE_DESC,
    images: ["/images/og-default.png"],
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  // 검색엔진 등록 사이트 인증 (각 콘솔에서 발급받은 메타 토큰)
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
    other: {
      "naver-site-verification": process.env.NEXT_PUBLIC_NAVER_VERIFICATION || "",
    },
  },

  alternates: {
    canonical: SITE,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1e6fdc",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-white">
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
        <GAScript />
      </body>
    </html>
  );
}

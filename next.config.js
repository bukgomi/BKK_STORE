const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // @sentry/node → @prisma/instrumentation → @opentelemetry 의 동적 require 경고
    // (동작엔 영향 없음, dev 로그만 도배) — 무시
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /@opentelemetry\/instrumentation/, message: /Critical dependency/ },
    ];
    return config;
  },
  images: {
    // 화이트리스트 도메인만 허용 (이전 hostname:"**" 는 SSRF/과금 위험)
    // 추가 도메인이 필요하면 IMAGE_REMOTE_HOSTS 콤마 환경변수에 호스트명을 등록.
    remotePatterns: [
      // 자체 업로드 / CDN
      { protocol: "https", hostname: "fishing-mall.s3.ap-northeast-2.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      // OAuth 프로필 이미지
      { protocol: "https", hostname: "ssl.pstatic.net" },        // 네이버
      { protocol: "https", hostname: "k.kakaocdn.net" },         // 카카오
      { protocol: "https", hostname: "img1.kakaocdn.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // 환경변수 동적 추가
      ...(process.env.IMAGE_REMOTE_HOSTS || "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((hostname) => ({ protocol: "https", hostname })),
    ],
  },
};

const sentryEnabled = !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN;

const sentryBuildOptions = {
  // Sentry 콘솔에서 발급된 org/project (소스맵 업로드용 — 미설정시 업로드 스킵)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // 빌드 로그 최소화
  silent: !process.env.CI,

  // 소스맵: 운영 디버깅용 업로드 (auth token 있을때만)
  widenClientFileUpload: true,

  // /monitoring 이라는 리버스 프록시 라우트 자동 생성 (광고차단기 우회)
  tunnelRoute: "/monitoring",

  // 빌드 시 라이브러리 내부 console.log 제거
  disableLogger: true,

  // 자동 instrumentation (서버/엣지 라우트 트레이싱)
  automaticVercelMonitors: true,
};

module.exports = sentryEnabled
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig;

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 보안 헤더 + CSRF Origin/Referer 검증 미들웨어
 *
 * - HSTS: HTTPS 강제 (운영 환경)
 * - X-Frame-Options: 클릭재킹 방어
 * - X-Content-Type-Options: MIME 스니핑 방어
 * - Referrer-Policy: 레퍼러 최소화
 * - Permissions-Policy: 불필요한 브라우저 기능 차단
 * - Content-Security-Policy: 외부 스크립트/이미지 화이트리스트
 * - CSRF: 상태 변경 메서드(POST/PUT/PATCH/DELETE)는 동일 Origin/Referer만 허용
 *   - PG 콜백/웹훅 라우트는 화이트리스트로 우회
 */

const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// CSRF 검증 면제 경로 prefix (PG 서버→서버 콜백, NextAuth 자체 CSRF)
const CSRF_EXEMPT_PREFIXES = [
  "/api/payments/inicis/notify",   // 서명 검증으로 보호
  "/api/payments/inicis/return",   // PG 리다이렉트(form POST), authToken 검증으로 보호
  "/api/payments/naver/return",
  "/api/payments/naver/webhook",   // 클라이언트 ID/시크릿 헤더 검증으로 보호
  "/api/payments/toss/webhook",    // HMAC 서명 검증으로 보호
  "/api/auth",                     // NextAuth 자체 CSRF 토큰 사용
  "/api/cron",                     // CRON_SECRET 검증으로 보호
];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

function checkCsrf(req: NextRequest): { ok: boolean; reason?: string } {
  if (!CSRF_METHODS.has(req.method)) return { ok: true };
  if (isCsrfExempt(req.nextUrl.pathname)) return { ok: true };

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const hostHeader = req.headers.get("host");

  // 허용 호스트: 현재 요청 host + 환경변수 화이트리스트
  const allowed = new Set<string>();
  if (hostHeader) allowed.add(hostHeader.toLowerCase());
  const fromEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  for (const o of fromEnv) {
    try { allowed.add(new URL(o).host.toLowerCase()); } catch {}
  }
  if (process.env.NEXTAUTH_URL) {
    try { allowed.add(new URL(process.env.NEXTAUTH_URL).host.toLowerCase()); } catch {}
  }

  // Origin 우선, 없으면 Referer
  if (origin) {
    try {
      const oh = new URL(origin).host.toLowerCase();
      if (!allowed.has(oh)) return { ok: false, reason: `origin not allowed: ${oh}` };
    } catch {
      return { ok: false, reason: "invalid origin" };
    }
    return { ok: true };
  }
  if (referer) {
    try {
      const rh = new URL(referer).host.toLowerCase();
      if (!allowed.has(rh)) return { ok: false, reason: `referer not allowed: ${rh}` };
    } catch {
      return { ok: false, reason: "invalid referer" };
    }
    return { ok: true };
  }
  // Origin/Referer 둘 다 없음 — same-origin fetch에서는 일반적으로 origin이 자동 부착됨.
  // 의심스러우므로 거부.
  return { ok: false, reason: "missing origin/referer" };
}

export function middleware(req: NextRequest) {
  // 1) CSRF 체크
  const csrf = checkCsrf(req);
  if (!csrf.ok) {
    return new NextResponse(
      JSON.stringify({ error: "CSRF check failed", reason: csrf.reason }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const res = NextResponse.next();

  // 결제 SDK / 주소 검색 / 추적 API / OAuth 등을 위해 외부 도메인 일부 허용
  const csp = [
    "default-src 'self'",
    // Next.js 런타임/외부 결제/SNS SDK. 'unsafe-eval'은 일부 PG SDK 호환을 위해 유지(점진적 제거 목표).
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.tosspayments.com https://stdpay.inicis.com https://t1.daumcdn.net https://*.naver.com https://nsp.pay.naver.com https://*.kakao.com https://*.kakaocdn.net https://developers.kakao.com",
    "style-src 'self' 'unsafe-inline'",
    // 외부 http: 이미지는 차단(MITM/혼합콘텐츠). 자체 업로드/CDN은 https로 일원화 권장.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.tosspayments.com https://*.inicis.com https://*.naver.com https://*.kakao.com https://info.sweettracker.co.kr https://hooks.slack.com https://apis.aligo.in",
    "frame-src 'self' https://*.tosspayments.com https://*.inicis.com https://*.naver.com https://*.kakao.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.tosspayments.com https://*.inicis.com https://*.naver.com https://*.kakao.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  res.headers.set("X-DNS-Prefetch-Control", "on");
  // /uploads/* 도 사용자 업로드라 nosniff + attachment로 직렬화 (브라우저 inline 실행 방지)
  if (req.nextUrl.pathname.startsWith("/uploads/")) {
    res.headers.set("Content-Disposition", "attachment");
    res.headers.set("X-Content-Type-Options", "nosniff");
  }

  // 운영 환경에서만 HSTS (로컬 HTTPS 인증서 문제 방지)
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  return res;
}

export const config = {
  matcher: [
    // 정적 파일과 _next 내부만 제외 — /uploads는 nosniff/attachment 적용 위해 포함
    "/((?!_next/static|_next/image|favicon.ico|images/).*)",
  ],
};

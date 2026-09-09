import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getIdentityProvider, getActiveProviderName, isMockIdentityAllowed } from "@/lib/identity-verification";
import { getClientInfo, rateLimitAsync } from "@/lib/security";

/**
 * POST /api/auth/identity/start
 * Body: { purpose: 'find-id' | 'find-password' | 'register' | 'reverify' }
 *
 * 본인인증 세션을 시작하고, 클라이언트가 PASS/모의 폼으로 이동할 정보를 반환.
 * - mock: { mode: 'form-mock', url: '/identity/mock?reqSeq=...' }
 * - nice: { mode: 'popup', url: 'https://nice.checkplus...', formData: { EncodeData: ... } }
 */

const Schema = z.object({
  purpose: z.enum(["find-id", "find-password", "register", "reverify"]),
});

export async function POST(req: NextRequest) {
  const { ip, userAgent } = getClientInfo(req);

  // IP당 분당 10회 제한 (남용 방지)
  const rl = await rateLimitAsync(`identity-start:${ip || "anon"}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
  }

  try {
    const body = Schema.parse(await req.json());

    // 콜백 URL — provider 가 인증 완료 후 호출
    const origin = process.env.NEXT_PUBLIC_SITE_URL
      || process.env.NEXTAUTH_URL
      || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const returnUrl = `${origin.replace(/\/$/, "")}/api/auth/identity/return`;

    const provider = getIdentityProvider();
    let result;
    try {
      result = await provider.start({
        purpose: body.purpose,
        returnUrl,
        ip,
        userAgent,
      });
    } catch (e: any) {
      // NICE 모듈 미결합 등 — 개발/스테이징에서만 mock 폴백 (운영에서는 명시적 실패)
      if (provider.name !== "mock" && isMockIdentityAllowed()) {
        const { mockProvider } = await import("@/lib/identity-verification/mock");
        result = await mockProvider.start({ purpose: body.purpose, returnUrl, ip, userAgent });
        return NextResponse.json({
          ...result,
          provider: "mock",
          fallback: true,
          fallbackReason: e?.message || String(e),
        });
      }
      throw e;
    }

    return NextResponse.json({
      ...result,
      provider: getActiveProviderName(),
    });
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: e?.message || "본인인증 시작 실패" }, { status: 500 });
  }
}

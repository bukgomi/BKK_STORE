import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCron } from "@/lib/cron-auth";

/**
 * 1년 미접속 회원 → 휴면 전환 (개인정보보호법)
 * 5년 이상 휴면 + 미사용 → 자동 파기 처리 (선택적)
 *
 * 호출: GET /api/cron/dormant-users  (헤더: x-cron-token: ${CRON_SECRET})
 * 권장 주기: 1일 1회
 */

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const FIVE_YEARS_MS = 5 * ONE_YEAR_MS;

export async function GET(req: NextRequest) {
  const auth = authorizeCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const now = new Date();
  const dormantThreshold = new Date(now.getTime() - ONE_YEAR_MS);
  const purgeThreshold = new Date(now.getTime() - FIVE_YEARS_MS);

  // 1) ACTIVE → DORMANT 전환
  const dormantResult = await prisma.user.updateMany({
    where: {
      status: "ACTIVE",
      OR: [
        { lastLoginAt: { lt: dormantThreshold } },
        { lastLoginAt: null, createdAt: { lt: dormantThreshold } },
      ],
    },
    data: {
      status: "DORMANT",
      dormantAt: now,
    },
  });

  // 2) 5년 이상 DORMANT/WITHDRAWN → 개인정보 파기 (PII 마스킹)
  //    이미 파기된 계정(purged_ 이메일)은 매 실행마다 다시 잡히지 않도록 제외
  const purgeTargets = await prisma.user.findMany({
    where: {
      email: { not: { startsWith: "purged_" } },
      OR: [
        { status: "DORMANT", dormantAt: { lt: purgeThreshold } },
        { status: "WITHDRAWN", withdrawnAt: { lt: purgeThreshold } },
      ],
    },
    select: { id: true },
    take: 500,
  });

  for (const u of purgeTargets) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: u.id },
        data: {
          status: "WITHDRAWN",
          withdrawnAt: now,
          email: `purged_${u.id}@example.invalid`,
          username: null,
          name: "(파기)",
          phone: null,
          phoneEnc: null,
          phoneHash: null,
          image: null,
          passwordHash: null,
          ci: null,
          di: null,
          totpSecretEnc: null,
          totpEnabled: false,
          totpBackupCodes: [],
        },
      }),
      prisma.address.deleteMany({ where: { userId: u.id } }),
      // OAuth 링크/세션까지 끊어야 소셜 로그인으로 파기 계정에 다시 들어오지 못함
      prisma.account.deleteMany({ where: { userId: u.id } }),
      prisma.session.deleteMany({ where: { userId: u.id } }),
    ]);
  }

  return NextResponse.json({
    ok: true,
    dormantConverted: dormantResult.count,
    purged: purgeTargets.length,
  });
}

export const POST = GET;

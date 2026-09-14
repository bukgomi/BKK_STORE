import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, isValidKrPhone, normalizePhone, sendSms } from "@/lib/sms";
import { getClientInfo, rateLimitAsync } from "@/lib/security";

const Schema = z.object({ phone: z.string().min(10).max(20) });

const CODE_TTL_MS = 5 * 60 * 1000;        // 5분 유효
const RESEND_WINDOW_MS = 60 * 1000;       // 60초 재발송 제한
const MAX_PER_HOUR = 5;                   // 동일 번호 시간당 5회

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    const { ip } = getClientInfo(req);
    const rl = await rateLimitAsync(`phone-send:${ip || "anon"}`, 10, 10 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });

    const { phone: rawPhone } = Schema.parse(await req.json());
    if (!isValidKrPhone(rawPhone)) {
      return NextResponse.json({ error: "올바른 휴대폰 번호가 아닙니다." }, { status: 400 });
    }
    const phone = normalizePhone(rawPhone);

    // 60초 재발송 제한
    const lastSent = await prisma.phoneVerification.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
    if (lastSent && Date.now() - lastSent.createdAt.getTime() < RESEND_WINDOW_MS) {
      const sec = Math.ceil((RESEND_WINDOW_MS - (Date.now() - lastSent.createdAt.getTime())) / 1000);
      return NextResponse.json({ error: `${sec}초 후 다시 시도해주세요.` }, { status: 429 });
    }

    // 시간당 발송 제한
    const recentCount = await prisma.phoneVerification.count({
      where: { phone, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recentCount >= MAX_PER_HOUR) {
      return NextResponse.json({ error: "1시간 발송 한도를 초과했습니다." }, { status: 429 });
    }

    const code = generateOtpCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await prisma.phoneVerification.create({
      data: { phone, codeHash, expiresAt, userId: userId || null, ip: ip || null },
    });

    const result = await sendSms({
      to: phone,
      message: `[탑캐스팅] 인증번호 [${code}] 를 입력해주세요. (5분 이내)`,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "SMS 발송 실패" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      // 콘솔 모드에서만 코드 노출 (개발 편의)
      devCode: result.provider === "console" ? code : undefined,
      expiresAt,
    });
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: e.message || "발송 실패" }, { status: 400 });
  }
}

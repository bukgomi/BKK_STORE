import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notify";

/**
 * 비밀번호 재설정 토큰 (이메일 링크 기반)
 *
 * 보안:
 * - 평문 토큰은 메일에만 노출, DB에는 SHA-256 해시만 저장
 * - 1시간 유효
 * - 1회용 (consumedAt 표시)
 * - 발급 시 동일 회원의 미사용 토큰 무효화
 * - 회원 존재 여부는 응답으로 노출하지 않음 (enumeration 방어)
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1시간

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const COMPANY = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(args: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<string> {
  // 기존 미사용 토큰 무효화
  await prisma.passwordResetToken.deleteMany({
    where: { userId: args.userId, consumedAt: null },
  });

  const token = crypto.randomBytes(32).toString("hex"); // 평문 (메일 발송용)
  await prisma.passwordResetToken.create({
    data: {
      userId: args.userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      ip: args.ip || null,
      userAgent: args.userAgent?.slice(0, 500) || null,
    },
  });

  return token;
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function consumePasswordResetToken(token: string): Promise<ConsumeResult> {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record) return { ok: false, error: "유효하지 않은 토큰입니다." };
  if (record.consumedAt) return { ok: false, error: "이미 사용된 토큰입니다." };
  if (record.expiresAt < new Date()) return { ok: false, error: "만료된 토큰입니다." };
  return { ok: true, userId: record.userId };
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.passwordResetToken.updateMany({
    where: { tokenHash, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

export async function sendResetEmail(email: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const url = `${SITE.replace(/\/$/, "")}/reset-password?token=${token}`;
  const subject = `[${COMPANY}] 비밀번호 재설정 안내`;
  const text =
`안녕하세요,

비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새 비밀번호를 설정해주세요. (1시간 유효)

${url}

본인이 요청하지 않았다면 이 메일을 무시해주세요. 비밀번호는 변경되지 않습니다.`;
  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="margin: 0 0 16px; font-size: 22px;">🔐 비밀번호 재설정</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #374151;">
        ${COMPANY} 비밀번호 재설정을 요청하셨습니다.
      </p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${url}" style="display: inline-block; padding: 12px 28px; background: #1e6fdc; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
          비밀번호 재설정
        </a>
      </p>
      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
        링크가 작동하지 않으면 다음 주소를 복사해 브라우저에 붙여넣기 해주세요:<br />
        <span style="word-break: break-all; color: #6b7280;">${url}</span>
      </p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        이 링크는 1시간 동안 유효합니다.<br />
        본인이 요청하지 않았다면 이 메일을 무시해주세요.
      </p>
    </div>
  `;
  return sendEmail({ to: email, subject, html, text });
}

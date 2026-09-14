import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notify";

/**
 * 이메일 인증 토큰 (NextAuth VerificationToken 모델 활용)
 * - 24시간 유효
 * - 기존 미사용 토큰은 무효화 후 새로 발행
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const COMPANY = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";

export async function createEmailVerifyToken(email: string): Promise<string> {
  const lower = email.toLowerCase();
  // 기존 미사용 토큰 무효화
  await prisma.verificationToken.deleteMany({ where: { identifier: lower } });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.verificationToken.create({
    data: { identifier: lower, token, expires },
  });
  return token;
}

export async function consumeEmailVerifyToken(token: string): Promise<{ ok: boolean; email?: string; error?: string }> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return { ok: false, error: "유효하지 않은 토큰입니다." };
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return { ok: false, error: "만료된 토큰입니다. 다시 인증 메일을 받아주세요." };
  }

  // 사용 후 즉시 삭제
  await prisma.verificationToken.delete({ where: { token } });

  // 회원의 emailVerified 필드 업데이트
  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  }).catch(() => {});

  return { ok: true, email: record.identifier };
}

export async function sendVerifyEmail(email: string, name?: string): Promise<{ ok: boolean; error?: string }> {
  const token = await createEmailVerifyToken(email);
  const url = `${SITE.replace(/\/$/, "")}/verify-email?token=${token}`;

  const subject = `[${COMPANY}] 이메일 인증을 완료해주세요`;
  const text =
`안녕하세요${name ? ` ${name}님` : ""},

${COMPANY} 회원가입을 환영합니다.
아래 링크를 클릭하여 이메일 인증을 완료해주세요. (24시간 유효)

${url}

본인이 가입을 신청하지 않았다면 이 메일을 무시해주세요.`;
  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="margin: 0 0 16px; font-size: 22px;">📧 이메일 인증</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #374151;">
        안녕하세요${name ? ` <b>${name}</b>님` : ""},<br />
        ${COMPANY} 회원가입을 환영합니다.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 16px 0;">
        아래 버튼을 클릭하여 이메일 인증을 완료해주세요.
      </p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${url}" style="display: inline-block; padding: 12px 28px; background: #1e6fdc; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
          이메일 인증하기
        </a>
      </p>
      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
        링크가 작동하지 않으면 다음 주소를 복사해 브라우저에 붙여넣기 해주세요:<br />
        <span style="word-break: break-all; color: #6b7280;">${url}</span>
      </p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        이 링크는 24시간 동안 유효합니다.<br />
        본인이 가입을 신청하지 않았다면 이 메일을 무시해주세요.
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text });
}

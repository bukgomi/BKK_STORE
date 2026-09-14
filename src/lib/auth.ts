import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import NaverProvider from "next-auth/providers/naver";
import KakaoProvider from "next-auth/providers/kakao";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isLoginBlocked, logLoginAttempt, getClientInfo } from "@/lib/security";
import { verifyTotp, decryptTotpSecret, verifyBackupCode, markTotpCodeUsed } from "@/lib/totp";
import { encrypt, hashPhone } from "@/lib/crypto";
import { phoneFromOAuthProfile, findPhoneOwner } from "@/lib/phone-dup";

const SIGNUP_BONUS_POINT = 1000;
// JWT 세션은 서버가 끊을 수 없으므로, 이 주기로 DB 상태(탈퇴/정지)를 다시 확인해 세션을 무효화한다
const STATUS_RECHECK_MS = 5 * 60 * 1000;

function isBlockedStatus(status: string | null | undefined) {
  return status === "WITHDRAWN" || status === "SUSPENDED";
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      username: { label: "아이디 또는 이메일", type: "text" },
      password: { label: "비밀번호", type: "password" },
      otpCode: { label: "OTP 코드 (6자리) 또는 백업코드", type: "text" },
    },
    async authorize(credentials, req) {
      const identifier = (credentials?.username || "").toLowerCase().trim();
      const password = credentials?.password;
      const otpCode = (credentials?.otpCode || "").trim();
      if (!identifier || !password) return null;

      // NextAuth authorize 콜백의 req.headers 는 plain object
      const { ip, userAgent } = getClientInfo(req?.headers as any);

      const blocked = await isLoginBlocked(identifier, ip);
      if (blocked.blocked) {
        await logLoginAttempt({ identifier, userId: null, success: false, reason: "rate_limited", ip, userAgent });
        throw new Error("로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.");
      }

      // @ 가 있으면 이메일로, 없으면 username 으로 조회
      const isEmail = identifier.includes("@");
      const user = isEmail
        ? await prisma.user.findUnique({ where: { email: identifier } })
        : await prisma.user.findUnique({ where: { username: identifier } });

      if (!user || !user.passwordHash) {
        await logLoginAttempt({ identifier, userId: user?.id || null, success: false, reason: user ? "no_password" : "no_user", ip, userAgent });
        return null;
      }

      // 탈퇴/정지 계정 차단
      if (user.status === "WITHDRAWN") {
        await logLoginAttempt({ identifier, userId: user.id, success: false, reason: "withdrawn", ip, userAgent });
        throw new Error("탈퇴 처리된 계정입니다.");
      }
      if (user.status === "SUSPENDED") {
        await logLoginAttempt({ identifier, userId: user.id, success: false, reason: "suspended", ip, userAgent });
        throw new Error("이용 정지된 계정입니다. 고객센터로 문의해주세요.");
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        await logLoginAttempt({ identifier, userId: user.id, success: false, reason: "wrong_password", ip, userAgent });
        return null;
      }

      // 2단계 인증 (TOTP) — 활성화된 회원은 OTP 6자리 또는 백업코드 필수
      if ((user as any).totpEnabled && (user as any).totpSecretEnc) {
        if (!otpCode) {
          // 클라이언트가 이 에러를 인식해서 OTP 입력 단계를 노출
          throw new Error("OTP_REQUIRED");
        }

        const digitsOnly = otpCode.replace(/\D/g, "");
        let otpOk = false;
        let usedBackup = false;
        let backupIdx = -1;

        if (/^\d{6}$/.test(digitsOnly)) {
          // TOTP 6자리 코드
          try {
            const secret = decryptTotpSecret((user as any).totpSecretEnc as string);
            otpOk = verifyTotp(digitsOnly, secret);
            if (otpOk) {
              // 재사용 방어: 동일 (userId, code) 90초 내 두 번 사용 거부
              const fresh = await markTotpCodeUsed(user.id, digitsOnly);
              if (!fresh) {
                otpOk = false;
                await logLoginAttempt({ identifier, userId: user.id, success: false, reason: "totp_replay", ip, userAgent });
                throw new Error("OTP_INVALID");
              }
            }
          } catch (err: any) {
            if (err?.message === "OTP_INVALID") throw err;
            otpOk = false;
          }
        }

        if (!otpOk) {
          // 백업코드(XXXX-XXXX) 시도
          const hashes = ((user as any).totpBackupCodes as string[]) || [];
          if (hashes.length > 0) {
            backupIdx = await verifyBackupCode(otpCode, hashes);
            if (backupIdx >= 0) {
              otpOk = true;
              usedBackup = true;
            }
          }
        }

        if (!otpOk) {
          await logLoginAttempt({ identifier, userId: user.id, success: false, reason: "wrong_otp", ip, userAgent });
          throw new Error("OTP_INVALID");
        }

        // 사용된 백업코드는 1회용 — 즉시 제거
        if (usedBackup && backupIdx >= 0) {
          const remaining = ((user as any).totpBackupCodes as string[]).filter((_, i) => i !== backupIdx);
          await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: remaining } as any });
        }
      }

      // 휴면 → 활성 자동 복귀 + lastLoginAt 갱신
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          status: user.status === "DORMANT" ? "ACTIVE" : user.status,
          dormantAt: user.status === "DORMANT" ? null : user.dormantAt,
        },
      });

      await logLoginAttempt({ identifier, userId: user.id, success: true, ip, userAgent });
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

// 네이버 OAuth (선택적)
if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
  providers.push(NaverProvider({
    clientId: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
  }));
}

// 카카오 OAuth (선택적)
if (process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_SECRET) {
  providers.push(KakaoProvider({
    clientId: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    // 카카오는 이메일이 "선택 동의"라 값이 없을 수 있음 → User.email(필수/유니크) 자리에 대체 주소를 넣어 가입 진행
    profile(profile: any) {
      const acc = profile.kakao_account || {};
      const nickname: string | undefined = acc.profile?.nickname;
      return {
        id: String(profile.id),
        name: nickname || `카카오회원${String(profile.id).slice(-4)}`,
        email: acc.email || `kakao_${profile.id}@kakao.local`,
        image: acc.profile?.profile_image_url || null,
      };
    },
  }));
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Credentials 는 authorize() 에서 이미 상태 검사 완료. OAuth 는 Adapter 가 Account 링크로
      // 기존 회원을 그대로 돌려주므로 탈퇴/정지 계정이 소셜 로그인으로 되살아나지 않게 여기서 차단.
      if (account && account.provider !== "credentials") {
        const linked = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
          select: { userId: true },
        });
        if (linked) {
          const existing = await prisma.user.findUnique({ where: { id: linked.userId }, select: { status: true } });
          if (existing && isBlockedStatus(existing.status)) return "/login?error=AccountBlocked";
          return true;
        }
        // 이 소셜 계정으로는 처음 → 신규 가입(또는 이메일 연결) 직전. 휴대폰 번호가 같은 기존 회원이 있으면 중복 가입 안내
        const phone = phoneFromOAuthProfile(account.provider, profile);
        if (phone) {
          const owner = await findPhoneOwner(phone);
          if (owner) {
            const q = new URLSearchParams({ error: "PhoneDuplicate", methods: owner.methods.join(","), hint: owner.hint });
            return `/login?${q.toString()}`;
          }
        }
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = (user as any).id;
        // 소셜 로그인 시 동의받은 휴대폰 번호를 회원 정보에 채움 (아직 번호가 없을 때만) → 이후 중복 가입 검사 기준
        if (account && account.provider !== "credentials") {
          const phone = phoneFromOAuthProfile(account.provider, profile);
          if (phone) {
            try {
              const cur = await prisma.user.findUnique({ where: { id: (user as any).id as string }, select: { phoneHash: true } });
              if (cur && !cur.phoneHash) {
                await prisma.user.update({ where: { id: (user as any).id as string }, data: { phone, phoneEnc: encrypt(phone), phoneHash: hashPhone(phone), phoneVerifiedAt: new Date() } });
              }
            } catch (e) { console.error("oauth phone save error", e); }
          }
        }
        // DB role 을 세션에 실어 헤더의 "관리자" 링크 등이 이메일 화이트리스트 없이도 판단할 수 있게
        const ur = await prisma.user.findUnique({ where: { id: (user as any).id as string }, select: { role: true } });
        if (ur) token.role = ur.role;
        token.statusCheckedAt = Date.now();
      }
      // 처음 로그인시 user.id 가 셋팅되도록 보장
      if (!token.id && token.email) {
        const u = await prisma.user.findUnique({ where: { email: token.email as string } });
        if (u) token.id = u.id;
      }

      const checkedAt = (token.statusCheckedAt as number | undefined) ?? 0;
      if (token.id && Date.now() - checkedAt > STATUS_RECHECK_MS) {
        const u = await prisma.user.findUnique({ where: { id: token.id as string }, select: { status: true, role: true } });
        token.blocked = !u || isBlockedStatus(u.status);
        if (u) token.role = u.role;
        token.statusCheckedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      // 탈퇴/정지된 회원은 세션 자체를 돌려주지 않음 → 모든 라우트의 session 체크에서 401
      if (token.blocked) return null as any;
      if (session.user && token.id) (session.user as any).id = token.id;
      if (session.user && token.role) (session.user as any).role = token.role;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // OAuth 가입자에게도 가입 축하 적립금 지급
      if (!user.id) return;
      try {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { pointBalance: { increment: SIGNUP_BONUS_POINT } },
          }),
          prisma.pointHistory.create({
            data: {
              userId: user.id,
              amount: SIGNUP_BONUS_POINT,
              reason: "회원가입 축하 (소셜)",
            },
          }),
        ]);
      } catch (e) {
        console.error("signup bonus error", e);
      }
    },
    async signIn({ user, account }) {
      // Credentials 는 authorize() 에서 이미 기록 → OAuth 로그인만 여기서 기록
      if (!account || account.provider === "credentials") return;
      const { ip, userAgent } = getClientInfo();
      if (user.email) {
        await logLoginAttempt({
          email: user.email,
          userId: user.id || null,
          success: true,
          reason: `oauth:${account.provider}`,
          ip, userAgent,
        });
      }
    },
  },
};

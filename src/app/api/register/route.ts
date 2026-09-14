import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkPasswordStrength, getClientInfo, rateLimitAsync } from "@/lib/security";
import { encrypt, hashPhone } from "@/lib/crypto";
import { validateUsernameFormat, normalizeUsername } from "@/lib/username";
import { findPhoneOwner, describeMethods } from "@/lib/phone-dup";

const Schema = z.object({
  username: z.string().min(4).max(20),
  email: z.string().email().max(320),
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(60),
  phone: z.string().max(20).optional(),
});

const SIGNUP_BONUS_POINT = 1000;

export async function POST(req: NextRequest) {
  try {
    const { ip } = getClientInfo(req);
    const rl = await rateLimitAsync(`register:${ip || "anon"}`, 5, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const data = Schema.parse(await req.json());

    // 아이디 형식 검증
    const unameCheck = validateUsernameFormat(data.username);
    if (!unameCheck.ok) {
      return NextResponse.json({ error: unameCheck.reason }, { status: 400 });
    }
    const username = normalizeUsername(data.username);

    const pwCheck = checkPasswordStrength(data.password);
    if (!pwCheck.ok) {
      return NextResponse.json({ error: pwCheck.reason }, { status: 400 });
    }

    const email = data.email.toLowerCase().trim();

    // 동시 가입 방지: 두 unique 컬럼 동시 검사
    const [emailExists, unameExists] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.user.findUnique({ where: { username }, select: { id: true } }),
    ]);
    if (unameExists) return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    if (emailExists) return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });

    const passwordHash = await bcrypt.hash(data.password, 12);

    const phoneRaw = data.phone?.replace(/[^0-9]/g, "") || null;
    // 같은 휴대폰 번호로 이미 가입된 회원이 있으면 중복 가입 안내 (소셜 가입 포함)
    if (phoneRaw) {
      const owner = await findPhoneOwner(phoneRaw);
      if (owner) {
        const how = describeMethods(owner.methods);
        return NextResponse.json({ error: `이미 이 휴대폰 번호로 가입된 계정이 있습니다. (${how} 로그인${owner.hint ? `, 아이디 ${owner.hint}` : ""}) 아이디/비밀번호 찾기를 이용해 주세요.` }, { status: 409 });
      }
    }
    const phoneEnc = phoneRaw ? encrypt(phoneRaw) : null;
    const phoneHash = phoneRaw ? hashPhone(phoneRaw) : null;

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username,
          email,
          name: data.name.trim(),
          phone: phoneRaw,                 // 평문 (호환)
          phoneEnc,                        // 암호화
          phoneHash,                       // 검색용 해시
          passwordHash,
          pointBalance: SIGNUP_BONUS_POINT,
          passwordChangedAt: new Date(),
        },
        select: { id: true, email: true, name: true, username: true },
      });

      // 가입 축하 적립금 이력
      if (SIGNUP_BONUS_POINT > 0) {
        await tx.pointHistory.create({
          data: {
            userId: u.id,
            amount: SIGNUP_BONUS_POINT,
            reason: "회원가입 축하",
          },
        });
      }

      return u;
    });

    // 이메일 인증 메일 비동기 발송 (실패해도 가입은 완료)
    void (async () => {
      try {
        const { sendVerifyEmail } = await import("@/lib/email-verify");
        const r = await sendVerifyEmail(user.email, user.name);
        if (r.ok) {
          await prisma.user.update({ where: { id: user.id }, data: { emailVerifySentAt: new Date() } });
        }
      } catch {}
    })();

    return NextResponse.json(user);
  } catch (e: any) {
    // 동시성 race: unique 제약 충돌 (P2002)
    if (e?.code === "P2002") {
      const target = (e?.meta?.target as string[] | string | undefined);
      const isUsername = Array.isArray(target) ? target.includes("username") : String(target || "").includes("username");
      return NextResponse.json(
        { error: isUsername ? "이미 사용 중인 아이디입니다." : "이미 가입된 이메일입니다." },
        { status: 409 }
      );
    }
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: e.message || "회원가입 실패" }, { status: 400 });
  }
}

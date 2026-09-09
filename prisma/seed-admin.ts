/**
 * 관리자 계정 부트스트랩 시드
 *
 * 사용:
 *   npm run db:seed:admin
 *
 * 환경변수:
 *   ADMIN_EMAILS  — 쉼표 구분 (.env 에 이미 설정되어 있다면 사용)
 *   ADMIN_PASSWORD — 비밀번호 (없으면 'changeme1234!' 기본값. 운영 전 반드시 변경)
 *   ADMIN_NAME    — 표시 이름 (기본값 "관리자")
 *
 * 동작:
 *   ADMIN_EMAILS 의 각 이메일에 대해 User 가 없으면 새로 만들고,
 *   있으면 role 을 ADMIN 으로 승격한다 (passwordHash 는 덮어쓰지 않음).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const emails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error("[!] ADMIN_EMAILS 환경변수가 비어있습니다. .env 에 설정하세요.");
    process.exit(1);
  }

  const password = process.env.ADMIN_PASSWORD || "changeme1234!";
  const name = process.env.ADMIN_NAME || "관리자";
  const passwordHash = await bcrypt.hash(password, 10);

  for (const email of emails) {
    const existing = await prisma.user.findUnique({ where: { email } });

    // 이메일 local part 에서 username 후보 생성 (a-z0-9_ 만 허용, 4~20자)
    const localPart = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "_") || "admin";
    let unameCandidate = localPart.slice(0, 20);
    if (unameCandidate.length < 4) unameCandidate = (unameCandidate + "_admin").slice(0, 20);
    // 충돌 회피
    let username = unameCandidate;
    let suffix = 1;
    while (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
      const tail = String(suffix++);
      username = unameCandidate.slice(0, 20 - tail.length - 1) + "_" + tail;
      if (suffix > 99) { username = `admin_${Date.now().toString(36).slice(-6)}`; break; }
    }

    if (existing) {
      const resetPw = /^(1|true|yes)$/i.test(process.env.ADMIN_RESET_PASSWORD || "");
      const updated = await prisma.user.update({
        where: { email },
        data: {
          role: existing.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
          status: "ACTIVE",
          // 기존 회원에 username 이 없으면 채워준다
          ...(existing.username ? {} : { username }),
          // ADMIN_RESET_PASSWORD=true 면 비밀번호를 ADMIN_PASSWORD 로 덮어씀 (로컬 초기화용)
          ...(resetPw ? { passwordHash, passwordChangedAt: new Date(), totpEnabled: false, totpSecretEnc: null, totpBackupCodes: [] } : {}),
        },
      });
      console.log(`[=] 기존 회원 ${email} → role=${updated.role} (username=${updated.username || "-"})${resetPw ? ` · 비밀번호 재설정: ${updated.username} / ${password}` : ""}`);
    } else {
      const created = await prisma.user.create({
        data: {
          username,
          email,
          name,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          emailVerified: new Date(),
        },
      });
      console.log(`[+] 새 관리자 생성: ${email} (id=${created.id}, username=${created.username})`);
      console.log(`    로그인: ${created.username} / ${password}`);
      console.log(`    !!! 운영 전 반드시 비밀번호를 변경하세요 !!!`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

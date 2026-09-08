import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

/**
 * 관리자 권한 체크 (DB role 기반 + ADMIN_EMAILS bootstrap)
 *
 * - User.role 이 ADMIN | SUPER_ADMIN 이면 통과
 * - 또는 ADMIN_EMAILS 에 포함된 이메일이면 자동 ADMIN 으로 승격 후 통과
 *   (최초 부트스트랩 + 비상 접근용)
 */

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

const ADMIN_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];
const STAFF_ROLES: UserRole[] = ["CS_AGENT", "ADMIN", "SUPER_ADMIN"];

type AdminCheckResult =
  | { ok: true; userId: string; email: string; role: UserRole }
  | { ok: false; status: number; error: string };

async function resolveAdmin(): Promise<AdminCheckResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { ok: false, status: 401, error: "로그인이 필요합니다." };
  }
  const email = session.user.email.toLowerCase();
  const userId = (session.user as any).id as string | undefined;

  let user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findUnique({ where: { email } });

  // ADMIN_EMAILS 부트스트랩: env에 있으면 자동 ADMIN 승격
  if (user && !ADMIN_ROLES.includes(user.role) && isAdminEmail(email)) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
  }

  if (!user) {
    return { ok: false, status: 401, error: "회원 정보를 찾을 수 없습니다." };
  }
  if (user.status === "WITHDRAWN" || user.status === "SUSPENDED") {
    return { ok: false, status: 403, error: "이용이 제한된 계정입니다." };
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    return { ok: false, status: 403, error: "관리자만 접근할 수 있습니다." };
  }

  return { ok: true, userId: user.id, email: user.email, role: user.role };
}

/** 서버 컴포넌트용. 비관리자면 리다이렉트 */
export async function requireAdmin() {
  const result = await resolveAdmin();
  if (!result.ok) {
    if (result.status === 401) redirect("/login?callbackUrl=/admin");
    redirect("/?error=forbidden");
  }
  // 호환성을 위해 session 모양 유지
  return {
    user: { id: result.userId, email: result.email, name: result.email, role: result.role },
  };
}

/** Route Handler 용. 비관리자면 401/403 */
export async function assertAdminApi() {
  const result = await resolveAdmin();
  if (!result.ok) return result;
  return {
    ok: true as const,
    session: { user: { id: result.userId, email: result.email, role: result.role } },
  };
}

/** CS 권한 (CS_AGENT 이상) */
export async function assertStaffApi() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "로그인이 필요합니다." };
  const userId = (session.user as any).id as string | undefined;
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user) return { ok: false as const, status: 401, error: "회원 정보를 찾을 수 없습니다." };
  if (user.status === "WITHDRAWN" || user.status === "SUSPENDED") {
    return { ok: false as const, status: 403, error: "이용이 제한된 계정입니다." };
  }
  if (STAFF_ROLES.includes(user.role)) return { ok: true as const, session };
  if (isAdminEmail(session.user.email)) return { ok: true as const, session };
  return { ok: false as const, status: 403, error: "직원 권한이 필요합니다." };
}

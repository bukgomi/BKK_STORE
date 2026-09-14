// 휴대폰 번호 중복 가입 검사 — 아이디 가입 / 네이버 / 카카오 공통
import { prisma } from "@/lib/prisma";
import { hashPhone } from "@/lib/crypto";

/** "+82 10-1234-5678", "010-1234-5678" 등을 "01012345678" 로 정규화. 형식이 아니면 null */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let n = String(raw).replace(/[^0-9+]/g, "");
  if (n.startsWith("+82")) n = "0" + n.slice(3);
  n = n.replace(/[^0-9]/g, "");
  if (n.length < 10 || n.length > 11) return null;
  return n;
}

/** 소셜 프로필에서 휴대폰 번호 추출 (동의 항목에 포함된 경우에만 값이 있음) */
export function phoneFromOAuthProfile(provider: string, profile: any): string | null {
  if (!profile) return null;
  if (provider === "naver") return normalizePhone(profile.response?.mobile);
  if (provider === "kakao") return normalizePhone(profile.kakao_account?.phone_number);
  return null;
}

export type PhoneOwner = {
  id: string;
  /** 기존 계정의 로그인 방법: "credentials" | "naver" | "kakao" (여러 개면 콤마) */
  methods: string[];
  /** 안내용 마스킹 아이디/이메일 (예: to***, ab***@gmail.com) */
  hint: string;
};

function maskId(s: string) {
  if (!s) return "";
  if (s.includes("@")) { const [a, d] = s.split("@"); return `${a.slice(0, 2)}***@${d}`; }
  return `${s.slice(0, 2)}***`;
}

/** 같은 휴대폰 번호로 가입된(탈퇴 제외) 다른 회원을 찾는다 */
export async function findPhoneOwner(phone: string, excludeUserId?: string): Promise<PhoneOwner | null> {
  const phoneHash = hashPhone(phone);
  const u = await prisma.user.findFirst({
    where: { phoneHash, status: { not: "WITHDRAWN" }, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { id: true, username: true, email: true, passwordHash: true, accounts: { select: { provider: true } } },
  });
  if (!u) return null;
  const methods = new Set<string>();
  if (u.passwordHash) methods.add("credentials");
  for (const a of u.accounts) methods.add(a.provider);
  const isPlaceholder = /@kakao\.local$/.test(u.email);
  return { id: u.id, methods: [...methods], hint: maskId(u.username || (isPlaceholder ? "" : u.email)) };
}

/** 안내 문구용 로그인 방법 라벨 */
export function describeMethods(methods: string[]): string {
  const label: Record<string, string> = { credentials: "아이디/비밀번호", naver: "네이버", kakao: "카카오" };
  return methods.map((m) => label[m] || m).join(", ");
}

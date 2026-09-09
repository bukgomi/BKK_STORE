import crypto from "node:crypto";

const TTL_MIN = parseInt(process.env.IDENTITY_TTL_MIN || "10", 10);

/**
 * mock 본인인증 허용 여부.
 * mock 은 폼에 적은 이름/생년월일/휴대폰을 그대로 "인증 완료"로 믿기 때문에
 * 운영에서는 IDENTITY_ALLOW_MOCK=true 로 명시하지 않는 한 절대 허용하지 않는다.
 */
export function isMockIdentityAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.IDENTITY_ALLOW_MOCK === "true";
}

/** TTL 분 단위 — 일반적으로 5~10분 */
export function defaultExpiresAt(): Date {
  return new Date(Date.now() + TTL_MIN * 60 * 1000);
}

/** reqSeq — 본인확인기관에 전달하는 16~40 byte 랜덤 시퀀스 */
export function generateReqSeq(): string {
  return crypto.randomBytes(16).toString("hex").toUpperCase();
}

/** 안전 비교 (timing-safe) */
export function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** 마스킹 — 아이디: 앞 2자 + ***N자*** + 마지막 1자 */
export function maskUsername(username: string): string {
  if (username.length <= 4) return username[0] + "***";
  const head = username.slice(0, 2);
  const tail = username.slice(-1);
  const stars = "*".repeat(Math.max(3, username.length - 3));
  return `${head}${stars}${tail}`;
}

/** 마스킹 — 이메일: 로컬파트 앞 2자 + ***@domain */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`;
}

/** 마스킹 — 휴대폰: 010-****-1234 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return phone;
  const last4 = digits.slice(-4);
  const head = digits.slice(0, 3);
  return `${head}-****-${last4}`;
}

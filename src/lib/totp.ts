import qrcode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { encrypt, decrypt } from "@/lib/crypto";
import { getRedis } from "@/lib/redis";

/**
 * TOTP 2단계 인증 (Google Authenticator / Authy 등 호환)
 * - secret 은 AES-256-GCM 암호화하여 DB 저장
 * - 백업 코드 8자리 영숫자, bcrypt 해시 (1회 사용)
 *
 * otplib v13 은 ESM-first 이며 Next.js 의 require() 와 호환성이 불안정해
 * 모듈 로드 시점이 아닌 첫 호출 시점에 lazy require 한다.
 * 그렇지 않으면 단순 import 만으로 모듈 init 이 죽으면서 NextAuth 체인 전체가 깨진다.
 */

let _authenticator: any = null;
function getAuthenticator() {
  if (_authenticator) return _authenticator;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("otplib");
  // v13 은 default export, v12 는 named export — 양쪽 호환
  const auth = mod.authenticator || mod.default?.authenticator;
  if (!auth) throw new Error("otplib authenticator not found — package version unsupported");
  auth.options = { window: 1, step: 30 };
  _authenticator = auth;
  return auth;
}

const ISSUER = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";

export function generateTotpSecret(email: string) {
  const a = getAuthenticator();
  const secret = a.generateSecret();
  const otpauth = a.keyuri(email, ISSUER, secret);
  return { secret, otpauth };
}

export async function generateQrDataUrl(otpauth: string): Promise<string> {
  return qrcode.toDataURL(otpauth, { width: 240, margin: 1 });
}

/** 코드 검증 */
export function verifyTotp(code: string, secret: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    return getAuthenticator().verify({ token: code, secret });
  } catch { return false; }
}

/**
 * TOTP 재사용 방어.
 * 동일 사용자 + 동일 코드(또는 동일 step)를 30~60초 내 두 번 사용하면 거부.
 *
 * - Redis: 정확한 분산 보장
 * - Redis 없음: 인메모리 폴백 (단일 인스턴스 한정)
 *
 * 사용:
 *   const ok = verifyTotp(code, secret);
 *   if (ok) {
 *     const fresh = await markTotpCodeUsed(userId, code);
 *     if (!fresh) {  // 이미 사용됨
 *       return ...
 *     }
 *   }
 */
const usedCodeMem = new Map<string, number>();

export async function markTotpCodeUsed(userId: string, code: string): Promise<boolean> {
  const key = `totp:used:${userId}:${code}`;
  const ttlSec = 90; // step(30s) * window(1) * 2 + 여유
  const r = getRedis();
  if (r) {
    try {
      const ok = await r.set(key, "1", "EX", ttlSec, "NX");
      return ok === "OK";
    } catch {
      // fall through to memory
    }
  }
  // 인메모리 폴백
  const now = Date.now();
  // GC: 오래된 키 정리 (선형, 매 호출마다 — 사이즈 작음)
  for (const [k, t] of usedCodeMem) {
    if (t < now) usedCodeMem.delete(k);
  }
  if (usedCodeMem.has(key)) return false;
  usedCodeMem.set(key, now + ttlSec * 1000);
  return true;
}

/** DB 저장용 암호화 */
export function encryptTotpSecret(secret: string): string {
  return encrypt(secret);
}
export function decryptTotpSecret(enc: string): string {
  return decrypt(enc);
}

/* ==== 백업 코드 ==== */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c.toUpperCase(), 8)));
}

/** 백업 코드 검증 — 일치하는 해시 인덱스 반환 (-1 = 불일치) */
export async function verifyBackupCode(input: string, hashes: string[]): Promise<number> {
  const normalized = input.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(formatted, hashes[i])) return i;
  }
  return -1;
}

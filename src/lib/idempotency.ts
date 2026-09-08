import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Idempotency-Key 미들웨어 헬퍼
 * - 동일 키 + scope 로 들어온 요청은 저장된 응답 그대로 반환
 * - 중복 클릭, 네트워크 재시도 등으로 인한 중복 생성 방지
 *
 * 사용:
 *   const cached = await checkIdempotency(req, "orders.create", userId);
 *   if (cached) return cached;
 *   // ... 실제 로직 ...
 *   const res = NextResponse.json({ ok: true });
 *   await saveIdempotency(req, "orders.create", userId, res, 200, body);
 *   return res;
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24시간

export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key");
}

export async function checkIdempotency(
  req: Request,
  scope: string,
  userId: string | null
): Promise<NextResponse | null> {
  const key = getIdempotencyKey(req);
  if (!key) return null;

  const existing = await prisma.idempotencyKey.findUnique({ where: { key } }).catch(() => null);
  if (!existing) return null;
  if (existing.scope !== scope) return null;
  if (existing.expiresAt < new Date()) return null;
  // 키는 전역 유일하므로 다른 사용자(비회원 포함)가 남의 응답을 재생하지 못하게 소유자를 엄격 비교
  if (existing.userId !== (userId ?? null)) return null;

  try {
    const body = JSON.parse(existing.responseBody);
    return NextResponse.json(body, {
      status: existing.responseStatus,
      headers: { "Idempotency-Replayed": "true" },
    });
  } catch {
    return null;
  }
}

export async function saveIdempotency(
  req: Request,
  scope: string,
  userId: string | null,
  status: number,
  body: any
): Promise<void> {
  const key = getIdempotencyKey(req);
  if (!key) return;
  await prisma.idempotencyKey.upsert({
    where: { key },
    create: {
      key, scope, userId,
      responseStatus: status,
      responseBody: JSON.stringify(body),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
    update: {},
  }).catch(() => {/* 키 충돌 등은 무시 */});
}

/** 만료된 키 정리 (cron 권장) */
export async function purgeExpiredIdempotencyKeys(): Promise<number> {
  const r = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return r.count;
}

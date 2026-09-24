/**
 * Next.js 14 instrumentation hook
 * - 서버 부팅 시 한 번 호출되어 Sentry 초기화
 * - 개발 환경에서는 BullMQ 워커도 같은 프로세스에서 자동 시작
 *   (운영 환경은 scripts/worker.ts 별도 프로세스 권장)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "production") assertProductionEnv();
    await import("./sentry.server.config");

    // 개발 환경 + DISABLE_INPROCESS_WORKER 미설정 시 워커 자동 시작
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.DISABLE_INPROCESS_WORKER !== "true"
    ) {
      const { startWorkers } = await import("./src/lib/workers");
      startWorkers();
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** 운영 필수 설정 검증 — 잘못되면 기동 직후 에러 로그 (요청 시점 500 대신) */
function assertProductionEnv() {
  const problems: string[] = [];
  const key = process.env.ENCRYPTION_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(key)) problems.push("ENCRYPTION_KEY 는 64자 hex 여야 합니다 (openssl rand -hex 32)");
  for (const name of ["NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL"]) {
    const v = process.env[name] || "";
    try { new URL(v); } catch { problems.push(name + " 이 올바른 URL 이 아닙니다: \"" + v + "\""); }
    if (/PLACEHOLDER/i.test(v)) problems.push(name + " 에 PLACEHOLDER 가 남아 있습니다");
  }
  if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32 || /PLACEHOLDER/i.test(process.env.NEXTAUTH_SECRET)) problems.push("NEXTAUTH_SECRET 이 없거나 너무 짧습니다 (openssl rand -base64 32)");
  if (!process.env.CRON_SECRET || /PLACEHOLDER/i.test(process.env.CRON_SECRET)) problems.push("CRON_SECRET 이 비어 있습니다");
  if (problems.length) {
    console.error("\n[config] 운영 환경변수 오류 — .env.production 을 확인하세요:\n - " + problems.join("\n - ") + "\n");
  }
}

/**
 * Next 15+ 표준 — 라우트 핸들러/RSC 에서 throw 된 에러를 Sentry 로 전송
 * Sentry v10 export: captureRequestError → onRequestError 로 노출
 */
export { captureRequestError as onRequestError } from "@sentry/nextjs";

/**
 * SMS 발송 모듈
 * - 알리고(Aligo) API 기본 지원: https://smartsms.aligo.in
 * - 환경변수 미설정시: 콘솔에 출력 (개발 모드)
 *
 * .env:
 *   ALIGO_API_KEY=...
 *   ALIGO_USER_ID=...
 *   ALIGO_SENDER=01012345678   (사전등록된 발신번호)
 */

export type SmsResult = { ok: boolean; provider: string; messageId?: string; error?: string };

/** 휴대폰 번호 정규화: 숫자만 남기고, 010-1234-5678 → 01012345678 */
export function normalizePhone(input: string): string {
  return (input || "").replace(/[^0-9]/g, "");
}

/** 한국 휴대폰 번호 형식 검증 (010, 011, 016~019) */
export function isValidKrPhone(input: string): boolean {
  const n = normalizePhone(input);
  return /^01[016789]\d{7,8}$/.test(n);
}

/** 6자리 숫자 코드 생성 */
export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 가독성을 위해 마스킹된 번호: 010-****-5678 */
export function maskPhone(input: string): string {
  const n = normalizePhone(input);
  if (n.length < 10) return input;
  return `${n.slice(0, 3)}-****-${n.slice(-4)}`;
}

export async function sendSms(args: { to: string; message: string }): Promise<SmsResult> {
  const to = normalizePhone(args.to);
  if (!isValidKrPhone(to)) return { ok: false, provider: "none", error: "잘못된 휴대폰 번호 형식" };

  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;

  // 환경변수 미설정시: 개발용 콘솔 모드
  if (!apiKey || !userId || !sender) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, provider: "none", error: "SMS 발송 설정(ALIGO_API_KEY/ALIGO_USER_ID/ALIGO_SENDER)이 없습니다" };
    }
    console.warn(`[SMS-DEV] To: ${to}\n${args.message}`);
    return { ok: true, provider: "console", messageId: "dev-" + Date.now() };
  }

  try {
    const body = new URLSearchParams({
      key: apiKey,
      user_id: userId,
      sender: normalizePhone(sender),
      receiver: to,
      msg: args.message,
      msg_type: args.message.length > 90 ? "LMS" : "SMS",
    });

    const res = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body,
    });
    const data = await res.json();

    if (data.result_code === "1") {
      return { ok: true, provider: "aligo", messageId: String(data.msg_id) };
    }
    return { ok: false, provider: "aligo", error: data.message || "발송 실패" };
  } catch (e: any) {
    return { ok: false, provider: "aligo", error: e.message || "네트워크 오류" };
  }
}

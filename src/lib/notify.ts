import nodemailer from "nodemailer";
import { sendSms } from "@/lib/sms";
import { notifyAdminNewOrder as sendAdminAlimtalk } from "@/lib/alimtalk";
import { formatKRW } from "@/lib/utils";

export function getLowStockThreshold(): number {
  const v = parseInt(process.env.LOW_STOCK_THRESHOLD || "10", 10);
  return Number.isFinite(v) && v >= 0 ? v : 10;
}

/** ADMIN_NOTIFY_PHONE 환경변수에서 알림 받을 휴대폰 번호 목록 (콤마 구분) */
export function getAdminNotifyPhones(): string[] {
  return (process.env.ADMIN_NOTIFY_PHONE || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 신규 주문 알림 활성화 여부 (env로 제어) */
export function isNewOrderNotifyEnabled(): boolean {
  const v = (process.env.ADMIN_NEW_ORDER_NOTIFY || "true").toLowerCase();
  return v === "true" || v === "1" || v === "y";
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) return { ok: false, error: "SMTP 환경변수가 설정되지 않았습니다." };

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message || "메일 발송 실패" };
  }
}

export async function sendSlack(text: string, blocks?: any[]): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: false, error: "SLACK_WEBHOOK_URL 미설정" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
    if (!res.ok) return { ok: false, error: `Slack ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message || "Slack 발송 실패" };
  }
}

/**
 * 통합 발송: 이메일 + Slack (둘 다 시도, 결과 합쳐서 반환)
 */
export async function notifyAdmin(args: { subject: string; html: string; text: string }): Promise<{
  email: { ok: boolean; error?: string };
  slack: { ok: boolean; error?: string };
}> {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  const email = adminEmail
    ? await sendEmail({ to: adminEmail, subject: args.subject, html: args.html, text: args.text })
    : { ok: false, error: "ADMIN_NOTIFY_EMAIL 미설정" };
  const slack = await sendSlack(`*${args.subject}*\n${args.text}`);
  return { email, slack };
}

/**
 * 신규 주문 → 관리자 종합 알림
 *  - 카카오 알림톡 (Aligo failover 로 자동 SMS 폴백)
 *  - 이메일 (요약본)
 *  - Slack
 *  - 알림톡 미설정 + 카톡 발송 실패 대비 SMS 직접 발송 옵션 (FORCE_SMS=true)
 *
 * 모든 채널은 병렬로 시도하며 일부 실패해도 전체 결과는 ok 유지.
 */
export async function notifyAdminOrderReceived(args: {
  orderId: string;
  orderNo: string;
  recipient: string;          // 받는분 이름
  totalAmount: number;
  productSummary: string;     // "초경량 카본 루어대 외 2건"
  method: string;             // 결제수단 라벨
  itemCount: number;
}): Promise<{
  alimtalk: Array<{ phone: string; ok: boolean; provider: string; error?: string }>;
  sms: Array<{ phone: string; ok: boolean; error?: string }>;
  email: { ok: boolean; error?: string };
  slack: { ok: boolean; error?: string };
}> {
  if (!isNewOrderNotifyEnabled()) {
    return {
      alimtalk: [], sms: [],
      email: { ok: false, error: "ADMIN_NEW_ORDER_NOTIFY=false" },
      slack: { ok: false, error: "ADMIN_NEW_ORDER_NOTIFY=false" },
    };
  }

  const phones = getAdminNotifyPhones();

  // 알림톡 (병렬, 모든 휴대폰 번호로) — Aligo 가 실패시 자동 SMS 폴백
  const alimtalkResults = await Promise.all(
    phones.map(async (phone) => {
      const r = await sendAdminAlimtalk({
        to: phone,
        orderId: args.orderId,
        orderNo: args.orderNo,
        recipient: args.recipient,
        totalAmount: args.totalAmount,
        productSummary: args.productSummary,
        method: args.method,
      });
      return { phone, ok: r.ok, provider: r.provider, error: r.error };
    })
  );

  // FORCE_SMS=true 인 경우 별도 SMS 추가 발송 (알림톡 채널 미준비 환경)
  const forceSms = (process.env.ADMIN_NEW_ORDER_FORCE_SMS || "").toLowerCase() === "true";
  let smsResults: Array<{ phone: string; ok: boolean; error?: string }> = [];
  if (forceSms) {
    const smsBody = `[탑캐스팅] 신규 주문 ${args.orderNo}\n${args.recipient}님 / ${formatKRW(args.totalAmount)}\n${args.productSummary}`;
    smsResults = await Promise.all(
      phones.map(async (phone) => {
        const r = await sendSms({ to: phone, message: smsBody });
        return { phone, ok: r.ok, error: r.error };
      })
    );
  }

  // 이메일
  const subject = `[탑캐스팅] 신규 주문 — ${args.orderNo} (${formatKRW(args.totalAmount)})`;
  const text =
`신규 주문이 접수되었습니다.

주문번호: ${args.orderNo}
주문자: ${args.recipient}
결제금액: ${formatKRW(args.totalAmount)}
결제수단: ${args.method}
상품: ${args.productSummary}
상품수: ${args.itemCount}

관리자 페이지에서 확인해주세요.`;
  const html = `
    <div style="font-family: sans-serif; font-size: 14px; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">🛒 신규 주문 접수</h2>
      <table style="border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">주문번호</td><td style="padding: 4px 0; font-family: monospace;">${args.orderNo}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">주문자</td><td>${args.recipient}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">결제금액</td><td><b>${formatKRW(args.totalAmount)}</b></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">결제수단</td><td>${args.method}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">상품</td><td>${args.productSummary} (${args.itemCount}건)</td></tr>
      </table>
      <p style="margin-top: 16px;">
        <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/orders/${args.orderId}"
           style="display: inline-block; padding: 8px 16px; background: #1e6fdc; color: white; text-decoration: none; border-radius: 4px;">
          관리자 페이지에서 보기
        </a>
      </p>
    </div>
  `;

  const adminEmailAddr = process.env.ADMIN_NOTIFY_EMAIL;
  const email = adminEmailAddr
    ? await sendEmail({ to: adminEmailAddr, subject, html, text })
    : { ok: false, error: "ADMIN_NOTIFY_EMAIL 미설정" };

  const slack = await sendSlack(
    `🛒 *신규 주문* — \`${args.orderNo}\`\n` +
    `${args.recipient}님 / *${formatKRW(args.totalAmount)}* / ${args.method}\n` +
    `${args.productSummary} (${args.itemCount}건)\n` +
    `<${process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/orders/${args.orderId}|관리자 페이지>`
  );

  return { alimtalk: alimtalkResults, sms: smsResults, email, slack };
}

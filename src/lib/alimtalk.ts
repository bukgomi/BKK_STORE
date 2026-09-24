/**
 * 카카오 알림톡 (KakaoTalk AlimTalk) 발송 모듈
 *
 * - 알리고(Aligo) AlimTalk API 기본 지원: https://kakaoapi.aligo.in
 * - ALIMTALK_* 환경변수 미설정시 콘솔에 출력 (개발 모드)
 * - 카카오톡 미수신/차단시 자동 SMS 폴백 가능 (Aligo 기본 동작)
 *
 * ⚠️ 운영시 사전 작업:
 *  1) 카카오톡 채널 개설 + 알림톡 사용 신청
 *  2) 메시지 템플릿을 카카오에 사전 심사/등록 (영업일 1~3일 소요)
 *  3) 등록된 템플릿 코드(tpl_code)를 ALIMTALK_TEMPLATES 의 매핑에 입력
 *
 * 본 모듈은 등록된 템플릿이 없어도 동작 (콘솔 출력) — 개발/테스트 단계 사용 가능
 */

import { isValidKrPhone, normalizePhone } from "@/lib/sms";
import { formatKRW } from "@/lib/utils";

export type AlimtalkResult = {
  ok: boolean;
  provider: string;
  messageId?: string;
  error?: string;
};

/* ========== 템플릿 정의 ========== */
/*
실제 운영시 카카오에 사전 등록된 템플릿을 사용해야 하며, 본문은 등록된 것과
글자 한 자라도 달라지면 발송이 거부됩니다. 변수는 #{변수명} 형태.

아래 템플릿은 일반적인 한국 쇼핑몰 표준 문구로 작성되어 있어, 그대로 카카오에
신청 → 승인 후 ALIMTALK_TEMPLATES 의 templateCode 부분만 환경변수로 교체하면
즉시 운영 사용 가능.
*/

export type TemplateKey =
  | "ORDER_PAID"
  | "SHIPPING_STARTED"
  | "DELIVERY_COMPLETED"
  | "ORDER_CANCELLED"
  | "ORDER_REFUNDED"
  | "ADMIN_NEW_ORDER";

type TemplateDef = {
  templateCode: string;     // 카카오 등록 템플릿 코드
  title: string;            // 메시지 헤더 (선택)
  body: (vars: Record<string, string>) => string;
  buttons?: Array<{ name: string; type: "WL" | "AL" | "DS" | "BK" | "MD"; url?: string }>;
};

export const ALIMTALK_TEMPLATES: Record<TemplateKey, TemplateDef> = {
  ORDER_PAID: {
    templateCode: process.env.ALIMTALK_TPL_ORDER_PAID || "order_paid",
    title: "주문이 접수되었어요",
    body: (v) =>
`안녕하세요 ${v.name}님, 탑캐스팅입니다.

주문이 정상적으로 접수되었습니다.

▶ 주문번호: ${v.orderNo}
▶ 주문금액: ${v.amount}원
▶ 결제수단: ${v.method}

상품 준비가 시작되면 다시 안내드릴게요.
이용해 주셔서 감사합니다.`,
  },

  SHIPPING_STARTED: {
    templateCode: process.env.ALIMTALK_TPL_SHIPPING_STARTED || "shipping_started",
    title: "상품이 발송되었어요",
    body: (v) =>
`${v.name}님, 주문하신 상품이 발송되었습니다.

▶ 주문번호: ${v.orderNo}
▶ 택배사: ${v.courier}
▶ 송장번호: ${v.trackingNo}

배송조회 링크에서 실시간 위치를 확인하실 수 있어요.
조심히 받아주세요!`,
    buttons: [
      { name: "배송조회", type: "WL", url: "{trackingUrl}" },
    ],
  },

  DELIVERY_COMPLETED: {
    templateCode: process.env.ALIMTALK_TPL_DELIVERY_COMPLETED || "delivery_completed",
    title: "상품이 도착했어요",
    body: (v) =>
`${v.name}님, 주문하신 상품이 배송 완료되었습니다.

▶ 주문번호: ${v.orderNo}

상품에 만족하셨나요?
리뷰를 남겨주시면 다른 고객분들께 큰 도움이 됩니다.
이용해 주셔서 감사합니다!`,
    buttons: [
      { name: "리뷰 작성", type: "WL", url: "{reviewUrl}" },
    ],
  },

  ORDER_CANCELLED: {
    templateCode: process.env.ALIMTALK_TPL_ORDER_CANCELLED || "order_cancelled",
    title: "주문이 취소되었어요",
    body: (v) =>
`${v.name}님, 주문이 취소되었습니다.

▶ 주문번호: ${v.orderNo}
▶ 취소금액: ${v.amount}원

결제하신 금액은 결제수단에 따라 영업일 기준 3~5일 이내 환불됩니다.
문의사항은 고객센터로 연락 부탁드립니다.`,
  },

  ORDER_REFUNDED: {
    templateCode: process.env.ALIMTALK_TPL_ORDER_REFUNDED || "order_refunded",
    title: "환불이 완료되었어요",
    body: (v) =>
`${v.name}님, 환불 처리가 완료되었습니다.

▶ 주문번호: ${v.orderNo}
▶ 환불금액: ${v.amount}원

결제하신 카드/계좌로 영업일 기준 3~5일 이내 입금됩니다.
이용에 불편을 드려 죄송합니다.`,
  },

  ADMIN_NEW_ORDER: {
    templateCode: process.env.ALIMTALK_TPL_ADMIN_NEW_ORDER || "admin_new_order",
    title: "신규 주문이 접수되었습니다",
    body: (v) =>
`[탑캐스팅] 신규 주문 접수

▶ 주문번호: ${v.orderNo}
▶ 주문자: ${v.recipient}
▶ 결제금액: ${v.amount}원
▶ 상품: ${v.productSummary}
▶ 결제수단: ${v.method}

관리자 페이지에서 확인해주세요.`,
    buttons: [
      { name: "주문 확인", type: "WL", url: "{adminOrderUrl}" },
    ],
  },
};

/* ========== 발송 ========== */

type SendArgs = {
  to: string;                  // 수신 휴대폰 번호
  template: TemplateKey;
  variables: Record<string, string>;
  /** 버튼 URL 등 동적 치환값 */
  buttonUrls?: Record<string, string>;
};

export async function sendAlimtalk(args: SendArgs): Promise<AlimtalkResult> {
  const to = normalizePhone(args.to);
  if (!isValidKrPhone(to)) {
    return { ok: false, provider: "none", error: "잘못된 휴대폰 번호 형식" };
  }

  const tpl = ALIMTALK_TEMPLATES[args.template];
  if (!tpl) return { ok: false, provider: "none", error: `미정의 템플릿: ${args.template}` };

  const body = tpl.body(args.variables);

  const apiKey = process.env.ALIMTALK_API_KEY;
  const userId = process.env.ALIMTALK_USER_ID;
  const senderKey = process.env.ALIMTALK_SENDER_KEY;
  const sender = process.env.ALIMTALK_SENDER || process.env.ALIGO_SENDER;

  // 환경변수 미설정시: 콘솔 모드
  if (!apiKey || !userId || !senderKey || !sender) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, provider: "none", error: "알림톡 발송 설정(ALIMTALK_*)이 없습니다" };
    }
    console.warn(
      `[ALIMTALK-DEV] To: ${to}\nTemplate: ${args.template} (${tpl.templateCode})\n--- BODY ---\n${body}\n------------`
    );
    return { ok: true, provider: "console", messageId: "dev-" + Date.now() };
  }

  try {
    // Aligo AlimTalk API: https://kakaoapi.aligo.in/akv10/alimtalk/send/
    const params = new URLSearchParams({
      apikey: apiKey,
      userid: userId,
      senderkey: senderKey,
      tpl_code: tpl.templateCode,
      sender: normalizePhone(sender),
      receiver_1: to,
      subject_1: tpl.title || "탑캐스팅",
      message_1: body,
      // 카카오톡 미수신시 SMS 자동 폴백
      failover: "Y",
      fsubject_1: tpl.title || "탑캐스팅",
      fmessage_1: body,
      testMode: process.env.NODE_ENV === "production" ? "N" : "Y",
    });

    // 버튼 (운영 템플릿 등록시 함께 등록되어야 함)
    if (tpl.buttons && tpl.buttons.length > 0) {
      const buttonsJson = tpl.buttons.map((b) => {
        let url = b.url || "";
        if (args.buttonUrls) {
          for (const [k, v] of Object.entries(args.buttonUrls)) {
            url = url.replace(`{${k}}`, v);
          }
        }
        return { name: b.name, linkType: b.type, linkM: url, linkP: url };
      });
      params.append("button_1", JSON.stringify({ button: buttonsJson }));
    }

    const res = await fetch("https://kakaoapi.aligo.in/akv10/alimtalk/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: params,
    });
    const data = await res.json();

    if (data.code === 0 || data.code === "0") {
      return { ok: true, provider: "aligo", messageId: String(data.message_id) };
    }
    return { ok: false, provider: "aligo", error: data.message || "발송 실패" };
  } catch (e: any) {
    return { ok: false, provider: "aligo", error: e.message || "네트워크 오류" };
  }
}

/* ========== 큐 enqueue (재시도 보장) ========== */

import { enqueue, JOBS } from "@/lib/queue";
import { isRedisAvailable } from "@/lib/redis";

/**
 * 알림톡을 백그라운드 큐에 추가
 * - Redis 있으면 BullMQ 로 enqueue (실패시 5회 지수 백오프 자동 재시도)
 * - Redis 없으면 즉시 직접 발송
 */
export async function enqueueAlimtalk(args: SendArgs, options?: { jobId?: string }): Promise<{ queued: boolean; result?: AlimtalkResult }> {
  if (isRedisAvailable()) {
    await enqueue(JOBS.ALIMTALK_SEND, args, { jobId: options?.jobId });
    return { queued: true };
  }
  // 폴백: 직접 발송
  const result = await sendAlimtalk(args);
  return { queued: false, result };
}

/* ========== 편의 함수 (도메인 시나리오) ========== */

type OrderForNotify = {
  orderNo: string;
  recipient: string;
  phone: string;
  totalAmount: number;
  provider?: string | null;
  courier?: string | null;
  trackingNo?: string | null;
};

function siteUrl(): string {
  return process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export async function notifyOrderPaid(order: OrderForNotify) {
  return enqueueAlimtalk({
    to: order.phone,
    template: "ORDER_PAID",
    variables: {
      name: order.recipient,
      orderNo: order.orderNo,
      amount: formatKRW(order.totalAmount).replace("원", ""),
      method: order.provider || "카드",
    },
  }, { jobId: `order-paid:${order.orderNo}` });
}

export async function notifyShippingStarted(order: OrderForNotify) {
  return enqueueAlimtalk({
    to: order.phone,
    template: "SHIPPING_STARTED",
    variables: {
      name: order.recipient,
      orderNo: order.orderNo,
      courier: order.courier || "택배사",
      trackingNo: order.trackingNo || "",
    },
    buttonUrls: {
      trackingUrl: `${siteUrl()}/orders/${order.orderNo}/tracking`,
    },
  });
}

export async function notifyDeliveryCompleted(order: OrderForNotify) {
  return enqueueAlimtalk({
    to: order.phone,
    template: "DELIVERY_COMPLETED",
    variables: { name: order.recipient, orderNo: order.orderNo },
    buttonUrls: { reviewUrl: `${siteUrl()}/mypage/reviews` },
  }, { jobId: `delivered:${order.orderNo}` });
}

export async function notifyOrderCancelled(order: OrderForNotify) {
  return enqueueAlimtalk({
    to: order.phone,
    template: "ORDER_CANCELLED",
    variables: {
      name: order.recipient,
      orderNo: order.orderNo,
      amount: formatKRW(order.totalAmount).replace("원", ""),
    },
  }, { jobId: `cancelled:${order.orderNo}` });
}

export async function notifyOrderRefunded(order: OrderForNotify) {
  return enqueueAlimtalk({
    to: order.phone,
    template: "ORDER_REFUNDED",
    variables: {
      name: order.recipient,
      orderNo: order.orderNo,
      amount: formatKRW(order.totalAmount).replace("원", ""),
    },
  }, { jobId: `refunded:${order.orderNo}` });
}

/**
 * 관리자에게 신규 주문 알림 (단일 휴대폰 기준)
 * - 카카오톡 알림톡으로 전송 + Aligo failover 로 자동 SMS 폴백
 */
export async function notifyAdminNewOrder(args: {
  to: string;
  orderId: string;
  orderNo: string;
  recipient: string;
  totalAmount: number;
  productSummary: string;
  method: string;
}) {
  const r = await enqueueAlimtalk({
    to: args.to,
    template: "ADMIN_NEW_ORDER",
    variables: {
      orderNo: args.orderNo,
      recipient: args.recipient,
      amount: formatKRW(args.totalAmount).replace("원", ""),
      productSummary: args.productSummary,
      method: args.method,
    },
    buttonUrls: {
      adminOrderUrl: `${siteUrl()}/admin/orders/${args.orderId}`,
    },
  }, { jobId: `admin-new-order:${args.orderNo}:${args.to}` });
  // 호환: notifyAdminOrderReceived 가 ok/provider/error 형태 기대
  if (r.queued) return { ok: true as const, provider: "queued", messageId: undefined, error: undefined };
  return r.result!;
}

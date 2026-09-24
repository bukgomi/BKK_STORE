"use client";
// 토스페이먼츠 결제창 호출 (클라이언트)
// 공식 SDK: @tosspayments/payment-sdk
// 본 프로젝트는 SDK 의존성 없이 표준 결제창을 호출하기 위해 동적 스크립트 로드 방식 사용

declare global {
  interface Window {
    TossPayments?: any;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("not browser"));
  if (window.TossPayments) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.tosspayments.com/v1/payment";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("토스페이먼츠 SDK 로드 실패"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

type Args = {
  orderId: string;          // 주문번호 (orderNo)
  orderName: string;        // 주문명
  amount: number;           // 결제금액
  customerName: string;
  customerEmail?: string;
};

export async function loadTossPayments(args: Args) {
  await loadScript();
  // 운영 빌드에 키가 없으면 테스트 키로 결제창을 열어 승인 단계에서 전부 실패하므로, 명시적으로 막는다
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || (process.env.NODE_ENV !== "production" ? "test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm" : "");
  if (!clientKey) throw new Error("결제 설정 오류: 토스 클라이언트 키가 빌드에 포함되지 않았습니다. 관리자에게 문의해 주세요.");
  const tp = window.TossPayments(clientKey);

  const origin = window.location.origin;
  await tp.requestPayment("카드", {
    amount: args.amount,
    orderId: args.orderId,
    orderName: args.orderName,
    customerName: args.customerName,
    customerEmail: args.customerEmail,
    successUrl: `${origin}/api/payments/toss/confirm`,
    failUrl: `${origin}/checkout/fail`,
  });
}

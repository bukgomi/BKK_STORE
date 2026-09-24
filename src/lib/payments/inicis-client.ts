"use client";

/**
 * KG이니시스 표준결제(WEB) 스크립트 동적 로드
 * - 결제창 호출 직전에만 로드되어 초기 페이지 무게 영향 없음
 * - 운영 가맹점은 PG사에 도메인 등록 필수
 */

declare global {
  interface Window {
    INIStdPay?: { pay: (formId: string) => void };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("not browser"));
  if (window.INIStdPay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  // 운영/테스트 환경 자동 분기
  // 명시 값이 없으면 운영 빌드는 운영 SDK, 그 외는 스테이징 SDK
  const isProd = process.env.NEXT_PUBLIC_INICIS_ENV ? process.env.NEXT_PUBLIC_INICIS_ENV === "production" : process.env.NODE_ENV === "production";
  const src = isProd
    ? "https://stdpay.inicis.com/stdjs/INIStdPay.js"
    : "https://stgstdpay.inicis.com/stdjs/INIStdPay.js";

  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.charset = "UTF-8";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("이니시스 결제창 스크립트 로드 실패"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * 이니시스 표준결제 호출
 * @param formData /api/payments/inicis/prepare 응답 객체
 */
export async function startInicisPay(formData: Record<string, string>): Promise<void> {
  await loadScript();

  // 동일 ID로 중복 form 방지
  const formId = "ini-pay-form";
  let form = document.getElementById(formId) as HTMLFormElement | null;
  if (form) form.remove();

  form = document.createElement("form");
  form.id = formId;
  form.method = "POST";
  form.acceptCharset = "UTF-8";

  Object.entries(formData).forEach(([k, v]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = String(v);
    form!.appendChild(input);
  });

  document.body.appendChild(form);

  if (!window.INIStdPay) {
    throw new Error("INIStdPay 가 로드되지 않았습니다.");
  }
  window.INIStdPay.pay(formId);
}

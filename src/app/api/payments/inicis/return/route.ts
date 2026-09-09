import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelPendingOrder, finalizeOrderPayment, OutOfStockError } from "@/lib/stock";
import { isInicisUrl } from "@/lib/payments/url-guard";
import { logger } from "@/lib/logger";

// KG이니시스 returnUrl 콜백 (POST form-urlencoded)
// 인증성공시 authToken 등을 받아 승인 API 호출 → 최종 결제 완료

const PAID_STATUSES = new Set(["PAID", "PREPARING", "SHIPPED", "DELIVERED"]);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = String(v); });

  const resultCode = params.resultCode;
  const oid = params.oid;
  const authToken = params.authToken;
  const authUrl = params.authUrl;     // 승인요청 URL (이니시스가 내려줌)
  const mid = params.mid;
  const netCancelUrl = params.netCancelUrl; // 망취소 URL

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/checkout/fail?reason=${encodeURIComponent(reason)}`, req.url));

  if (resultCode !== "0000" || !authToken || !authUrl || !oid) {
    return fail(params.resultMsg || "");
  }

  // 폼으로 넘어온 URL 은 위조 가능 → 이니시스 도메인만 fetch 허용 (SSRF 방어)
  if (!isInicisUrl(authUrl) || (netCancelUrl && !isInicisUrl(netCancelUrl))) {
    logger.warn("inicis.return.untrusted_url", { oid, authUrl, netCancelUrl });
    return fail("invalid_callback");
  }

  const order = await prisma.order.findUnique({ where: { orderNo: oid } });
  if (!order) {
    return fail("주문없음");
  }

  // 멱등성: 이미 처리된 주문은 승인 API 를 다시 호출하지 않음
  if (order.status !== "PENDING") {
    if (PAID_STATUSES.has(order.status)) {
      return NextResponse.redirect(new URL(`/checkout/success?orderNo=${order.orderNo}`, req.url));
    }
    return fail("order_closed");
  }

  // 승인 요청 (form-urlencoded)
  const body = new URLSearchParams({
    mid,
    authToken,
    timestamp: Date.now().toString(),
    charset: "UTF-8",
    format: "JSON",
  });

  const netCancel = async () => {
    if (!netCancelUrl) return;
    await fetch(netCancelUrl, { method: "POST", body }).catch(() => {});
  };

  let approveJson: any;
  try {
    const res = await fetch(authUrl, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    approveJson = await res.json();
  } catch (e) {
    await netCancel();
    return fail("승인실패");
  }

  if (approveJson.resultCode !== "0000") {
    return fail(approveJson.resultMsg || "승인실패");
  }

  const paidAmount = Number(approveJson.TotPrice);
  if (paidAmount !== order.totalAmount) {
    // 위변조 의심 — 망취소
    await netCancel();
    return fail("금액불일치");
  }

  try {
    await finalizeOrderPayment({ orderId: order.id, providerTxnId: approveJson.tid });
  } catch (e) {
    const reason = e instanceof OutOfStockError ? "재고 부족" : "주문 확정 실패";
    logger.error("inicis.return.finalize_failed", { oid, error: (e as Error).message });
    await netCancel();
    await cancelPendingOrder(order.id, `${reason} — 망취소 요청`);
    return fail(e instanceof OutOfStockError ? "out_of_stock" : "finalize_failed");
  }

  return NextResponse.redirect(new URL(`/checkout/success?orderNo=${order.orderNo}`, req.url));
}

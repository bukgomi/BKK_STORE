import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelPendingOrder, finalizeOrderPayment, OutOfStockError } from "@/lib/stock";
import { cancelNaverPayment } from "@/lib/payments/refund";
import { logger } from "@/lib/logger";

// 네이버페이 결제 완료 후 returnUrl 콜백
// resultCode=Success 인 경우 paymentId 로 승인 API 호출

const PAID_STATUSES = new Set(["PAID", "PREPARING", "SHIPPED", "DELIVERED"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const resultCode = searchParams.get("resultCode");
  const paymentId = searchParams.get("paymentId");
  const merchantPayKey = searchParams.get("merchantPayKey"); // = orderNo

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/checkout/fail?reason=${encodeURIComponent(reason)}`, req.url));

  if (resultCode !== "Success" || !paymentId || !merchantPayKey) {
    return fail(searchParams.get("resultMessage") || "");
  }

  const order = await prisma.order.findUnique({ where: { orderNo: merchantPayKey } });
  if (!order) return fail("주문없음");

  // 멱등성: 이미 처리된 주문은 승인 API 를 다시 호출하지 않음
  if (order.status !== "PENDING") {
    if (PAID_STATUSES.has(order.status)) {
      return NextResponse.redirect(new URL(`/checkout/success?orderNo=${order.orderNo}`, req.url));
    }
    return fail("order_closed");
  }

  const clientId = process.env.NAVERPAY_CLIENT_ID;
  const clientSecret = process.env.NAVERPAY_CLIENT_SECRET;
  const chainId = process.env.NAVERPAY_CHAIN_ID;
  if (!clientId || !clientSecret || !chainId) {
    logger.error("naver.return.unconfigured", { orderNo: order.orderNo });
    return fail("naverpay_unconfigured");
  }

  // 승인(approve) 호출
  const res = await fetch("https://dev-pub.apis.naver.com/naverpay-partner/naverpay/payments/v1/apply/payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
      "X-NaverPay-Chain-Id": chainId,
    },
    body: new URLSearchParams({ paymentId }),
  });
  const json = await res.json().catch(() => ({}));

  if (json.code !== "Success") {
    return fail(json.message || "승인실패");
  }

  const paid = Number(json.body?.detail?.totalPayAmount);

  // 승인 이후 실패는 이미 돈이 빠져나간 상태 → 반드시 취소 호출
  const cancelAndFail = async (reason: string, redirectReason: string) => {
    const cancel = await cancelNaverPayment({ paymentId, cancelReason: reason, cancelAmount: paid || order.totalAmount });
    if (!cancel.ok) {
      logger.error("naver.return.cancel_failed", { orderNo: order.orderNo, paymentId, error: cancel.error });
    }
    await cancelPendingOrder(order.id, `${reason} — 네이버페이 자동취소${cancel.ok ? "" : " 실패(수동 확인 필요)"}`);
    return fail(redirectReason);
  };

  if (paid !== order.totalAmount) {
    logger.warn("naver.return.amount_mismatch", { orderNo: order.orderNo, paid, expected: order.totalAmount });
    return cancelAndFail("금액 불일치", "금액불일치");
  }

  try {
    await finalizeOrderPayment({ orderId: order.id, providerTxnId: paymentId });
  } catch (e) {
    logger.error("naver.return.finalize_failed", { orderNo: order.orderNo, error: (e as Error).message });
    return e instanceof OutOfStockError
      ? cancelAndFail("재고 부족", "out_of_stock")
      : cancelAndFail("주문 확정 실패", "finalize_failed");
  }

  return NextResponse.redirect(new URL(`/checkout/success?orderNo=${order.orderNo}`, req.url));
}

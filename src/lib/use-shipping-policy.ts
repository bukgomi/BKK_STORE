"use client";
import { useEffect, useState } from "react";
import { DEFAULT_FREE_SHIPPING_MIN, SHIPPING_FEE, type ShippingPolicy } from "@/lib/shipping";

/** 클라이언트 컴포넌트용 배송비 정책 (사이트 설정의 무료배송 기준). 로딩 전에는 기본값 사용 */
export function useShippingPolicy(): ShippingPolicy {
  const [policy, setPolicy] = useState<ShippingPolicy>({ shippingFee: SHIPPING_FEE, freeShippingMin: DEFAULT_FREE_SHIPPING_MIN });
  useEffect(() => {
    fetch("/api/shipping-policy", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.freeShippingMin === "number") setPolicy({ shippingFee: d.shippingFee ?? SHIPPING_FEE, freeShippingMin: d.freeShippingMin }); })
      .catch(() => {});
  }, []);
  return policy;
}

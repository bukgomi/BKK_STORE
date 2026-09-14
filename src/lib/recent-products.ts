"use client";
// 최근 본 상품 — 브라우저 localStorage 에 저장 (로그인 여부와 무관, 기기별)

export type RecentProduct = {
  id: string;
  name: string;
  thumbnail: string | null;
  price: number;
  salePrice: number | null;
  at: number;
};

const KEY = "tc_recent_products";
const MAX = 20;
const EVENT = "tc:recent-products";

export function getRecentProducts(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentProduct[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === "string") : [];
  } catch {
    return [];
  }
}

export function addRecentProduct(p: Omit<RecentProduct, "at">) {
  if (typeof window === "undefined") return;
  try {
    const next = [{ ...p, at: Date.now() }, ...getRecentProducts().filter((x) => x.id !== p.id)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* localStorage 사용 불가 환경은 무시 */
  }
}

export function removeRecentProduct(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(getRecentProducts().filter((x) => x.id !== id)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch { }
}

/** 변경 구독 (같은 탭의 추가/삭제 + 다른 탭의 storage 이벤트) */
export function subscribeRecentProducts(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

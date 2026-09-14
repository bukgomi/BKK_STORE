"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/store/cart";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/",                 label: "홈",       match: (p: string) => p === "/", icon: HomeIcon },
  { href: "/categories",       label: "카테고리", match: (p: string) => p.startsWith("/categories") || p.startsWith("/category") || p.startsWith("/products"), icon: GridIcon },
  { href: "/products?sort=best", label: "베스트",   match: (p: string, s: string) => s.includes("sort=best"), icon: FireIcon },
  { href: "/cart",             label: "장바구니", match: (p: string) => p.startsWith("/cart"), icon: CartIcon, badge: true },
  { href: "/mypage",           label: "마이",     match: (p: string) => p.startsWith("/mypage") || p.startsWith("/login"), icon: UserIcon },
];

export default function BottomTabBar() {
  const pathname = usePathname() || "/";
  const search = typeof window !== "undefined" ? window.location.search : "";
  const cartCount = useCart((s) => s.totalCount());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 관리자 영역에서는 숨김
  if (pathname.startsWith("/admin")) return null;
  // 상품 상세에서는 구매 바(MobilePurchaseBar)가 하단을 차지한다
  if (/^\/products\/[^/]+$/.test(pathname)) return null;

  return (
    <nav
      aria-label="모바일 네비게이션"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 grid grid-cols-5"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((t) => {
        const active = t.match(pathname, search);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${
              active ? "text-brand-600" : "text-gray-600"
            }`}
          >
            <Icon active={active} />
            <span className="leading-none">{t.label}</span>
            {t.badge && mounted && cartCount > 0 && (
              <span className="absolute top-1 right-[calc(50%-18px)] min-w-[16px] h-[16px] px-1 rounded-full bg-accent-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function svgProps(active: boolean) {
  return {
    width: 22, height: 22, viewBox: "0 0 24 24",
    fill: active ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: active ? 0 : 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}
function GridIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function FireIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <path d="M12 2s4 4 4 8a4 4 0 1 1-8 0c0-2 1-3 1-3s-2 1-2 4a6 6 0 0 0 12 0c0-5-7-9-7-9z" />
    </svg>
  );
}
function CartIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </svg>
  );
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}

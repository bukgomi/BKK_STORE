"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AdminSignOutButton from "./AdminSignOutButton";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { title: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: "운영",
    items: [
      { href: "/admin", label: "대시보드", icon: "📊" },
      { href: "/admin/orders", label: "주문 관리", icon: "🧾" },
      { href: "/admin/orders/bulk-shipping", label: "송장 일괄처리", icon: "🚚" },
      { href: "/admin/support", label: "1:1 문의", icon: "💌" },
    ],
  },
  {
    title: "상품",
    items: [
      { href: "/admin/products", label: "상품 관리", icon: "📦" },
      { href: "/admin/categories", label: "카테고리", icon: "🗂️" },
      { href: "/admin/stock", label: "재고 관리", icon: "📉" },
      { href: "/admin/reviews", label: "리뷰 관리", icon: "✍" },
    ],
  },
  {
    title: "마케팅",
    items: [
      { href: "/admin/coupons", label: "쿠폰 관리", icon: "🎟" },
      { href: "/admin/notifications", label: "알림 관리", icon: "💬" },
      { href: "/admin/feeds", label: "상품 피드", icon: "📡" },
    ],
  },
  {
    title: "콘텐츠",
    items: [
      { href: "/admin/site", label: "사이트 설정", icon: "🎨" },
      { href: "/admin/promotions", label: "기획전 / 이벤트", icon: "🎯" },
      { href: "/admin/rigs", label: "채비도", icon: "🎣" },
      { href: "/admin/notices", label: "공지사항", icon: "📢" },
      { href: "/admin/faq", label: "FAQ", icon: "❓" },
    ],
  },
  {
    title: "분석/시스템",
    items: [
      { href: "/admin/reports", label: "매출 리포트", icon: "📈" },
      { href: "/admin/queue", label: "백그라운드 큐", icon: "⚙️" },
      { href: "/admin/audit", label: "활동 로그", icon: "📜" },
    ],
  },
  {
    title: "회원",
    items: [
      { href: "/admin/users", label: "회원 관리", icon: "👤" },
    ],
  },
];

export default function AdminSidebar({
  user,
}: {
  user: { name?: string | null; email?: string | null };
}) {
  const pathname = usePathname() || "";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // 경로 변경시 모바일 드로어 자동 닫기
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* 모바일 햄버거 버튼 (헤더에서 사용 가능하지만 자체 floating으로) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
        className="lg:hidden fixed top-3 left-3 z-30 w-10 h-10 rounded-full bg-gray-900 text-white shadow-lg flex items-center justify-center"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {/* 데스크톱 사이드바 */}
      <aside className="hidden lg:flex w-60 bg-gray-900 text-gray-100 flex-col shrink-0">
        <SidebarContent user={user} isActive={isActive} />
      </aside>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-[80%] max-w-[300px] bg-gray-900 text-gray-100 flex flex-col animate-slide-right">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="메뉴 닫기"
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xl"
            >×</button>
            <SidebarContent user={user} isActive={isActive} />
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarContent({
  user,
  isActive,
}: {
  user: { name?: string | null; email?: string | null };
  isActive: (href: string) => boolean;
}) {
  return (
    <>
      <div className="px-5 py-5 border-b border-gray-800 shrink-0">
        <Link href="/admin" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png?v=3" alt="TOPCASTING TPIAA" className="h-11 w-auto" />
          <span className="text-sm font-bold text-brand-400">Admin</span>
        </Link>
        <p className="text-[11px] text-gray-400 mt-1">탑캐스팅 관리자 페이지</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-3">
            <div className="px-5 py-1 text-[10px] font-bold text-gray-500 tracking-wider uppercase">
              {section.title}
            </div>
            <ul>
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-5 py-2 text-sm transition-colors ${
                        active
                          ? "bg-brand-500/15 text-brand-400 border-r-2 border-brand-500"
                          : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <span className="w-5 text-center">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-400 shrink-0">
        <div className="text-gray-200 mb-0.5 font-medium truncate">{user.name}</div>
        <div className="truncate mb-3 text-[11px]">{user.email}</div>
        <div className="flex gap-2">
          <Link href="/" className="flex-1 text-center px-2 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs">
            스토어 ↗
          </Link>
          <AdminSignOutButton />
        </div>
      </div>
    </>
  );
}

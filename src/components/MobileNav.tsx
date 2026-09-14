"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Category = { id: string; name: string; slug: string };

type Props = {
  categories: Category[];
  user?: { name?: string | null; email?: string | null } | null;
  isAdmin?: boolean;
};

export default function MobileNav({ categories, user, isAdmin }: Props) {
  const [open, setOpen] = useState(false);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        className="md:hidden p-2 -ml-2"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* 백드롭 */}
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setOpen(false)}
          />
          {/* 드로어 */}
          <aside className="relative h-full w-[82%] max-w-[320px] bg-white shadow-xl flex flex-col animate-slide-right">
            {/* 헤더 */}
            <div className="bg-brand-500 text-white p-5">
              {user ? (
                <>
                  <div className="text-base font-bold">{user.name}님</div>
                  <div className="text-xs opacity-80 mt-0.5">{user.email}</div>
                </>
              ) : (
                <div className="flex gap-2">
                  <Link href="/login" onClick={() => setOpen(false)} className="flex-1 text-center bg-white/20 hover:bg-white/30 py-2 rounded text-sm font-medium">로그인</Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="flex-1 text-center bg-white text-brand-700 py-2 rounded text-sm font-medium">회원가입</Link>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="메뉴 닫기"
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center text-xl"
            >×</button>

            {/* 카테고리 */}
            <div className="flex-1 overflow-y-auto">
              <Section title="카테고리">
                <Item href="/products" onClick={() => setOpen(false)}>전체상품</Item>
                <Item href="/categories" onClick={() => setOpen(false)}>카테고리 모아보기</Item>
                {categories.filter((c) => c.slug !== "uncategorized").map((c) => (
                  <Item key={c.id} href={`/category/${c.slug}`} onClick={() => setOpen(false)}>
                    {c.name}
                  </Item>
                ))}
              </Section>

              <Section title="추천">
                <Item href="/products?sort=new" onClick={() => setOpen(false)}>신상품</Item>
                <Item href="/products?sort=best" onClick={() => setOpen(false)}>베스트</Item>
                <Item href="/products?sale=1" onClick={() => setOpen(false)} accent>할인특가</Item>
                <Item href="/rigs" onClick={() => setOpen(false)}>시즌·어종별 채비도</Item>
                <Item href="/event" onClick={() => setOpen(false)}>기획전 / 이벤트</Item>
                <Item href="/notice" onClick={() => setOpen(false)}>공지사항</Item>
              </Section>

              {user && (
                <Section title="마이">
                  <Item href="/mypage" onClick={() => setOpen(false)}>마이페이지</Item>
                  <Item href="/mypage/wishlist" onClick={() => setOpen(false)}>위시리스트</Item>
                  <Item href="/mypage/coupons" onClick={() => setOpen(false)}>쿠폰함</Item>
                  <Item href="/mypage/points" onClick={() => setOpen(false)}>포인트</Item>
                  {isAdmin && <Item href="/admin" onClick={() => setOpen(false)} purple>관리자</Item>}
                </Section>
              )}

              <Section title="고객">
                <Item href="/support" onClick={() => setOpen(false)}>고객센터</Item>
                <Item href="/shipping" onClick={() => setOpen(false)}>배송 안내</Item>
                <Item href="/refund" onClick={() => setOpen(false)}>교환·반품</Item>
              </Section>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100">
      <div className="px-5 pt-4 pb-2 text-[11px] font-bold text-gray-400 tracking-wider">{title}</div>
      <ul>{children}</ul>
    </div>
  );
}

function Item({ href, children, onClick, accent, purple }: {
  href: string; children: React.ReactNode; onClick?: () => void;
  accent?: boolean; purple?: boolean;
}) {
  const cls = accent
    ? "text-accent-500 font-bold"
    : purple
    ? "text-purple-600 font-bold"
    : "text-gray-800";
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className={`flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50 ${cls}`}
      >
        <span>{children}</span>
        <span className="text-gray-300">›</span>
      </Link>
    </li>
  );
}

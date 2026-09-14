import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import CategoryNav from "./CategoryNav";
import CartBadge from "./CartBadge";
import HeaderSignOut from "./HeaderSignOut";
import MobileNav from "./MobileNav";
import NoticeBar from "./NoticeBar";
import WishlistBadge from "./WishlistBadge";
import HeaderSearch from "./HeaderSearch";

export default async function Header() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  // 이메일 화이트리스트 또는 DB role(ADMIN/SUPER_ADMIN) — 관리자 화면에서 승격된 회원도 링크가 보이도록
  const role = (user as any)?.role as string | undefined;
  const admin = isAdminEmail(user?.email) || role === "ADMIN" || role === "SUPER_ADMIN";

  // 모바일 드로어용 카테고리 (서버 사이드에서 1번 쿼리)
  const categories = await prisma.category
    .findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    })
    .catch(() => []);

  return (
    <>
    <header className="border-b border-gray-200 bg-white sticky top-0 z-40 md:static">
      {/* 사이트 고지 띠 (관리자 설정 기반) */}
      <NoticeBar />

      {/* 상단 유틸 바 (데스크톱 전용) */}
      <div className="hidden md:block border-b border-gray-100 text-xs text-gray-600">
        <div className="container-mall flex items-center justify-end h-9 gap-4">
          {user ? (
            <>
              <span className="text-gray-700"><b>{user.name}</b>님</span>
              <HeaderSignOut />
              <Link href="/mypage" className="hover:text-brand-600">마이페이지</Link>
              <Link href="/mypage/wishlist" className="hover:text-brand-600 inline-flex items-center">
                위시리스트<WishlistBadge variant="inline" />
              </Link>
              <Link href="/mypage/coupons" className="hover:text-brand-600">쿠폰함</Link>
              {admin && <Link href="/admin" className="text-purple-600 hover:text-purple-800 font-bold">관리자</Link>}
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-brand-600">로그인</Link>
              <Link href="/register" className="hover:text-brand-600">회원가입</Link>
              <Link href="/mypage" className="hover:text-brand-600">주문조회</Link>
            </>
          )}
          <Link href="/rigs" className="hover:text-brand-600">채비도</Link>
          <Link href="/event" className="hover:text-brand-600">기획전</Link>
          <Link href="/notice" className="hover:text-brand-600">공지사항</Link>
          <Link href="/support" className="hover:text-brand-600">고객센터</Link>
        </div>
      </div>

      {/* 메인 헤더 */}
      <div className="container-mall flex items-center justify-between gap-3 md:gap-6 py-3 md:py-5">
        {/* 모바일: 햄버거 */}
        <MobileNav
          categories={categories}
          user={user ? { name: user.name, email: user.email } : null}
          isAdmin={admin}
        />

        <Link href="/" className="flex items-center shrink-0" aria-label="탑캐스팅 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png?v=3" alt="TOPCASTING TPIAA" className="h-12 md:h-20 w-auto" />
        </Link>

        {/* 데스크톱 검색바 (자동완성 클라이언트 컴포넌트) */}
        <HeaderSearch />

        {/* 우측 액션 */}
        <div className="flex items-center gap-1 md:gap-4 text-sm">
          {/* 모바일: 검색 아이콘 (상품 페이지로) */}
          <Link href="/products" aria-label="검색" className="md:hidden p-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
          </Link>

          {/* 위시리스트 — 아이콘 + 카운트 */}
          <Link href="/mypage/wishlist" className="relative inline-flex items-center justify-center p-2 hover:text-rose-500" aria-label="위시리스트" title="위시리스트">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <WishlistBadge />
          </Link>

          {/* 장바구니 — 아이콘 + 카운트만 (모든 화면) */}
          <Link href="/cart" className="relative inline-flex items-center justify-center p-2 hover:text-brand-600" aria-label="장바구니" title="장바구니">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
            </svg>
            <CartBadge />
          </Link>

          {/* 마이페이지 — 사용자 아이콘 (로그인 시 /mypage, 미로그인 시 /login) */}
          <Link
            href={user ? "/mypage" : "/login"}
            className="relative inline-flex items-center justify-center p-2 hover:text-brand-600"
            aria-label={user ? "마이페이지" : "로그인"}
            title={user ? "마이페이지" : "로그인"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
            </svg>
          </Link>
        </div>
      </div>

    </header>
    {/* 데스크톱: 카테고리 메뉴만 화면 상단에 고정 (헤더 전체 고정 시 화면을 너무 많이 가림) */}
    <CategoryNav />
    </>
  );
}

import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

const POLICIES = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침", strong: true },
  { href: "/youth-protection", label: "청소년보호정책" },
  { href: "/shipping", label: "배송 안내" },
  { href: "/refund", label: "교환·반품·환불" },
];

const SUPPORT = [
  { href: "/mypage", label: "마이페이지" },
  { href: "/mypage/wishlist", label: "위시리스트" },
  { href: "/mypage", label: "주문/배송조회" },
  { href: "/guest-orders", label: "비회원 주문조회" },
  { href: "/support", label: "1:1 문의" },
  { href: "/faq", label: "자주 묻는 질문" },
  { href: "/notice", label: "공지사항" },
  { href: "/event", label: "기획전 / 이벤트" },
  { href: "/rigs", label: "어종별 채비도" },
];

const ENV_DEFAULTS = {
  name:        process.env.NEXT_PUBLIC_BUSINESS_NAME       || "탑캐스팅",
  ceo:         process.env.NEXT_PUBLIC_BUSINESS_CEO        || "홍길동",
  bizNo:       process.env.NEXT_PUBLIC_BUSINESS_NO         || "000-00-00000",
  ecommNo:     process.env.NEXT_PUBLIC_ECOMM_REG_NO        || "제0000-서울XX-0000호",
  address:     process.env.NEXT_PUBLIC_BUSINESS_ADDRESS    || "서울특별시 OO구 OO로 00, 0층",
  csPhone:     process.env.NEXT_PUBLIC_CS_PHONE            || "00-000-0000",
  csEmail:     process.env.NEXT_PUBLIC_CS_EMAIL            || "help@example.com",
  csHours:     process.env.NEXT_PUBLIC_CS_HOURS            || "평일 09:00 ~ 18:00 (점심 12:00~13:00, 주말/공휴일 휴무)",
  privacyOfficer: process.env.NEXT_PUBLIC_PRIVACY_OFFICER  || "홍길동",
  privacyEmail:   process.env.NEXT_PUBLIC_PRIVACY_EMAIL    || "privacy@example.com",
  hostingProvider: process.env.NEXT_PUBLIC_HOSTING_PROVIDER || "Vercel Inc.",
  tagline: "낚시 입문자부터 베테랑까지, 필요한 모든 장비를 합리적인 가격으로 만나보세요.",
};

export default async function Footer() {
  const settings = await getSiteSettings();
  // settings.footer 가 비어있으면 env 기본값
  const f = settings.footer || {};
  const BIZ = {
    name:    f.name    || ENV_DEFAULTS.name,
    ceo:     f.ceo     || ENV_DEFAULTS.ceo,
    bizNo:   f.bizNo   || ENV_DEFAULTS.bizNo,
    ecommNo: f.ecommNo || ENV_DEFAULTS.ecommNo,
    address: f.address || ENV_DEFAULTS.address,
    csPhone: f.csPhone || ENV_DEFAULTS.csPhone,
    csEmail: f.csEmail || ENV_DEFAULTS.csEmail,
    csHours: f.csHours || ENV_DEFAULTS.csHours,
    privacyOfficer: f.privacyOfficer || ENV_DEFAULTS.privacyOfficer,
    privacyEmail:   f.privacyEmail   || ENV_DEFAULTS.privacyEmail,
    hostingProvider: ENV_DEFAULTS.hostingProvider,
    tagline: f.tagline || ENV_DEFAULTS.tagline,
  };

  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50 text-gray-600 text-xs">
      <div className="container-mall py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <Link href="/" className="text-xl font-bold text-brand-700 inline-block mb-3">
            {BIZ.name}
          </Link>
          <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">
            {BIZ.tagline}
          </p>
          <div className="mt-5">
            <div className="text-xs text-gray-500">고객센터</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{BIZ.csPhone}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{BIZ.csHours}</div>
            <a href={`mailto:${BIZ.csEmail}`} className="text-[11px] text-brand-600 hover:underline mt-1 inline-block">
              {BIZ.csEmail}
            </a>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-gray-800 mb-3">고객 안내</h3>
          <ul className="space-y-1.5">
            {POLICIES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className={`hover:text-brand-600 ${p.strong ? "font-bold text-gray-700" : ""}`}>
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-gray-800 mb-3">고객지원</h3>
          <ul className="space-y-1.5">
            {SUPPORT.map((s, i) => (
              <li key={i}>
                <Link href={s.href} className="hover:text-brand-600">{s.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white">
        <div className="container-mall py-5 text-[11px] text-gray-500 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            <div><b className="text-gray-700">상호</b> {BIZ.name} <span className="text-gray-300 mx-1">|</span> <b className="text-gray-700">대표자</b> {BIZ.ceo}</div>
            <div><b className="text-gray-700">사업자등록번호</b> {BIZ.bizNo} <span className="text-gray-300 mx-1">|</span> <b className="text-gray-700">통신판매업</b> {BIZ.ecommNo}</div>
            <div><b className="text-gray-700">주소</b> {BIZ.address}</div>
            <div><b className="text-gray-700">호스팅사업자</b> {BIZ.hostingProvider}</div>
            <div><b className="text-gray-700">개인정보보호책임자</b> {BIZ.privacyOfficer} ({BIZ.privacyEmail})</div>
          </div>
          <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
            본 사이트의 모든 콘텐츠는 저작권법의 보호를 받습니다. 무단 복제 및 전재를 금합니다.<br />
            결제대행사인 토스페이먼츠, KG이니시스, 네이버페이는 결제 처리 외 어떠한 책임도 지지 않습니다.<br />
            © {new Date().getFullYear()} {BIZ.name}. All rights reserved.
          </p>
          <div className="mt-3 flex justify-end">
            <Link
              href="/admin"
              className="text-[10px] text-gray-400 hover:text-purple-600 transition-colors"
            >
              관리자 로그인
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

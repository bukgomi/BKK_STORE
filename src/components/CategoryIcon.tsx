import { iconKeyFor, type CategoryIconKey } from "@/lib/category-icons";

/**
 * 카테고리 라인 아이콘 (단색 stroke SVG, currentColor)
 * 크기/색은 className 으로: <CategoryIcon slug="spoon" className="w-6 h-6 text-brand-600" />
 * 관리자가 iconEmoji 를 직접 지정한 경우에만 이모지를 대신 표시
 */
type Props = { slug: string; iconEmoji?: string | null; className?: string; strokeWidth?: number };

const PATHS: Record<CategoryIconKey, React.ReactNode> = {
  // 미노우/루어: 몸통 + 꼬리 + 눈 + 트레블훅
  minnow: (
    <>
      <path d="M2.5 12c2.6-4.2 6.1-6.3 9.8-6.3 3.2 0 5.9 1.6 7.7 4.3l.8 2-.8 2c-1.8 2.7-4.5 4.3-7.7 4.3-3.7 0-7.2-2.1-9.8-6.3Z" />
      <path d="M20 12l2.5-3.5v7L20 12Z" />
      <circle cx="7" cy="11" r="1" fill="currentColor" stroke="none" />
      <path d="M12 18.3V21a1.6 1.6 0 0 0 3.2 0" />
    </>
  ),
  // 웜: 물결 몸통 + 머리
  worm: (
    <>
      <path d="M3 13.5c2-4.5 4-4.5 6 0s4 4.5 6 0 4-4.5 6 0" />
      <circle cx="3" cy="13.5" r="1.6" />
      <path d="M8 9.5v1M14 17v1" />
    </>
  ),
  // 스푼: 타원 + 링 + 훅
  spoon: (
    <>
      <path d="M12 2.5c2.9 0 5 2.7 5 6.3S14.9 15 12 15s-5-2.6-5-6.2 2.1-6.3 5-6.3Z" />
      <path d="M12 15v3.5M12 18.5a2.2 2.2 0 0 0 2.4 2.2c1-.1 1.6-.9 1.6-1.9" />
    </>
  ),
  // 지그헤드: 납 헤드 + 아이 + 훅
  jighead: (
    <>
      <circle cx="8" cy="9.5" r="3.6" />
      <path d="M8 5.9V3.2" />
      <path d="M11.4 10.5c3.7 0 6.6 2 6.6 5.2 0 2.6-1.9 4.6-4.4 4.6" />
      <path d="M13.6 20.3l-1.6-1.6" />
    </>
  ),
  // 스피너베이트: V 와이어 + 블레이드 + 헤드/스커트
  spinner: (
    <>
      <path d="M5.5 17.5L10.5 6l5 3.2" />
      <path d="M15.5 9.2c2.6-1.9 5.2-.5 5.2 2.3 0 2.7-2.7 4.3-4.9 2.7-1.9-1.4-1.9-3.7-.3-5Z" />
      <circle cx="5.5" cy="17.5" r="1.9" />
      <path d="M4.2 19.2l-1.2 2.3M5.5 19.4v2.4M6.8 19.2l1.2 2.3" />
    </>
  ),
  // 바늘
  hook: (
    <>
      <path d="M15 2.5v10a5.5 5.5 0 0 1-11 0v-1.8" />
      <path d="M4 12.5L2 14.3" />
      <circle cx="15" cy="2.5" r="1.2" />
    </>
  ),
  // 싱커
  sinker: (
    <>
      <path d="M12 4.5c-3.1 4-4.8 6.8-4.8 9.6a4.8 4.8 0 0 0 9.6 0c0-2.8-1.7-5.6-4.8-9.6Z" />
      <path d="M12 4.5V2" />
    </>
  ),
  // 낚싯대 + 릴
  rod: (
    <>
      <path d="M3.5 20.5L20 4" />
      <path d="M20 4l1.5-1.5" />
      <circle cx="8.5" cy="15.5" r="2.6" />
      <path d="M11 13l4.5-.8" />
    </>
  ),
  // 라인 스풀
  line: (
    <>
      <circle cx="11" cy="12" r="7.5" />
      <circle cx="11" cy="12" r="2.6" />
      <path d="M18.5 12H22" />
    </>
  ),
  // 상자
  box: (
    <>
      <path d="M3 8l9-4.5L21 8v8.5L12 21l-9-4.5V8Z" />
      <path d="M3 8l9 4.5L21 8M12 12.5V21" />
    </>
  ),
  // 에기 (오징어)
  squid: (
    <>
      <path d="M12 2.8c2.9 0 4.9 3 4.9 7.2V13H7.1v-3c0-4.2 2-7.2 4.9-7.2Z" />
      <path d="M7.1 8.5L4 10.3M16.9 8.5L20 10.3" />
      <path d="M8.5 13l-1.8 7M12 13v8M15.5 13l1.8 7" />
      <circle cx="10" cy="9" r=".9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="9" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  // 개구리 루어
  frog: (
    <>
      <path d="M4 14c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5-3.6 6-8 6-8-2.1-8-6Z" />
      <circle cx="8.5" cy="8.5" r="1.8" />
      <circle cx="15.5" cy="8.5" r="1.8" />
      <path d="M20 14l2 1.5M4 14l-2 1.5" />
    </>
  ),
  // 타이라바: 헤드 + 스커트
  tairaba: (
    <>
      <circle cx="12" cy="7.5" r="4" />
      <path d="M12 3.5V1.8" />
      <path d="M9.2 11.2l-2 9.3M12 11.5v9.5M14.8 11.2l2 9.3" />
    </>
  ),
  // 메탈지그
  metaljig: (
    <>
      <path d="M12 2.5l3.8 9.5L12 21.5 8.2 12 12 2.5Z" />
      <path d="M12 2.5V1M12 21.5c0 1.2 1.3 1.6 2.2.9" />
      <path d="M10 12h4" />
    </>
  ),
  // 장비/악세사리: 태클박스
  gear: (
    <>
      <path d="M3 9.5h18v10H3z" />
      <path d="M8 9.5V7a4 4 0 0 1 8 0v2.5M3 14h18" />
    </>
  ),
};

export default function CategoryIcon({ slug, iconEmoji, className = "w-6 h-6", strokeWidth = 1.7 }: Props) {
  if (iconEmoji && iconEmoji.trim()) {
    return <span className={className} aria-hidden>{iconEmoji}</span>;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[iconKeyFor(slug)]}
    </svg>
  );
}

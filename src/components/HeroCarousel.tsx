"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type Slide = {
  href: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  cta: string;
  bgClass?: string;      // tailwind 그라디언트
  image?: string;        // 배경 이미지 URL (지정시 그라디언트 위에 어둡게 오버레이)
  imageOnly?: boolean;   // true 면 문구·버튼·오버레이 없이 이미지만
  textClass?: string;
};

const DEFAULT_SLIDES: Slide[] = [
  {
    href: "/products?sale=1",
    eyebrow: "시즌 특가",
    title: "봄 시즌 낚시용품 대전",
    subtitle: "최대 30% 할인 · 무료배송 3만원 이상",
    cta: "할인상품 보러가기",
    bgClass: "bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500",
  },
  {
    href: "/products?category=rod&sort=new",
    eyebrow: "신상품 입고",
    title: "2026 신상 낚싯대 모음",
    subtitle: "프리미엄 카본 · 가벼운 무게 · 강한 내구성",
    cta: "신상품 보기",
    bgClass: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600",
  },
  {
    href: "/products?category=lure&sort=best",
    eyebrow: "베스트셀러",
    title: "실전 검증된 루어 컬렉션",
    subtitle: "수만 명의 낚시인이 선택한 인기 모델",
    cta: "베스트 보러가기",
    bgClass: "bg-gradient-to-br from-orange-600 via-accent-500 to-amber-400",
  },
];

export default function HeroCarousel({ slides = DEFAULT_SLIDES }: { slides?: Slide[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [paused, slides.length]);

  const go = (i: number) => setIdx((i + slides.length) % slides.length);

  // 모바일 스와이프: 가로로 40px 이상 밀면 이전/다음 슬라이드. 스와이프한 직후의 클릭은 링크 이동으로 치지 않는다
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
    swiped.current = false;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current;
    touch.current = null;
    setPaused(false);
    if (!st) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      go(idx + (dx < 0 ? 1 : -1));
    }
  };

  return (
    <div
      className="relative h-56 sm:h-72 lg:h-80 rounded-xl overflow-hidden touch-pan-y select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => { touch.current = null; setPaused(false); }}
    >
      {slides.map((s, i) => (
        <Link
          key={i}
          href={s.href}
          aria-hidden={i !== idx}
          tabIndex={i === idx ? 0 : -1}
          draggable={false}
          onClick={(e) => { if (swiped.current) { e.preventDefault(); swiped.current = false; } }}
          className={`absolute inset-0 flex items-center px-6 sm:px-10 lg:px-14 ${s.bgClass || "bg-brand-500"} text-white transition-opacity duration-700 overflow-hidden ${
            i === idx ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {s.image && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt={s.imageOnly ? s.title : ""} className="absolute inset-0 w-full h-full object-cover" />
              {!s.imageOnly && <div className="absolute inset-0 bg-black/45" />}
            </>
          )}
          <div className={`relative ${s.imageOnly && s.image ? "hidden" : ""}`}>
            <div className="text-xs sm:text-sm opacity-80">{s.eyebrow}</div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mt-1.5 leading-tight">{s.title}</h2>
            {s.subtitle && <p className="mt-2 sm:mt-3 text-sm sm:text-base opacity-90">{s.subtitle}</p>}
            <span className="mt-4 inline-block bg-white text-brand-700 hover:bg-gray-100 text-sm font-bold px-4 py-2 rounded">
              {s.cta} →
            </span>
          </div>
        </Link>
      ))}

      {/* 좌우 화살표 (md 이상) */}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); go(idx - 1); }}
        aria-label="이전"
        className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white items-center justify-center"
      >‹</button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); go(idx + 1); }}
        aria-label="다음"
        className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white items-center justify-center"
      >›</button>

      {/* 인디케이터 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.preventDefault(); go(i); }}
            aria-label={`${i + 1}번 슬라이드`}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>

      {/* 카운터 */}
      <div className="absolute bottom-3 right-4 text-white/80 text-xs font-mono tabular-nums">
        {idx + 1} / {slides.length}
      </div>
    </div>
  );
}

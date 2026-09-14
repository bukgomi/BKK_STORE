"use client";
import { useEffect, useRef, useState } from "react";

// 탭 순서 = 페이지 섹션 순서 (스크롤 스파이가 DOM 순서를 전제로 함)
const TABS = [
  { id: "detail",   label: "상세정보" },
  { id: "reviews",  label: "리뷰" },
  { id: "qna",      label: "Q&A" },
  { id: "shipping", label: "배송/교환" },
];

type Props = { reviewCount?: number; qnaCount?: number };

export default function ProductInfoTabs({ reviewCount = 0, qnaCount = 0 }: Props) {
  const [active, setActive] = useState("detail");
  const barRef = useRef<HTMLDivElement>(null);
  const counts: Record<string, number> = { reviews: reviewCount, qna: qnaCount };

  // 탭 바가 화면 상단에 붙은 뒤의 높이만큼 보정
  const offset = () => (barRef.current?.offsetHeight ?? 48) + (window.innerWidth < 768 ? 64 : 0) + 8;

  useEffect(() => {
    const handler = () => {
      const limit = offset() + 40;
      const positions = TABS.map((t) => {
        const el = document.getElementById(`section-${t.id}`);
        return { id: t.id, top: el ? el.getBoundingClientRect().top : Infinity };
      });
      const visible = positions.filter((p) => p.top < limit).pop();
      if (visible && visible.id !== active) setActive(visible.id);
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, [active]);

  const jump = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - offset();
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div ref={barRef} className="sticky top-[64px] md:top-0 z-20 mt-4 bg-white -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex gap-6 md:gap-8 border-b border-gray-200 max-md:justify-around">
        {TABS.map((t) => {
          const on = active === t.id;
          const n = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => jump(t.id)}
              aria-current={on ? "true" : undefined}
              className={`relative -mb-px py-3 md:py-3.5 text-[14px] md:text-[16px] whitespace-nowrap border-b-2 transition-colors ${
                on ? "border-gray-900 text-gray-900 font-bold" : "border-transparent text-gray-500 font-medium hover:text-gray-800"
              }`}
            >
              {t.label}
              {n > 0 && <span className={`ml-1.5 text-[13px] md:text-[14px] font-medium ${on ? "text-gray-700" : "text-gray-400"}`}>{n.toLocaleString()}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

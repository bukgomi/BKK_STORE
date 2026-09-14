// 메인 페이지 좌측에 고정되는 혜택 안내 패널 (넓은 화면에서만 표시, 본문 컨테이너 바깥 여백에 위치)
export type BenefitItem = { icon: string; title: string; desc: string };

export default function BenefitSidebar({ items }: { items: BenefitItem[] }) {
  return (
    <aside
      aria-label="쇼핑 혜택 안내"
      className="hidden min-[1640px]:flex fixed top-1/2 -translate-y-1/2 z-30 w-[150px] flex-col gap-2.5"
      style={{ left: "max(16px, calc((100vw - 1260px) / 2 - 172px))" }}
    >
      {items.map((b) => (
        <div key={b.title} className="card p-4 flex flex-col items-center text-center gap-1 shadow-sm">
          <div className="text-3xl leading-none">{b.icon}</div>
          <div className="text-[13px] font-bold text-gray-800 mt-2 leading-snug break-keep">{b.title}</div>
          <div className="text-[11px] text-gray-500 leading-snug break-keep">{b.desc}</div>
        </div>
      ))}
    </aside>
  );
}

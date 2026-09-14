import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "청소년보호정책 | 탑캐스팅",
  description: "청소년 유해정보로부터의 보호 정책 안내",
};

const COMPANY = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";
const YOUTH_OFFICER = process.env.NEXT_PUBLIC_YOUTH_OFFICER || "홍길동";
const YOUTH_EMAIL = process.env.NEXT_PUBLIC_YOUTH_EMAIL || "youth@example.com";
const CS_PHONE = process.env.NEXT_PUBLIC_CS_PHONE || "00-000-0000";

export default function YouthProtectionPage() {
  return (
    <>
      <h1 className="text-2xl font-bold mb-2">청소년보호정책</h1>
      <p className="text-xs text-gray-500 mb-8">시행일: 2026년 1월 1일</p>

      <Section n="1" title="기본 정책">
        {COMPANY}은 「청소년 보호법」 및 관련 법령에 따라, 청소년이 건전한 인격체로 성장할 수 있도록
        청소년 유해정보로부터 청소년을 보호하고 청소년의 권익을 보장하기 위해 다음과 같이 청소년보호정책을 수립·시행합니다.
      </Section>

      <Section n="2" title="청소년 유해정보의 차단 및 관리">
        <ul className="list-disc list-inside space-y-1">
          <li>회사는 청소년에게 유해한 정보가 게시되지 않도록 사전 모니터링을 실시합니다</li>
          <li>청소년 유해상품의 판매·광고를 일체 금지합니다</li>
          <li>회원가입 시 만 14세 미만 아동의 경우 법정대리인의 동의 절차를 거칩니다</li>
        </ul>
      </Section>

      <Section n="3" title="유해정보 신고">
        <p>청소년에게 유해하다고 판단되는 정보를 발견한 경우 다음 채널로 신고해주시기 바랍니다.</p>
        <div className="bg-gray-50 border border-gray-200 rounded p-4 mt-3 text-sm">
          <div className="grid grid-cols-[100px_1fr] gap-y-1.5">
            <span className="text-gray-500">청소년보호책임자</span><span>{YOUTH_OFFICER}</span>
            <span className="text-gray-500">전화</span><span>{CS_PHONE}</span>
            <span className="text-gray-500">이메일</span><span className="font-mono">{YOUTH_EMAIL}</span>
          </div>
        </div>
      </Section>

      <Section n="4" title="청소년보호를 위한 활동">
        <ul className="list-disc list-inside space-y-1">
          <li>청소년 유해정보로부터의 청소년 보호계획 수립</li>
          <li>임직원의 청소년 보호 의무 및 책임에 관한 교육</li>
          <li>유해정보에 대한 청소년 접근 제한 및 관리 조치 강화</li>
          <li>청소년 유해정보 신고 시 신속한 처리 및 결과 통보</li>
        </ul>
      </Section>

      <Section n="5" title="외부 신고처">
        청소년 유해 콘텐츠 관련 외부 신고 기관:
        <ul className="list-disc list-inside ml-6 mt-2 space-y-0.5 text-xs">
          <li>방송통신심의위원회 (인터넷피해구제센터): (국번없이) 1377 / www.kocsc.or.kr</li>
          <li>청소년사이버상담센터: (국번없이) 1388 / www.cyber1388.kr</li>
          <li>경찰청 사이버수사국: (국번없이) 182 / cyberbureau.police.go.kr</li>
        </ul>
      </Section>

      <p className="mt-12 text-xs text-gray-500 border-t border-gray-200 pt-4">
        본 정책은 2026년 1월 1일부터 시행됩니다.
      </p>
    </>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-bold mb-2 mt-6">{n}. {title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

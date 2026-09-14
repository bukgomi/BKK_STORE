import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 탑캐스팅",
  description: "탑캐스팅 개인정보처리방침 안내",
};

const COMPANY = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";
const PRIVACY_OFFICER = process.env.NEXT_PUBLIC_PRIVACY_OFFICER || "홍길동";
const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@example.com";
const CS_PHONE = process.env.NEXT_PUBLIC_CS_PHONE || "00-000-0000";

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-2xl font-bold mb-2">개인정보처리방침</h1>
      <p className="text-xs text-gray-500 mb-8">시행일: 2026년 1월 1일</p>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-900 mb-8">
        {COMPANY}은 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게
        처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
      </div>

      <Section n="제1조" title="개인정보의 처리 목적">
        회사는 다음의 목적을 위하여 개인정보를 처리하며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라
        별도의 동의를 받는 등 필요한 조치를 이행합니다.
        <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
          <li>회원 가입 및 관리: 회원가입 의사 확인, 본인 식별·인증, 회원자격 유지·관리, 부정이용 방지</li>
          <li>재화 또는 서비스 제공: 물품배송, 서비스 제공, 본인인증, 요금결제·정산</li>
          <li>고충처리: 민원인의 신원 확인, 민원사항 확인, 사실조사를 위한 연락·통지, 처리결과 통보</li>
          <li>마케팅 및 광고에의 활용: 신규 서비스 개발, 이벤트 정보 제공 (별도 동의 시)</li>
        </ul>
      </Section>

      <Section n="제2조" title="개인정보의 처리 및 보유 기간">
        <ol className="list-decimal list-inside space-y-2">
          <li>회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 보유·이용기간 내에서 개인정보를 처리·보유합니다.</li>
          <li>각 개인정보의 처리 및 보유 기간은 다음과 같습니다.
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
              <li><b>회원 가입 정보</b>: 회원 탈퇴 시까지 (단, 부정이용 방지를 위해 1년간 보관 후 파기)</li>
              <li><b>전자상거래 기록</b>: 「전자상거래법」에 따라 5년 (계약/청약철회/대금결제/재화공급)</li>
              <li><b>소비자 불만 또는 분쟁처리 기록</b>: 3년</li>
              <li><b>표시·광고 기록</b>: 6개월</li>
              <li><b>접속 로그</b>: 「통신비밀보호법」에 따라 3개월</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section n="제3조" title="처리하는 개인정보의 항목">
        <ol className="list-decimal list-inside space-y-2">
          <li>필수 항목
            <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5">
              <li>회원가입: 이메일, 비밀번호(암호화), 이름</li>
              <li>주문/결제: 받는분 이름, 휴대폰 번호, 배송지 주소</li>
              <li>본인인증: 휴대폰 번호 (SMS OTP)</li>
            </ul>
          </li>
          <li>선택 항목
            <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5">
              <li>마케팅 수신 동의 (이메일, SMS, 카카오 알림톡)</li>
            </ul>
          </li>
          <li>자동 수집 항목
            <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5">
              <li>IP 주소, 쿠키, 방문 일시, 서비스 이용 기록, 기기 정보, OS, 브라우저 종류</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section n="제4조" title="개인정보의 제3자 제공">
        회사는 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.
        <table className="w-full text-xs mt-3 border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left border-b border-gray-200">제공받는 자</th>
              <th className="px-3 py-2 text-left border-b border-gray-200">제공 목적</th>
              <th className="px-3 py-2 text-left border-b border-gray-200">제공 항목</th>
              <th className="px-3 py-2 text-left border-b border-gray-200">보유·이용기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-2 border-b border-gray-100">택배사 (CJ대한통운, 한진택배 등)</td>
              <td className="px-3 py-2 border-b border-gray-100">상품 배송</td>
              <td className="px-3 py-2 border-b border-gray-100">받는분 이름, 휴대폰 번호, 주소</td>
              <td className="px-3 py-2 border-b border-gray-100">배송 완료 후 30일</td>
            </tr>
            <tr>
              <td className="px-3 py-2">결제대행사 (토스페이먼츠, KG이니시스, 네이버페이)</td>
              <td className="px-3 py-2">결제 처리</td>
              <td className="px-3 py-2">결제 정보, 주문번호, 금액</td>
              <td className="px-3 py-2">관계법령에 따른 기간</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section n="제5조" title="개인정보 처리의 위탁">
        회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.
        <table className="w-full text-xs mt-3 border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left border-b border-gray-200">수탁자</th>
              <th className="px-3 py-2 text-left border-b border-gray-200">위탁 업무</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-2 border-b border-gray-100">알리고(Aligo)</td>
              <td className="px-3 py-2 border-b border-gray-100">SMS / 카카오 알림톡 발송</td>
            </tr>
            <tr>
              <td className="px-3 py-2 border-b border-gray-100">스마트택배 (SweetTracker)</td>
              <td className="px-3 py-2 border-b border-gray-100">배송 추적</td>
            </tr>
            <tr>
              <td className="px-3 py-2">호스팅 사업자</td>
              <td className="px-3 py-2">서비스 제공을 위한 시스템 운영</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section n="제6조" title="정보주체의 권리·의무 및 행사 방법">
        정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
        <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
          <li>개인정보 열람 요구</li>
          <li>오류 등이 있을 경우 정정 요구</li>
          <li>삭제 요구 (단, 다른 법령에서 그 개인정보를 보존하도록 규정한 경우에는 그러하지 아니함)</li>
          <li>처리정지 요구</li>
          <li>회원 탈퇴 (마이페이지에서 직접 가능)</li>
        </ul>
        <p className="mt-2 text-xs text-gray-500">
          권리 행사는 마이페이지에서 직접 하시거나, 개인정보보호책임자에게 서면, 전화, 전자우편 등을 통하여 요청하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.
        </p>
      </Section>

      <Section n="제7조" title="개인정보의 안전성 확보 조치">
        회사는 「개인정보 보호법」 제29조에 따라 다음과 같은 안전성 확보 조치를 취하고 있습니다.
        <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
          <li>관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육</li>
          <li>기술적 조치: 개인정보처리시스템 접근 권한 관리, 접근통제시스템 설치, 비밀번호의 암호화, 보안프로그램 설치 (AES-256-GCM 휴대폰 번호 암호화)</li>
          <li>물리적 조치: 전산실, 자료보관실 등의 접근 통제</li>
          <li>접속기록의 보관 및 위변조 방지</li>
          <li>개인정보의 암호화 (전송 구간 SSL/TLS, 저장 구간 AES-256)</li>
        </ul>
      </Section>

      <Section n="제8조" title="쿠키의 사용">
        회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다.
        이용자는 웹브라우저 옵션 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 일부 서비스 이용에 어려움이 있을 수 있습니다.
      </Section>

      <Section n="제9조" title="개인정보 보호책임자">
        <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm">
          <div className="grid grid-cols-[80px_1fr] gap-y-1.5">
            <span className="text-gray-500">성명</span><span>{PRIVACY_OFFICER}</span>
            <span className="text-gray-500">직책</span><span>개인정보 보호책임자</span>
            <span className="text-gray-500">연락처</span><span>{CS_PHONE}</span>
            <span className="text-gray-500">이메일</span><span className="font-mono">{PRIVACY_EMAIL}</span>
          </div>
        </div>
      </Section>

      <Section n="제10조" title="개인정보 처리방침의 변경">
        본 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지합니다.
      </Section>

      <Section n="권익침해 구제방법" title="">
        개인정보 침해로 인한 구제를 받기 위하여 아래의 기관에 분쟁해결이나 상담 등을 신청하실 수 있습니다.
        <ul className="list-disc list-inside ml-6 mt-2 space-y-0.5 text-xs">
          <li>개인정보분쟁조정위원회: (국번없이) 1833-6972 / www.kopico.go.kr</li>
          <li>개인정보침해신고센터: (국번없이) 118 / privacy.kisa.or.kr</li>
          <li>대검찰청 사이버수사과: (국번없이) 1301 / www.spo.go.kr</li>
          <li>경찰청 사이버수사국: (국번없이) 182 / cyberbureau.police.go.kr</li>
        </ul>
      </Section>

      <p className="mt-12 text-xs text-gray-500 border-t border-gray-200 pt-4">
        본 방침은 2026년 1월 1일부터 시행됩니다.
      </p>
    </>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-bold mb-2 mt-6">
        {n}{title && ` (${title})`}
      </h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

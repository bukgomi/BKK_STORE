import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 | 탑캐스팅",
  description: "탑캐스팅 서비스 이용약관 안내",
};

const COMPANY = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";

export default function TermsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold mb-2">이용약관</h1>
      <p className="text-xs text-gray-500 mb-8">시행일: 2026년 1월 1일</p>

      <Section n="제1조" title="목적">
        본 약관은 {COMPANY}(이하 "회사")이 운영하는 온라인 쇼핑몰에서 제공하는 인터넷 관련 서비스를 이용함에 있어,
        회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
      </Section>

      <Section n="제2조" title="정의">
        <ol className="list-decimal list-inside space-y-1">
          <li>"몰"이란 회사가 재화 또는 용역을 이용자에게 제공하기 위하여 운영하는 가상의 영업장을 말합니다.</li>
          <li>"이용자"란 본 사이트에 접속하여 본 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</li>
          <li>"회원"이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 지속적으로 서비스를 이용할 수 있는 자를 말합니다.</li>
          <li>"비회원"이란 회원에 가입하지 않고 회사가 제공하는 서비스를 이용하는 자를 말합니다.</li>
        </ol>
      </Section>

      <Section n="제3조" title="약관의 명시·효력 및 개정">
        <ol className="list-decimal list-inside space-y-1">
          <li>회사는 본 약관의 내용과 상호, 대표자 성명, 사업장 주소, 전화번호, 사업자등록번호 등을 이용자가 쉽게 알 수 있도록 초기 화면에 게시합니다.</li>
          <li>회사는 「전자상거래 등에서의 소비자보호에 관한 법률」, 「약관의 규제에 관한 법률」 등 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</li>
          <li>약관을 개정할 경우 적용일자 및 개정사유를 명시하여 시행일 7일 전부터 공지합니다. 다만 회원에게 불리한 변경의 경우 30일 전부터 공지합니다.</li>
          <li>회원이 개정약관에 동의하지 않을 경우 적용일자 전일까지 거부 의사를 표시할 수 있으며, 이 경우 회사는 회원의 이용계약을 해지할 수 있습니다.</li>
        </ol>
      </Section>

      <Section n="제4조" title="회원가입">
        <ol className="list-decimal list-inside space-y-1">
          <li>이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의함으로써 회원가입을 신청합니다.</li>
          <li>회사는 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.
            <ul className="list-disc list-inside ml-6 mt-1 text-gray-600">
              <li>가입 신청자가 본 약관에 의해 이전에 회원자격을 상실한 적이 있는 경우</li>
              <li>실명이 아니거나 타인의 명의를 이용한 경우</li>
              <li>허위 정보를 기재하거나 회사가 제시하는 내용을 기재하지 않은 경우</li>
              <li>만 14세 미만 아동이 법정대리인의 동의를 얻지 아니한 경우</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section n="제5조" title="회원 정보의 변경">
        회원은 마이페이지를 통해 언제든지 본인의 개인정보를 열람하고 수정할 수 있습니다.
        회원은 회원가입 시 기재한 사항이 변경되었을 경우 즉시 변경하여야 하며, 변경하지 않아 발생한 불이익에 대하여 회사는 책임지지 않습니다.
      </Section>

      <Section n="제6조" title="개인정보보호 의무">
        회사는 「개인정보보호법」 등 관련 법령이 정하는 바에 따라 회원의 개인정보를 보호하기 위해 노력합니다.
        개인정보의 보호 및 사용에 대해서는 관련 법령 및 회사의 개인정보처리방침이 적용됩니다.
      </Section>

      <Section n="제7조" title="회원의 ID 및 비밀번호 관리">
        <ol className="list-decimal list-inside space-y-1">
          <li>회원의 ID와 비밀번호에 대한 관리책임은 회원에게 있으며, 이를 제3자가 이용하도록 해서는 안 됩니다.</li>
          <li>회원은 ID 및 비밀번호가 도용되거나 제3자가 사용하고 있음을 인지한 경우에는 즉시 회사에 통보하고 안내에 따라야 합니다.</li>
          <li>위 항의 경우 통지를 하지 않거나 통지 후 회사의 안내에 따르지 않아 발생한 불이익에 대하여 회사는 책임지지 않습니다.</li>
        </ol>
      </Section>

      <Section n="제8조" title="구매신청 및 개인정보 제공 동의 등">
        이용자는 몰에서 다음 또는 이와 유사한 방법에 의하여 구매를 신청하며, 회사는 이용자가 구매신청을 함에 있어서 다음 사항을 알기 쉽게 제공하여야 합니다.
        <ul className="list-disc list-inside ml-6 mt-1 text-gray-600">
          <li>재화의 검색 및 선택</li>
          <li>받는 사람의 성명, 주소, 전화번호, 전자우편주소 등 입력</li>
          <li>약관 내용, 청약철회권이 제한되는 서비스, 배송료·설치비 등의 비용 부담과 관련한 내용에 대한 확인</li>
          <li>본 약관에 동의하고 위 사항을 확인하거나 거부하는 표시</li>
          <li>재화의 구매신청 및 이에 관한 확인 또는 회사의 확인에 대한 동의</li>
          <li>결제수단의 선택</li>
        </ul>
      </Section>

      <Section n="제9조" title="계약의 성립">
        <ol className="list-decimal list-inside space-y-1">
          <li>회사는 제8조와 같은 구매신청에 대하여 다음 각 호에 해당하는 경우 승낙하지 않을 수 있습니다.
            <ul className="list-disc list-inside ml-6 mt-1 text-gray-600">
              <li>신청 내용에 허위, 기재누락, 오기가 있는 경우</li>
              <li>미성년자가 청소년보호법에서 금지하는 재화·용역을 구매하는 경우</li>
              <li>기타 구매신청에 승낙하는 것이 회사 기술상 현저히 지장이 있다고 판단하는 경우</li>
            </ul>
          </li>
          <li>회사의 승낙이 제12조 제1항의 수신확인통지 형태로 이용자에게 도달한 시점에 계약이 성립한 것으로 봅니다.</li>
        </ol>
      </Section>

      <Section n="제10조" title="지급방법">
        몰에서 구매한 재화에 대한 대금지급방법은 다음 각 호의 방법 중 가용한 방법으로 할 수 있습니다.
        <ul className="list-disc list-inside ml-6 mt-1 text-gray-600">
          <li>신용카드, 체크카드, 휴대폰 결제</li>
          <li>실시간 계좌이체, 가상계좌</li>
          <li>토스페이, 네이버페이, 카카오페이 등 간편결제</li>
          <li>적립금 및 쿠폰</li>
        </ul>
      </Section>

      <Section n="제11조" title="청약철회 등">
        <ol className="list-decimal list-inside space-y-1">
          <li>이용자는 「전자상거래 등에서의 소비자보호에 관한 법률」 제13조 제2항에 따른 계약내용에 관한 서면을 받은 날부터 7일 이내에 청약철회를 할 수 있습니다.</li>
          <li>이용자는 재화를 배송받은 경우 다음 각 호의 어느 하나에 해당하는 경우에는 반품 및 교환을 할 수 없습니다.
            <ul className="list-disc list-inside ml-6 mt-1 text-gray-600">
              <li>이용자에게 책임 있는 사유로 재화가 멸실 또는 훼손된 경우</li>
              <li>이용자의 사용 또는 일부 소비에 의하여 재화의 가치가 현저히 감소한 경우</li>
              <li>시간의 경과에 의하여 재판매가 곤란할 정도로 재화의 가치가 현저히 감소한 경우</li>
              <li>같은 성능을 지닌 재화로 복제가 가능한 경우 그 원본인 재화의 포장을 훼손한 경우</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section n="제12조" title="환급">
        회사는 이용자가 구매신청한 재화가 품절 등의 사유로 인도 또는 제공할 수 없을 때에는 지체 없이 그 사유를 이용자에게 통지하고
        사전에 재화의 대금을 받은 경우에는 대금을 받은 날부터 영업일 기준 3일 이내에 환급하거나 환급에 필요한 조치를 취합니다.
      </Section>

      <Section n="제13조" title="저작권의 귀속 및 이용제한">
        회사가 작성한 저작물에 대한 저작권 기타 지적재산권은 회사에 귀속합니다.
        이용자는 몰을 이용함으로써 얻은 정보를 회사의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용해서는 안 됩니다.
      </Section>

      <Section n="제14조" title="분쟁해결">
        <ol className="list-decimal list-inside space-y-1">
          <li>회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 고객센터를 설치·운영합니다.</li>
          <li>회사와 이용자 간에 발생한 전자상거래 분쟁과 관련하여 이용자의 피해구제신청이 있는 경우에는 공정거래위원회 또는 시·도지사가 의뢰하는 분쟁조정기관의 조정에 따를 수 있습니다.</li>
        </ol>
      </Section>

      <Section n="제15조" title="재판권 및 준거법">
        본 약관과 관련하여 회사와 이용자 간에 분쟁이 발생할 경우, 그 분쟁은 대한민국 법령을 적용하며 민사소송법상의 관할법원에 제소합니다.
      </Section>

      <p className="mt-12 text-xs text-gray-500 border-t border-gray-200 pt-4">
        부칙: 본 약관은 2026년 1월 1일부터 시행합니다.
      </p>
    </>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-bold mb-2 mt-6">{n} ({title})</h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

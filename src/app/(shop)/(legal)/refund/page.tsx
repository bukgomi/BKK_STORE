import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "교환·반품·환불 안내 | 탑캐스팅",
  description: "청약철회, 교환, 반품, 환불 정책 안내",
};

export default function RefundPage() {
  return (
    <>
      <h1 className="text-2xl font-bold mb-2">교환·반품·환불 안내</h1>
      <p className="text-xs text-gray-500 mb-8">「전자상거래 등에서의 소비자보호에 관한 법률」에 따른 청약철회 안내</p>

      <Section title="청약철회 가능 기간">
        <ul className="list-disc list-inside space-y-1">
          <li>상품 수령일로부터 <b>7일 이내</b> 청약철회 가능 (단순 변심)</li>
          <li>상품에 하자가 있거나 표시·광고와 다른 경우: 그 사실을 안 날 또는 알 수 있었던 날부터 <b>30일 이내</b>, 받은 날부터 <b>3개월 이내</b></li>
        </ul>
      </Section>

      <Section title="교환·반품 신청 방법">
        <ol className="list-decimal list-inside space-y-1">
          <li>마이페이지 → 주문 내역에서 [반품 신청] 또는 [교환 신청] 버튼 클릭</li>
          <li>사유와 사진을 첨부하여 신청 (단순 변심 / 상품 불량 / 오배송 등)</li>
          <li>관리자 승인 후 회수 송장이 발급됩니다</li>
          <li>택배사가 1~2 영업일 내 방문 회수합니다</li>
          <li>회수 상품 검수 후 환불 또는 교환 처리 (영업일 기준 3~5일)</li>
        </ol>
      </Section>

      <Section title="반품 배송비">
        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left border-b border-gray-200">사유</th>
              <th className="px-4 py-2 text-right border-b border-gray-200">왕복 배송비 부담</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="px-4 py-2 border-b border-gray-100">단순 변심 / 사이즈 교환</td><td className="px-4 py-2 text-right border-b border-gray-100">고객 부담 (6,000원)</td></tr>
            <tr><td className="px-4 py-2 border-b border-gray-100">상품 불량 / 오배송 / 파손</td><td className="px-4 py-2 text-right border-b border-gray-100 text-emerald-600 font-bold">판매자 부담</td></tr>
            <tr><td className="px-4 py-2">표시·광고와 다른 경우</td><td className="px-4 py-2 text-right text-emerald-600 font-bold">판매자 부담</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="청약철회가 제한되는 경우">
        다음의 경우 청약철회가 불가능하거나 제한될 수 있습니다.
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>고객의 책임 있는 사유로 상품이 멸실 또는 훼손된 경우</li>
          <li>고객의 사용 또는 일부 소비에 의하여 상품의 가치가 현저히 감소한 경우</li>
          <li>시간의 경과에 의하여 재판매가 곤란할 정도로 상품 가치가 현저히 감소한 경우</li>
          <li>같은 성능을 지닌 상품으로 복제 가능한 경우 그 원본의 포장을 훼손한 경우</li>
          <li>주문 제작 / 맞춤 제작 상품 (개별 안내)</li>
          <li>위생 관련 상품 (개봉 시 제한)</li>
        </ul>
      </Section>

      <Section title="환불 방법 및 시기">
        <ul className="list-disc list-inside space-y-1">
          <li>회수된 상품 검수 완료 후 <b>영업일 기준 3~5일 이내</b> 환불 처리</li>
          <li>결제 수단별 환불 시기
            <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5 text-gray-600">
              <li>신용카드: 카드사 승인 취소 (영업일 기준 3~7일)</li>
              <li>실시간 계좌이체 / 가상계좌: 입금 계좌로 환불</li>
              <li>휴대폰 결제: 익월 통신사 청구금액에서 차감</li>
              <li>토스페이 / 네이버페이 / 카카오페이: 각 간편결제 정책에 따름</li>
              <li>적립금: 즉시 복구</li>
              <li>쿠폰: 사용 가능 상태로 복구 (단, 유효기간 만료된 쿠폰은 복구 불가)</li>
            </ul>
          </li>
        </ul>
      </Section>

      <Section title="부분 환불 (일부 상품만 반품)">
        <ul className="list-disc list-inside space-y-1">
          <li>주문 중 일부 상품만 반품 가능합니다</li>
          <li>적립금/쿠폰 할인은 반품 비율만큼 비례 차감되어 환불됩니다</li>
          <li>전체 결제금액이 무료배송 기준 미달이 될 경우 배송비가 환불액에서 차감될 수 있습니다</li>
        </ul>
      </Section>

      <Section title="교환 안내">
        <ul className="list-disc list-inside space-y-1">
          <li>같은 상품의 다른 옵션(색상 등)으로 교환 가능</li>
          <li>다른 상품으로 교환은 반품 후 재구매로 진행해주세요</li>
          <li>교환 후 잔액이 발생하면 환불, 추가 결제가 필요하면 안내드립니다</li>
        </ul>
      </Section>

      <div className="mt-8 bg-amber-50 border border-amber-200 rounded p-4 text-sm">
        <p className="font-bold mb-1">📌 반품 전 필수 확인</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>상품 박스, 부속품, 사은품, 보증서 등 모든 구성품을 함께 반송해주세요</li>
          <li>반품 사유를 정확히 기재해주시면 처리 시간이 단축됩니다</li>
          <li>반품 신청 없이 임의로 반송 시 처리가 지연될 수 있습니다</li>
        </ul>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold mb-3 mt-6">↩️ {title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import { formatMin } from "@/lib/shipping";

export const metadata: Metadata = {
  title: "배송 안내 | 탑캐스팅",
  description: "배송 지역, 배송비, 배송 기간 안내",
};

export default async function ShippingPage() {
  const freeMin = (await getSiteSettings()).freeShippingMin;
  return (
    <>
      <h1 className="text-2xl font-bold mb-2">배송 안내</h1>
      <p className="text-xs text-gray-500 mb-8">최종 업데이트: 2026년 5월 1일</p>

      <Section title="배송 지역">
        <ul className="list-disc list-inside space-y-1">
          <li>전국 배송이 가능합니다 (제주도 및 도서산간 지역 포함)</li>
          <li>해외 배송은 별도로 진행하지 않습니다</li>
          <li>일부 도서산간 지역은 추가 배송비가 발생할 수 있습니다</li>
        </ul>
      </Section>

      <Section title="배송비">
        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left border-b border-gray-200">구분</th>
              <th className="px-4 py-2 text-right border-b border-gray-200">배송비</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="px-4 py-2 border-b border-gray-100">{formatMin(freeMin, "만")} 미만 주문</td><td className="px-4 py-2 text-right border-b border-gray-100">3,000원</td></tr>
            <tr><td className="px-4 py-2 border-b border-gray-100">{formatMin(freeMin, "만")} 이상 주문</td><td className="px-4 py-2 text-right border-b border-gray-100 text-emerald-600 font-bold">무료</td></tr>
            <tr><td className="px-4 py-2 border-b border-gray-100">제주 지역 추가</td><td className="px-4 py-2 text-right border-b border-gray-100">+3,000원</td></tr>
            <tr><td className="px-4 py-2">도서산간 지역 추가</td><td className="px-4 py-2 text-right">+5,000원</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="배송 기간">
        <ul className="list-disc list-inside space-y-1">
          <li>주문 결제 완료 후 영업일 기준 1~3일 이내 출고</li>
          <li>출고 후 일반 지역은 1~2일, 제주/도서산간은 2~4일 소요</li>
          <li>주말, 공휴일은 배송이 진행되지 않으며, 다음 영업일에 순차 배송됩니다</li>
          <li>택배사 사정 또는 천재지변 등으로 배송이 지연될 수 있습니다</li>
        </ul>
      </Section>

      <Section title="택배사">
        <p>기본 배송: <b>CJ대한통운</b></p>
        <p className="text-xs text-gray-500 mt-1">상품 특성에 따라 한진택배, 롯데택배 등을 이용할 수 있습니다.</p>
      </Section>

      <Section title="배송 조회">
        <ol className="list-decimal list-inside space-y-1">
          <li>주문 후 출고 시점에 카카오톡 알림톡 또는 SMS 로 송장번호가 발송됩니다</li>
          <li>마이페이지 → 주문 내역에서 [배송조회] 버튼으로 실시간 위치 확인 가능</li>
          <li>비회원 주문은 받으신 알림톡의 [배송조회] 버튼으로 본인 확인 후 조회 가능</li>
        </ol>
      </Section>

      <Section title="부재중 배송 안내">
        <ul className="list-disc list-inside space-y-1">
          <li>1차 부재 시 택배사에서 재방문 안내 후 보관함 또는 경비실에 위탁 배송</li>
          <li>주문 시 "배송 메모"에 부재중 처리 방법을 기재하시면 참고하여 배송됩니다</li>
        </ul>
      </Section>

      <Section title="주의사항">
        <ul className="list-disc list-inside space-y-1">
          <li>배송지 입력 오류로 인한 반송 시 발생하는 추가 배송비는 고객 부담입니다</li>
          <li>출고 이후에는 배송지 변경이 불가능합니다 (택배사 콜센터 직접 연락 권장)</li>
          <li>대형 상품은 별도 운송이 필요할 수 있으며, 사전에 안내드립니다</li>
        </ul>
      </Section>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded p-4 text-sm">
        배송 관련 문의: 마이페이지 1:1 문의 또는 고객센터로 연락 부탁드립니다.
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold mb-3 mt-6">📦 {title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

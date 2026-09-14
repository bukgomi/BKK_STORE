import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { ALIMTALK_TEMPLATES, type TemplateKey } from "@/lib/alimtalk";
import TestSendForm from "./TestSendForm";

export const dynamic = "force-dynamic";

const KEY_LABEL: Record<TemplateKey, { label: string; trigger: string; color: string; recipient: "고객" | "관리자" }> = {
  ORDER_PAID:        { label: "주문/결제 완료",   trigger: "결제 완료시 자동",         color: "bg-blue-50 text-blue-700",       recipient: "고객" },
  SHIPPING_STARTED:  { label: "배송 시작",         trigger: "관리자 → 발송 처리시 자동", color: "bg-indigo-50 text-indigo-700",   recipient: "고객" },
  DELIVERY_COMPLETED:{ label: "배송 완료",         trigger: "관리자 → 배송완료시 자동", color: "bg-emerald-50 text-emerald-700", recipient: "고객" },
  ORDER_CANCELLED:   { label: "주문 취소",         trigger: "관리자 → 취소시 자동",     color: "bg-red-50 text-red-600",         recipient: "고객" },
  ORDER_REFUNDED:    { label: "환불 완료",         trigger: "관리자 → 환불시 자동",     color: "bg-purple-50 text-purple-700",   recipient: "고객" },
  ADMIN_NEW_ORDER:   { label: "📥 신규 주문 알림",  trigger: "결제 완료시 자동",         color: "bg-amber-50 text-amber-700",     recipient: "관리자" },
};

const isProviderConfigured =
  !!process.env.ALIMTALK_API_KEY &&
  !!process.env.ALIMTALK_USER_ID &&
  !!process.env.ALIMTALK_SENDER_KEY;

function getAdminNotifyConfig() {
  const phones = (process.env.ADMIN_NOTIFY_PHONE || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const enabled = (process.env.ADMIN_NEW_ORDER_NOTIFY || "true").toLowerCase() !== "false";
  const forceSms = (process.env.ADMIN_NEW_ORDER_FORCE_SMS || "").toLowerCase() === "true";
  return { phones, enabled, forceSms };
}

function maskPhoneDisplay(p: string): string {
  const n = p.replace(/[^0-9]/g, "");
  if (n.length < 10) return p;
  return `${n.slice(0, 3)}-****-${n.slice(-4)}`;
}

export default async function AdminNotificationsPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const adminNotify = getAdminNotifyConfig();

  return (
    <div className="space-y-4">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">알림 관리</span>
      </nav>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">카카오 알림톡 템플릿</h1>
          <p className="text-xs text-gray-500 mt-1">
            주문/배송 단계별 자동 발송 메시지입니다. 카카오에 사전 등록된 템플릿과 동일해야 발송됩니다.
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded text-xs font-bold ${
          isProviderConfigured
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}>
          {isProviderConfigured ? "✓ 발송 활성화됨" : "⚠ 콘솔 모드 (환경변수 미설정)"}
        </span>
      </div>

      {!isProviderConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-xs text-amber-800 leading-relaxed">
          <p className="font-bold mb-1">현재 카카오 알림톡 발송이 비활성 상태입니다.</p>
          <p>아래 환경변수를 설정하시면 실제 발송됩니다:</p>
          <ul className="list-disc list-inside mt-2 space-y-0.5 font-mono">
            <li>ALIMTALK_API_KEY</li>
            <li>ALIMTALK_USER_ID</li>
            <li>ALIMTALK_SENDER_KEY (카카오 채널 발신 프로필 키)</li>
            <li>ALIMTALK_SENDER (사전등록된 발신번호)</li>
          </ul>
          <p className="mt-2">
            설정 전까지는 콘솔에 메시지가 출력되어 개발/테스트 가능합니다.
          </p>
        </div>
      )}

      {/* 관리자 신규 주문 알림 설정 */}
      <section className="bg-white rounded border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-bold text-sm">📥 관리자 신규 주문 알림</h2>
            <p className="text-xs text-gray-500 mt-1">결제 완료시 관리자에게 자동으로 알림이 발송됩니다.</p>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-bold ${
            adminNotify.enabled && adminNotify.phones.length > 0
              ? "bg-emerald-50 text-emerald-700"
              : adminNotify.enabled
              ? "bg-amber-50 text-amber-700"
              : "bg-gray-100 text-gray-500"
          }`}>
            {!adminNotify.enabled
              ? "OFF"
              : adminNotify.phones.length > 0
              ? `✓ ON · ${adminNotify.phones.length}명`
              : "⚠ 휴대폰 미등록"}
          </span>
        </div>

        <dl className="text-xs space-y-2 border-t border-gray-100 pt-3">
          <div className="flex">
            <dt className="w-32 text-gray-500">알림 활성화</dt>
            <dd className="font-mono">{adminNotify.enabled ? "true" : "false"}</dd>
          </div>
          <div className="flex">
            <dt className="w-32 text-gray-500">수신 휴대폰</dt>
            <dd>
              {adminNotify.phones.length === 0 ? (
                <span className="text-gray-400">미등록 (ADMIN_NOTIFY_PHONE 환경변수 추가 필요)</span>
              ) : (
                <div className="space-y-0.5">
                  {adminNotify.phones.map((p, i) => (
                    <div key={i} className="font-mono">{maskPhoneDisplay(p)}</div>
                  ))}
                </div>
              )}
            </dd>
          </div>
          <div className="flex">
            <dt className="w-32 text-gray-500">SMS 강제 발송</dt>
            <dd className="font-mono">
              {adminNotify.forceSms ? "true (알림톡과 별개로 SMS 추가)" : "false (알림톡만, 실패시 자동 SMS 폴백)"}
            </dd>
          </div>
          <div className="flex">
            <dt className="w-32 text-gray-500">발송 채널</dt>
            <dd className="text-gray-700">
              <div>📱 카카오 알림톡 (Aligo failover → SMS)</div>
              <div>📧 이메일 (ADMIN_NOTIFY_EMAIL)</div>
              <div>💬 Slack (SLACK_WEBHOOK_URL)</div>
            </dd>
          </div>
        </dl>

        <div className="mt-4 pt-3 border-t border-gray-100 bg-gray-50 -mx-5 -mb-5 px-5 py-3 rounded-b">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            <b>설정 방법:</b> <code className="font-mono">.env</code> 파일에서 다음 환경변수를 수정하세요.
          </p>
          <pre className="mt-2 text-[11px] font-mono bg-white border border-gray-200 rounded p-2 overflow-x-auto">
{`ADMIN_NOTIFY_PHONE="01012345678,01098765432"   # 콤마로 여러 명
ADMIN_NEW_ORDER_NOTIFY="true"                   # false 로 끄기
ADMIN_NEW_ORDER_FORCE_SMS="false"               # true: SMS 추가 발송`}
          </pre>
        </div>
      </section>

      <section className="space-y-3">
        {(Object.keys(ALIMTALK_TEMPLATES) as TemplateKey[]).map((key) => {
          const tpl = ALIMTALK_TEMPLATES[key];
          const meta = KEY_LABEL[key];
          // 미리보기용 샘플 변수
          const sample = {
            name: "홍길동", orderNo: "ORD-20260501-XYZ12",
            amount: "85,000", method: "신용카드",
            courier: "CJ대한통운", trackingNo: "1234567890",
            recipient: "홍길동", productSummary: "초경량 카본 루어대 외 2건",
          };
          const previewBody = tpl.body(sample);

          return (
            <div key={key} className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${meta.color}`}>{meta.label}</span>
                  <code className="text-xs text-gray-400 font-mono">{tpl.templateCode}</code>
                </div>
                <span className="text-[11px] text-gray-500">{meta.trigger}</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
                {/* 본문 미리보기 */}
                <div className="p-5">
                  <div className="text-[11px] text-gray-400 mb-1">본문 (변수가 적용된 미리보기)</div>
                  <pre className="bg-gray-50 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{previewBody}</pre>
                  {tpl.buttons && tpl.buttons.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] text-gray-400 mb-1">버튼</div>
                      <div className="flex gap-2">
                        {tpl.buttons.map((b, i) => (
                          <span key={i} className="text-xs px-3 py-1 rounded border border-gray-300 bg-white">{b.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* 카톡 말풍선 미리보기 */}
                <div className="p-5 bg-yellow-50 border-l border-gray-100">
                  <div className="text-[11px] text-gray-500 mb-2">카카오톡 미리보기</div>
                  <div className="bg-white rounded-lg shadow-sm p-3 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed border border-yellow-200">
                    <div className="font-bold mb-1.5">{tpl.title}</div>
                    {previewBody}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="bg-white rounded border border-gray-200 p-5">
        <h2 className="font-bold text-sm mb-3">테스트 발송</h2>
        <p className="text-xs text-gray-500 mb-3">
          본인 휴대폰으로 테스트 메시지를 받아보실 수 있습니다.
          (콘솔 모드에서는 서버 콘솔에만 출력됩니다)
        </p>
        <TestSendForm />
      </section>
    </div>
  );
}

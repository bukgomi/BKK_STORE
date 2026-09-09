import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TrackingViewer from "@/components/TrackingViewer";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/order-status";
import { getClientInfo, rateLimitAsync } from "@/lib/security";
import TrackingVerifyForm from "./TrackingVerifyForm";

export const dynamic = "force-dynamic";

type Props = {
  params: { orderNo: string };
  searchParams: { last4?: string };
};

function maskAddress(addr: string): string {
  if (!addr) return "";
  // 동/번지 일부만 노출, 상세주소 마스킹
  if (addr.length <= 10) return addr;
  return addr.slice(0, 10) + " ****";
}

function maskName(name: string): string {
  if (!name) return "";
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

export default async function CustomerTrackingPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const order = await prisma.order.findUnique({
    where: { orderNo: params.orderNo },
    select: {
      id: true,
      orderNo: true,
      userId: true,
      status: true,
      recipient: true,
      phone: true,
      address1: true,
      address2: true,
      courier: true,
      trackingNo: true,
      shippedAt: true,
      deliveredAt: true,
    },
  });

  if (!order) notFound();

  // 인증 정책:
  // 1) 로그인 회원이고 본인 주문 → 통과
  // 2) 비로그인 또는 다른 회원 → 받는분 휴대폰 뒷 4자리 일치하면 통과
  const isOwner = !!userId && order.userId === userId;
  const last4 = (searchParams.last4 || "").replace(/[^0-9]/g, "");

  // 뒷 4자리는 경우의 수가 1만 개뿐 → IP+주문 단위로 시도 횟수 제한 (무차별 대입 방어)
  let throttled = false;
  if (!isOwner && last4.length === 4) {
    const { ip } = getClientInfo();
    const rl = await rateLimitAsync(`tracking-verify:${order.id}:${ip || "anon"}`, 5, 10 * 60_000);
    throttled = !rl.ok;
  }

  const phoneDigits = (order.phone || "").replace(/[^0-9]/g, "");
  const phoneOk = !throttled && last4.length === 4 && phoneDigits.endsWith(last4);
  const verified = isOwner || phoneOk;

  if (!verified) {
    return (
      <div className="container-mall py-10 max-w-md">
        <h1 className="text-xl font-bold mb-2">배송조회 본인 확인</h1>
        <p className="text-xs text-gray-500 font-mono mb-6">{order.orderNo}</p>
        <div className="border border-gray-200 rounded p-5 bg-white space-y-3">
          <p className="text-sm text-gray-700">
            본인 확인을 위해 주문시 입력하신 <b>받는분 휴대폰 번호 뒷 4자리</b>를 입력해주세요.
          </p>
          <p className="text-[11px] text-gray-400">
            로그인하시면 자동으로 본인 확인됩니다.{" "}
            <Link href={`/login?callbackUrl=${encodeURIComponent(`/orders/${order.orderNo}/tracking`)}`} className="text-brand-600 hover:underline">로그인</Link>
          </p>
          <TrackingVerifyForm orderNo={order.orderNo} />
          {throttled && (
            <p className="text-xs text-red-500">시도 횟수가 너무 많습니다. 10분 후 다시 시도해주세요.</p>
          )}
          {!throttled && last4.length === 4 && !phoneOk && (
            <p className="text-xs text-red-500">번호가 일치하지 않습니다.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container-mall py-10 max-w-2xl">
      <h1 className="text-xl font-bold mb-2">배송조회</h1>
      <p className="text-xs text-gray-500 font-mono mb-6">{order.orderNo}</p>

      <section className="border border-gray-200 rounded p-5 mb-4 bg-white">
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-gray-500">주문 상태</dt>
            <dd>
              <span className={`px-2 py-0.5 rounded text-xs ${ORDER_STATUS_COLOR[order.status]}`}>
                {ORDER_STATUS_LABEL[order.status]}
              </span>
            </dd>
          </div>
          <div className="flex justify-between"><dt className="text-gray-500">받는분</dt><dd>{isOwner ? order.recipient : maskName(order.recipient)}</dd></div>
          <div className="flex justify-between">
            <dt className="text-gray-500">배송지</dt>
            <dd className="text-right">{isOwner ? `${order.address1} ${order.address2 || ""}` : maskAddress(order.address1)}</dd>
          </div>
          {order.shippedAt && (
            <div className="flex justify-between"><dt className="text-gray-500">발송일시</dt><dd className="text-xs">{order.shippedAt.toLocaleString("ko-KR")}</dd></div>
          )}
          {order.deliveredAt && (
            <div className="flex justify-between"><dt className="text-gray-500">완료일시</dt><dd className="text-xs">{order.deliveredAt.toLocaleString("ko-KR")}</dd></div>
          )}
        </dl>
      </section>

      <section className="border border-gray-200 rounded p-5 bg-white">
        <h2 className="font-bold text-sm pb-3 mb-3 border-b border-gray-100">배송 추적</h2>
        {order.courier && order.trackingNo ? (
          <TrackingViewer courier={order.courier} invoice={order.trackingNo} />
        ) : (
          <p className="text-sm text-gray-500">아직 송장이 등록되지 않았습니다. 발송 후 다시 확인해주세요.</p>
        )}
      </section>

      <div className="mt-6">
        <Link href={isOwner ? "/mypage" : "/"} className="text-sm text-gray-500 hover:text-brand-600">
          ← {isOwner ? "마이페이지로" : "홈으로"}
        </Link>
      </div>
    </div>
  );
}

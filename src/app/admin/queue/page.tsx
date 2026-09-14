import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { queueStats, getFailedJobs } from "@/lib/queue";
import { isRedisAvailable } from "@/lib/redis";
import RetryFailedButton from "./RetryFailedButton";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const stats = await queueStats();
  const failed = stats.backend === "redis" ? await getFailedJobs(20) : [];
  const redisOk = isRedisAvailable();

  return (
    <div className="space-y-5">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">백그라운드 큐</span>
      </nav>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">백그라운드 작업 큐</h1>
          <p className="text-xs text-gray-500 mt-1">
            알림톡/SMS/이메일 발송 등 비동기 작업의 실시간 상태입니다.
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded text-xs font-bold ${
          redisOk ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}>
          {redisOk ? `✓ Redis (${stats.backend})` : "⚠ 인메모리 폴백"}
        </span>
      </div>

      {!redisOk && (
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-xs text-amber-800 leading-relaxed">
          <p className="font-bold mb-1">현재 Redis 가 연결되지 않아 인메모리 큐로 동작 중입니다.</p>
          <p>운영 환경에서는 다음 환경변수를 설정해주세요:</p>
          <pre className="mt-2 font-mono">REDIS_URL="redis://localhost:6379"</pre>
          <p className="mt-2">설정 후에는 작업이 영속화되며 워커 별도 프로세스로 분리 가능합니다 (<code>npm run worker</code>).</p>
        </div>
      )}

      {stats.backend === "redis" ? (
        <>
          {/* 큐 통계 */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            <Card label="대기" value={(stats as any).waiting} color="text-gray-700" />
            <Card label="처리중" value={(stats as any).active} color="text-blue-600" />
            <Card label="지연" value={(stats as any).delayed} color="text-amber-600" />
            <Card label="완료" value={(stats as any).completed} color="text-emerald-600" />
            <Card label="실패" value={(stats as any).failed} color="text-red-500" highlight={(stats as any).failed > 0} />
            <Card label="일시정지" value={(stats as any).paused} color="text-gray-500" />
          </div>

          {/* 실패한 작업 */}
          <section className="bg-white rounded border border-gray-200">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="font-bold text-sm">실패한 작업 ({failed.length})</h2>
              {failed.length > 0 && <RetryFailedButton jobIds={failed.map((j) => j.id!).filter(Boolean)} />}
            </div>
            {failed.length === 0 ? (
              <div className="p-8 text-center text-emerald-600 text-sm">✓ 실패한 작업이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[800px]">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2 w-32">작업</th>
                      <th className="text-left px-3 py-2 w-16">시도</th>
                      <th className="text-left px-3 py-2">실패 사유</th>
                      <th className="text-left px-3 py-2 w-32">발생시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failed.map((j) => (
                      <tr key={j.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono">{j.name}</td>
                        <td className="px-3 py-2 text-center">{j.attemptsMade}</td>
                        <td className="px-3 py-2 text-red-600 truncate max-w-md" title={j.failedReason || ""}>
                          {j.failedReason || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {j.finishedOn ? new Date(j.finishedOn).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="bg-white rounded border border-gray-200 p-5">
          <h2 className="font-bold text-sm mb-3">인메모리 큐 상태</h2>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-gray-500">대기 중</dt><dd>{(stats as any).pending}건</dd></div>
            <div className="flex justify-between">
              <dt className="text-gray-500">등록된 핸들러</dt>
              <dd className="font-mono text-xs">{(stats as any).handlers.join(", ") || "(없음)"}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="bg-blue-50 border border-blue-200 rounded p-4 text-xs text-blue-900 leading-relaxed">
        <p className="font-bold mb-1">💡 운영 팁</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Worker 별도 프로세스 권장: <code className="font-mono">npm run worker</code> (PM2/Docker 호환)</li>
          <li>Next.js 서버 자체에서 워커 끄기: <code className="font-mono">DISABLE_INPROCESS_WORKER=true</code></li>
          <li>실패한 작업은 자동으로 5회까지 지수 백오프로 재시도됩니다</li>
          <li>완료된 작업은 24시간 / 실패한 작업은 7일간 보존됩니다</li>
        </ul>
      </section>
    </div>
  );
}

function Card({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded border p-4 ${highlight ? "border-red-300 bg-red-50/50" : "border-gray-200"}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}

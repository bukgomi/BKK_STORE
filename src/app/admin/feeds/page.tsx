import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";
import { getCachedNaverFeed, FEED_COLUMNS } from "@/lib/naver-feed";
import { formatKRW } from "@/lib/utils";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const FEED_URL = `${SITE.replace(/\/$/, "")}/api/feed/naver`;

export default async function AdminFeedsPage() {
  await requireAdmin(); // 레이아웃 가드와 별개로 페이지마다 재검사 (클라이언트 내비게이션 시 레이아웃은 다시 렌더되지 않음)
  const { tsv, stats } = await getCachedNaverFeed();

  // 첫 5개 행 미리보기
  const preview = tsv.split("\r\n").slice(1, 6); // header 제외
  const previewRows = preview.filter(Boolean).map((line) => line.split("\t"));

  const tokenProtected = !!process.env.NAVER_FEED_ACCESS_TOKEN;
  const naverCategoryConfigured = !!process.env.NAVER_FEED_DEFAULT_CATEGORY;

  return (
    <div className="space-y-5">
      <nav className="text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">상품 피드</span>
      </nav>

      <div>
        <h1 className="text-xl font-bold">네이버 쇼핑 EP 피드</h1>
        <p className="text-xs text-gray-500 mt-1">
          네이버 쇼핑 파트너센터에 등록할 상품 피드 URL을 관리합니다. 5분 간격 캐시 + ETag 자동 처리.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="활성 상품" value={stats.active.toLocaleString()} sub="피드에 포함됨" color="text-emerald-600" />
        <Card label="제외" value={stats.excluded.toLocaleString()} sub="품절/가격0 등" color="text-amber-600" />
        <Card label="파일 크기" value={`${(stats.bytes / 1024).toFixed(1)} KB`} sub="UTF-8 + BOM" color="text-gray-700" />
        <Card label="생성 시각" value={stats.generatedAt.toLocaleTimeString("ko-KR")} sub={stats.generatedAt.toLocaleDateString("ko-KR")} color="text-gray-700" />
      </div>

      {/* 피드 URL */}
      <section className="bg-white rounded border border-gray-200 p-5">
        <h2 className="font-bold text-sm mb-3">📡 피드 URL (네이버 파트너센터에 등록)</h2>
        <div className="flex gap-2 items-center">
          <input
            readOnly
            value={tokenProtected ? `${FEED_URL}?token=${process.env.NAVER_FEED_ACCESS_TOKEN!.slice(0, 4)}***` : FEED_URL}
            className="input h-10 flex-1 font-mono text-xs bg-gray-50"
          />
          <a
            href={FEED_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-xs h-10 px-3"
          >미리보기</a>
          <a
            href={`${FEED_URL}?download=1`}
            className="btn-primary text-xs h-10 px-3"
          >📥 다운로드</a>
          <RefreshButton />
        </div>

        {tokenProtected && (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠ 토큰 보호 활성화됨 — 네이버에 등록 시 <code className="font-mono">?token=...</code> 포함된 전체 URL 입력 필요.
          </p>
        )}

        {!naverCategoryConfigured && (
          <p className="mt-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2">
            💡 <code className="font-mono">NAVER_FEED_DEFAULT_CATEGORY</code> 환경변수에 네이버 쇼핑 카테고리 ID를 설정하면 매칭률이 올라갑니다 (선택).
          </p>
        )}
      </section>

      {/* 등록 가이드 */}
      <section className="bg-blue-50 border border-blue-200 rounded p-5">
        <h2 className="font-bold text-sm mb-3 text-blue-900">🚀 네이버 쇼핑 등록 절차</h2>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-blue-900">
          <li><a href="https://adcenter.shopping.naver.com" target="_blank" rel="noopener noreferrer" className="underline">네이버 쇼핑 파트너센터</a> 가입 (사업자 인증 필요)</li>
          <li>"EP 등록" 메뉴에서 위 피드 URL 입력</li>
          <li>갱신 주기 선택: 4시간 / 일 / 주 (4시간 권장)</li>
          <li>카테고리 매칭 → 매출 30~50% 추가 가능</li>
          <li>네이버페이 사용 권장 (자동 적용됨, <code className="font-mono">include_naver_pay=Y</code>)</li>
          <li>가격 비교 노출 후 1~3일 내 트래픽 유입 시작</li>
        </ol>
      </section>

      {/* 미리보기 */}
      <section className="bg-white rounded border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-sm">미리보기 (처음 5개 상품)</h2>
          <span className="text-[11px] text-gray-400">총 {FEED_COLUMNS.length}개 컬럼</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[1200px]">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {FEED_COLUMNS.slice(0, 12).map((c) => (
                  <th key={c} className="text-left px-2 py-2 font-mono whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {row.slice(0, 12).map((cell, j) => (
                    <td key={j} className="px-2 py-1.5 truncate max-w-[160px]" title={cell}>{cell || "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2 text-[11px] text-gray-400 border-t border-gray-100">
          전체 {FEED_COLUMNS.length}개 컬럼 중 처음 12개만 표시. 다운로드 받아 전체 확인 가능.
        </p>
      </section>

      {/* 컬럼 명세 */}
      <section className="bg-white rounded border border-gray-200 p-5">
        <h2 className="font-bold text-sm mb-3">컬럼 명세 ({FEED_COLUMNS.length}개)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono text-gray-600">
          {FEED_COLUMNS.map((c) => (
            <div key={c} className="px-2 py-1 bg-gray-50 rounded">{c}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div>
    </div>
  );
}

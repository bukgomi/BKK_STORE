import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdminApi } from "@/lib/admin-guard";
import { getLowStockThreshold, notifyAdmin } from "@/lib/notify";
import { formatKRW } from "@/lib/utils";

/**
 * 재고 부족 상품 조회 + 관리자 알림 발송
 * - 관리자가 호출하거나 (assertAdminApi 통과)
 * - Cron이 NOTIFY_CRON_TOKEN 헤더로 호출
 */
async function authorize(req: NextRequest): Promise<{ ok: boolean; status?: number; error?: string }> {
  const token = req.headers.get("x-cron-token");
  if (token && token === process.env.NOTIFY_CRON_TOKEN) return { ok: true };
  const guard = await assertAdminApi();
  return guard.ok ? { ok: true } : { ok: false, status: guard.status, error: guard.error };
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const threshold = getLowStockThreshold();
  const items = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { lowStockThreshold: { equals: null }, stock: { lte: threshold } },
        // 개별 임계치가 있는 상품
        { lowStockThreshold: { not: null } },
      ],
    },
    orderBy: { stock: "asc" },
    take: 100,
    select: { id: true, name: true, sku: true, stock: true, price: true, salePrice: true, lowStockThreshold: true },
  });

  // 개별 임계치 적용 후 필터링
  const lowItems = items.filter((p) => p.stock <= (p.lowStockThreshold ?? threshold));

  return NextResponse.json({ threshold, items: lowItems });
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const threshold = getLowStockThreshold();
  const items = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sku: true, stock: true, lowStockThreshold: true },
  });
  const low = items.filter((p) => p.stock <= (p.lowStockThreshold ?? threshold));

  if (low.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: "재고 부족 상품이 없습니다." });
  }

  const lines = low.map((p) => `- ${p.name} (SKU ${p.sku}) — 잔여 ${p.stock}개`);
  const text = `재고 부족 ${low.length}건\n\n` + lines.slice(0, 30).join("\n") + (low.length > 30 ? `\n\n외 ${low.length - 30}건` : "");

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; font-size: 14px;">
      <h2 style="margin: 0 0 12px;">⚠️ 재고 부족 알림</h2>
      <p>아래 ${low.length}개 상품의 재고가 임계치(${threshold}) 이하입니다.</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">상품명</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">SKU</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">잔여재고</th>
          </tr>
        </thead>
        <tbody>
          ${low.slice(0, 50).map((p) => `
            <tr>
              <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${p.name}</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 12px;">${p.sku}</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: ${p.stock <= 3 ? "#dc2626" : "#d97706"};">${p.stock}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${low.length > 50 ? `<p style="margin-top: 12px; color: #666;">외 ${low.length - 50}건이 더 있습니다.</p>` : ""}
    </div>
  `;

  const result = await notifyAdmin({
    subject: `[탑캐스팅] 재고 부족 알림 (${low.length}건)`,
    html,
    text,
  });

  return NextResponse.json({ ok: true, count: low.length, notified: result });
}

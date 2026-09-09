import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, getClientInfo } from "@/lib/security";
import { notifyAdmin } from "@/lib/notify";
import { escapeHtml } from "@/lib/utils";

const CreateSchema = z.object({
  category: z.enum(["ORDER", "PAYMENT", "DELIVERY", "PRODUCT", "REFUND", "ACCOUNT", "ETC"]).default("ETC"),
  subject: z.string().min(2).max(200),
  content: z.string().min(5).max(5000),
  orderId: z.string().nullable().optional(),
  // 비회원용
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(20).optional(),
  guestName: z.string().max(40).optional(),
});

function generateTicketNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `T-${ymd}-${rand}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const userId = (session.user as any).id as string;

  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const { ip } = getClientInfo(req);
  const rl = await rateLimitAsync(`support:${userId || ip || "anon"}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "1시간 내 5건만 등록 가능합니다." }, { status: 429 });

  try {
    const data = CreateSchema.parse(await req.json());

    // 비회원이면 guest 정보 필수
    if (!userId && (!data.guestEmail || !data.guestName)) {
      return NextResponse.json({ error: "비회원은 이름과 이메일을 입력해주세요." }, { status: 400 });
    }

    const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }) : null;
    const authorName = user?.name || data.guestName || "고객";

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNo: generateTicketNo(),
        userId: userId || null,
        guestEmail: !userId ? data.guestEmail : null,
        guestPhone: !userId ? data.guestPhone : null,
        guestName: !userId ? data.guestName : null,
        category: data.category,
        subject: data.subject,
        orderId: data.orderId || null,
        status: "OPEN",
        messages: {
          create: {
            authorType: "CUSTOMER",
            authorId: userId || null,
            authorName,
            content: data.content,
          },
        },
      },
    });

    // 관리자 알림 (비동기) — 사용자 입력은 HTML 이스케이프 (메일 클라이언트 내 HTML 인젝션 방지)
    const authorEmail = user?.email || data.guestEmail || "";
    void notifyAdmin({
      subject: `[1:1 문의] ${data.subject}`,
      text: `신규 1:1 문의 접수\n\n티켓: ${ticket.ticketNo}\n작성자: ${authorName} (${authorEmail})\n분류: ${data.category}\n\n${data.content}`,
      html: `<h3>신규 1:1 문의</h3><p><b>티켓</b>: ${escapeHtml(ticket.ticketNo)}<br/><b>작성자</b>: ${escapeHtml(authorName)} (${escapeHtml(authorEmail)})<br/><b>분류</b>: ${escapeHtml(data.category)}</p><blockquote style="border-left: 3px solid #1e6fdc; padding-left: 12px; margin-left: 0;">${escapeHtml(data.content).replace(/\n/g, "<br/>")}</blockquote>`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, ticketNo: ticket.ticketNo, id: ticket.id });
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

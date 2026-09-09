import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  reason: z.string().max(500).optional(),
  /// 비밀번호 가입 회원은 비밀번호 재확인 필수
  password: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const userId = (session.user as any).id as string;

  try {
    const data = Schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "회원 정보 없음" }, { status: 404 });
    if (user.status === "WITHDRAWN") {
      return NextResponse.json({ error: "이미 탈퇴 처리된 계정입니다." }, { status: 400 });
    }

    // 비밀번호 가입 회원은 비밀번호 재확인 필수
    if (user.passwordHash) {
      if (!data.password) {
        return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
      }
      const ok = await bcrypt.compare(data.password, user.passwordHash);
      if (!ok) return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 400 });
    }

    // 미정산 주문이 있으면 거부 (PAID, PREPARING, SHIPPED)
    const inflight = await prisma.order.count({
      where: {
        userId: user.id,
        status: { in: ["PAID", "PREPARING", "SHIPPED"] },
      },
    });
    if (inflight > 0) {
      return NextResponse.json({
        error: `진행 중인 주문(${inflight}건)이 있어 탈퇴할 수 없습니다. 배송완료 후 다시 시도해주세요.`,
      }, { status: 400 });
    }

    // 탈퇴 처리: status = WITHDRAWN + PII 분리
    // - 주문 이력은 유지 (전자상거래법 5년 보관)
    // - 이메일/이름/전화번호 익명화
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          status: "WITHDRAWN",
          withdrawnAt: new Date(),
          withdrawReason: data.reason || null,
          // 이메일은 unique 충돌 방지용 더미로 변경
          email: `withdrawn_${user.id}@example.invalid`,
          name: "(탈퇴회원)",
          phone: null,
          phoneEnc: null,
          phoneHash: null,
          image: null,
          // 비밀번호는 즉시 무효화 (해시를 의도적으로 깨진 값으로)
          passwordHash: null,
        },
      }),
      // 모든 활성 세션 무효화 (JWT 세션은 auth.ts 의 상태 재검증으로 곧 끊김)
      prisma.session.deleteMany({ where: { userId: user.id } }),
      // OAuth 링크를 끊어야 같은 소셜 계정으로 재가입 가능 + 탈퇴 계정으로 재로그인 불가
      prisma.account.deleteMany({ where: { userId: user.id } }),
      // 위시리스트, 주소, 리뷰는 정책에 따라 유지 또는 삭제 — 여기서는 삭제
      prisma.wishlist.deleteMany({ where: { userId: user.id } }),
      prisma.address.deleteMany({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: e.issues[0]?.message || "유효성 오류" }, { status: 400 });
    return NextResponse.json({ error: e.message || "탈퇴 처리 실패" }, { status: 400 });
  }
}

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { IdentityProvider, StartResult } from "./types";
import { defaultExpiresAt, generateReqSeq, isMockIdentityAllowed } from "./util";

/**
 * Mock 본인확인 provider
 *
 * 운영용 본인확인기관 계약 전 / 개발 환경 / 자동화 테스트용.
 * 실제 PASS 팝업 대신 사이트 내 폼(`/identity/mock?reqSeq=...`)에서
 * 이름/생년월일/휴대폰을 입력하면 그 값으로 즉시 인증 완료 처리.
 *
 * - CI: sha256(name + birth + phone) — 동일 입력 → 동일 CI 보장
 * - DI: sha256(name + birth + phone + SITE_DI_SALT)
 *
 * 운영에선 절대 사용 금지 — process.env.NODE_ENV === 'production' 일 때
 *   IDENTITY_PROVIDER 가 'mock' 이면 부팅 시 경고를 logger로 출력.
 */

const SITE_DI_SALT = process.env.IDENTITY_DI_SALT || "fishing-mall-mock-di-salt";

export const mockProvider: IdentityProvider = {
  name: "mock",

  async start({ purpose, ip, userAgent }) {
    const reqSeq = generateReqSeq();
    const record = await prisma.identityVerification.create({
      data: {
        reqSeq,
        provider: "mock",
        purpose,
        status: "PENDING",
        expiresAt: defaultExpiresAt(),
        ip,
        userAgent: userAgent?.slice(0, 500) || null,
      },
    });

    // 클라이언트는 form-mock 모드에서 /identity/mock?reqSeq=... 페이지로 이동
    return {
      verificationId: record.id,
      reqSeq,
      mode: "form-mock",
      url: `/identity/mock?reqSeq=${reqSeq}`,
    } satisfies StartResult;
  },

  async handleReturn({ method, query, body }) {
    if (!isMockIdentityAllowed()) {
      return { ok: false, error: "mock 본인인증은 운영 환경에서 비활성화되어 있습니다." };
    }
    // mock 은 GET/POST 동일하게 처리
    const data = method === "POST" ? (body || {}) : query;
    const reqSeq = data.reqSeq || data.req_seq;
    const name = (data.name || "").trim();
    const birthDate = (data.birthDate || data.birth || "").replace(/\D/g, "");
    const phone = (data.phone || "").replace(/\D/g, "");
    const gender = data.gender === "F" ? "F" : data.gender === "M" ? "M" : null;

    if (!reqSeq) return { ok: false, error: "reqSeq 누락" };
    if (!name || !birthDate || !phone) {
      return { ok: false, error: "이름/생년월일/휴대폰을 모두 입력해주세요." };
    }
    if (birthDate.length !== 8) {
      return { ok: false, error: "생년월일은 YYYYMMDD 8자리로 입력해주세요." };
    }
    if (phone.length < 10 || phone.length > 11) {
      return { ok: false, error: "휴대폰 번호 형식이 올바르지 않습니다." };
    }

    const record = await prisma.identityVerification.findUnique({ where: { reqSeq } });
    if (!record) return { ok: false, error: "유효하지 않은 reqSeq 입니다." };
    if (record.status !== "PENDING") {
      return { ok: false, error: `이미 처리된 인증입니다 (${record.status}).` };
    }
    if (record.expiresAt < new Date()) {
      await prisma.identityVerification.update({
        where: { id: record.id },
        data: { status: "EXPIRED", failReason: "expired" },
      });
      return { ok: false, error: "인증 시간이 만료되었습니다." };
    }

    // CI/DI 결정론적 생성
    const baseInput = `${name}|${birthDate}|${phone}`;
    const ci = "M" + crypto.createHash("sha256").update(baseInput).digest("base64").slice(0, 87);
    const di = crypto.createHash("sha256").update(baseInput + "|" + SITE_DI_SALT).digest("base64").slice(0, 64);

    const updated = await prisma.identityVerification.update({
      where: { id: record.id },
      data: {
        status: "COMPLETED",
        ci, di, name, birthDate, phone, gender,
        nationality: "L",
        ageGroup: birthDate ? String(Math.floor((new Date().getFullYear() - parseInt(birthDate.slice(0, 4))) / 10)) : null,
      },
    });

    return { ok: true, verificationId: updated.id };
  },
};

import { describe, it, expect } from "vitest";
import { isInicisUrl, isTrustedHttpsUrl } from "@/lib/payments/url-guard";

describe("isTrustedHttpsUrl", () => {
  it("허용 도메인의 https URL 만 통과", () => {
    expect(isInicisUrl("https://stdpay.inicis.com/api/approve")).toBe(true);
    expect(isInicisUrl("https://inicis.com/x")).toBe(true);
  });

  it("http, 다른 도메인, 유사 도메인, 잘못된 값은 거부", () => {
    expect(isInicisUrl("http://stdpay.inicis.com/api/approve")).toBe(false);
    expect(isInicisUrl("https://evil.com/inicis.com")).toBe(false);
    expect(isInicisUrl("https://inicis.com.evil.com/")).toBe(false);
    expect(isInicisUrl("https://notinicis.com/")).toBe(false);
    expect(isInicisUrl("https://user@inicis.com@evil.com/")).toBe(false);
    expect(isInicisUrl("not a url")).toBe(false);
    expect(isInicisUrl("")).toBe(false);
    expect(isInicisUrl(null)).toBe(false);
  });

  it("도메인 목록은 대소문자 무시", () => {
    expect(isTrustedHttpsUrl("https://API.Example.COM/", ["example.com"])).toBe(true);
  });
});

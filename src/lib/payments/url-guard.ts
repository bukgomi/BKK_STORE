/**
 * PG 콜백이 넘겨주는 URL(승인/망취소 등)을 fetch 하기 전에 신뢰 도메인인지 검증.
 * 폼 파라미터로 전달되는 값이므로 그대로 fetch 하면 SSRF 가 된다.
 */
export function isTrustedHttpsUrl(raw: string | null | undefined, allowedDomains: string[]): boolean {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function isInicisUrl(raw: string | null | undefined): boolean {
  return isTrustedHttpsUrl(raw, ["inicis.com"]);
}

/**
 * 상품 상세설명 HTML 처리
 * - 관리자 편집기(직접 작성 / HTML 작성)가 저장한 HTML 을 화면에 그리기 전에 허용 태그만 남긴다
 * - 예전 데이터(줄바꿈 있는 순수 텍스트)는 문단으로 변환
 * - SEO 메타/JSON-LD 용 텍스트 추출
 */
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "del", "mark", "sub", "sup", "span",
  "ul", "ol", "li", "blockquote", "pre", "code", "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "div", "section",
  "iframe", // 유튜브 등 동영상 임베드 (아래 host 화이트리스트)
];

const VIDEO_HOSTS = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "tv.naver.com"];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    "*": ["style", "class"],
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "width", "height", "loading"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowProtocolRelative: false,
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
      "font-size": [/^\d+(\.\d+)?(px|em|rem|%)$/],
      "font-weight": [/^(bold|normal|[1-9]00)$/],
      width: [/^\d+(\.\d+)?(px|%)$/],
      "max-width": [/^\d+(\.\d+)?(px|%)$/],
      margin: [/^[\d\s.pxem%auto-]+$/],
      "margin-left": [/^[\d.]+(px|em|%)$|^auto$/],
      "margin-right": [/^[\d.]+(px|em|%)$|^auto$/],
      "text-decoration": [/^(underline|line-through|none)$/],
    },
  },
  allowedIframeHostnames: VIDEO_HOSTS,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer", target: attribs.target === "_blank" ? "_blank" : "_self" },
    }),
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
};

const HTML_TAG = /<\s*[a-z][\s\S]*?>/i;

export function isHtmlDescription(s: string | null | undefined): boolean {
  return !!s && HTML_TAG.test(s);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 순수 텍스트(줄바꿈) → <p> 문단 HTML */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** 저장된 description → 화면에 그릴 안전한 HTML */
export function descriptionToHtml(description: string | null | undefined): string {
  if (!description || !description.trim()) return "";
  const html = isHtmlDescription(description) ? description : textToHtml(description);
  return sanitizeHtml(html, OPTIONS);
}

/** 저장된 description → 메타/JSON-LD 용 텍스트 */
export function descriptionToText(description: string | null | undefined, max = 160): string {
  if (!description) return "";
  const text = isHtmlDescription(description)
    ? sanitizeHtml(description, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim()
    : description.replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) : text;
}

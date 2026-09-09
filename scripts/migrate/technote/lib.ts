/**
 * 테크노트(Technote PHP) 테크샵 덤프 → 낚시몰 데이터 변환 — 순수 함수 모음
 *
 * 테크노트 "ALL backup" 형식:
 *   - EUC-KR(CP949) 인코딩
 *   - 구문 사이를 `#TNT_QUERY_DELIMITER#` 로 구분
 *   - `create table X (...)` / `insert into X set col='v', col='v'` 형태
 *
 * 테크샵 테이블 (shop1 = data/tntshop1):
 *   a_tn4_shop1_list  상품     (gs_*)
 *   a_tn4_shop1_opt   옵션     (gsj_*; 값 목록은 `|` 구분)
 *   a_tn4_shop1_cnr   분류     (ca_uid 를 2자리씩 끊어 계층: 11 > 1111 > 111111)
 *   a_tn4_shop1_cnr2  상품↔분류 매핑 (idx_pnum → idx_uid)
 */

export type Row = Record<string, string>;

export type TechnoteDump = {
  tables: Record<string, Row[]>;
};

/** EUC-KR 덤프 바이트 → UTF-8 문자열 */
export function decodeDump(buf: Buffer): string {
  let dec: TextDecoder;
  try {
    dec = new TextDecoder("euc-kr");
  } catch {
    throw new Error("이 Node 빌드는 euc-kr 디코딩을 지원하지 않습니다. `iconv -f CP949 -t UTF-8` 로 먼저 변환한 뒤 --utf8 옵션으로 실행하세요.");
  }
  return dec.decode(buf);
}

/** SQL 문자열 리터럴의 백슬래시 이스케이프 해제 */
export function unescapeSql(v: string): string {
  return v.replace(/\\(.)/g, (_, c: string) => {
    if (c === "n") return "\n";
    if (c === "r") return "\r";
    if (c === "t") return "\t";
    if (c === "0") return "\0";
    return c; // \' \" \\ 등
  });
}

/** 덤프 전체를 테이블별 행 배열로 파싱 */
export function parseDump(sql: string): TechnoteDump {
  const tables: Record<string, Row[]> = {};
  for (const chunk of sql.split("#TNT_QUERY_DELIMITER#")) {
    const m = /insert into (\w+) set\s*([\s\S]*)/i.exec(chunk);
    if (!m) continue;
    const row: Row = {};
    const re = /(\w+)='((?:[^'\\]|\\.)*)'/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(m[2])) !== null) row[mm[1]] = unescapeSql(mm[2]);
    (tables[m[1]] ||= []).push(row);
  }
  return { tables };
}

/** 이미지 저장 버킷: 상품번호 1~99 → 1, 100~199 → 2, ... */
export function bucketOf(productNo: number): number {
  return Math.floor(productNo / 100) + 1;
}

/** ca_uid 의 상위 uid (2자리씩 계층). "1111" → "11", "11" → null */
export function parentUid(uid: string): string | null {
  return uid.length > 2 ? uid.slice(0, -2) : null;
}

/** `|` 구분 목록 분리 (끝의 빈 항목 제거) */
export function splitPipe(v: string | undefined): string[] {
  const parts = (v ?? "").split("|");
  while (parts.length && parts[parts.length - 1].trim() === "") parts.pop();
  return parts.map((s) => s.trim());
}

/** 쉼표 구분 목록 (테크노트는 ",19,21," 처럼 양끝에 쉼표를 붙임) */
export function splitComma(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** 옵션 제목 → 우리 optionType */
export function optionTypeOf(title: string): string {
  const t = title.replace(/\s/g, "");
  if (/색상|컬러|색/.test(t)) return "color";
  if (/사이즈|크기|호수/.test(t)) return "size";
  if (/무게|oz|g\b/i.test(t)) return "weight";
  return "option";
}

/** HTML → 보이는 텍스트 (상품 상세는 이미지 나열이 대부분이라 텍스트만 남김) */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}

/** HTML 안의 <img src> 목록 (순서 유지, 중복 제거) */
export function extractImgSrcs(html: string): string[] {
  const out: string[] = [];
  const re = /<img[^>]+src=["']?([^"'\s>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** HTML 안의 유튜브 임베드 URL */
export function extractYoutubeUrls(html: string): string[] {
  const out: string[] = [];
  const re = /(?:src|href)=["']?(https?:\/\/(?:www\.)?youtu(?:be\.com|\.be)\/[^"'\s>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/**
 * 이미지 참조 → tntshop1 폴더 기준 상대경로 후보.
 *  "./data/tntshop1/img_body/1/x.jpg"                 → "img_body/1/x.jpg"
 *  "http://topcasting.co.kr/data/tntshop1/img_big/…"  → "img_big/…"
 *  "1_gs_img_dae.jpg" (파일명만, 버킷 지정)             → "img_big/1/1_gs_img_dae.jpg"
 */
export function normalizeImageRef(ref: string, opts?: { folder?: string; bucket?: number }): string | null {
  const r = ref.trim();
  if (!r) return null;
  const m = /data\/tntshop\d*\/(.+)$/.exec(r);
  if (m) return m[1].replace(/^\/+/, "");
  // 에디터 임시폴더(data/temp/...) 등 tntshop 밖의 data/ 경로: import 단계에서 파일명으로 검색할 수 있게 "data/..." 로 유지
  const d = /(?:^|\/)data\/(.+)$/.exec(r);
  if (d) return `data/${d[1]}`;
  if (/^https?:\/\//i.test(r) || r.startsWith("/") || r.startsWith(".")) return null; // 외부/알 수 없는 경로
  if (opts?.folder && opts.bucket) return `${opts.folder}/${opts.bucket}/${r}`;
  return r;
}

/** 스킨/UI 장식 이미지 (확대 버튼 등) — 상품 이미지가 아니므로 무시 */
export function isSkinImage(ref: string): boolean {
  return /(^|\/)img\/(board|character|shop|skin)\//i.test(ref) || /\/button\//i.test(ref);
}

/** 상품 파일명 자체가 상품번호를 포함하지 않는 경우 대비: 버킷 폴더가 틀렸을 때 파일명만으로 찾을 수 있게 basename 도 함께 반환 */
export function basenameOf(p: string): string {
  return p.split("/").pop() || p;
}

/** 대분류/중분류 한글명 → 영문 slug. 없으면 `c{uid}` */
const SLUG_TABLE: Record<string, string> = {
  "하드베이트": "hard-bait", "플로팅미노우": "floating-minnow", "서스펜드미노우": "suspend-minnow",
  "바이브": "vibe", "싱킹": "sinking", "메탈지그": "metal-jig", "크랭크": "crank", "타이라바": "tairaba",
  "에기": "egi", "개구리": "frog", "기타미노우": "other-minnow",
  "소프트베이트": "soft-bait", "새드": "shad", "테일": "tail", "호그": "hog", "글럽": "grub",
  "더블링거": "double-ringer", "기타웜": "other-worm",
  "지그헤드&스푼": "jig-spoon", "메탈지그&스푼": "jig-spoon", "스푼": "spoon", "지그헤드": "jig-head",
  "스커트베이트": "skirt-bait", "스피너베이트": "spinnerbait", "버즈베이트": "buzzbait", "골드스피너": "gold-spinner",
  "각종장비": "gear", "낚시대": "rod", "라인(줄)": "line", "기타장비": "other-gear",
  "각종채비": "rig", "바늘": "hook", "싱커": "sinker", "악세사리": "accessory", "기타채비": "other-rig",
};

export function slugFor(name: string, uid: string, taken: Set<string>): string {
  let base = SLUG_TABLE[name.trim()] || `c${uid}`;
  let slug = base;
  let i = 2;
  while (taken.has(slug)) slug = `${base}-${i++}`;
  taken.add(slug);
  return slug;
}

/** 브랜드 표기 통일 (탑케스팅/탑캐스팅/TPIAA 혼용) */
export function normalizeBrand(v: string | undefined): string | null {
  const t = (v || "").trim();
  if (!t) return null;
  if (/탑[케캐]스팅|TPIAA/i.test(t)) return "탑캐스팅(TPIAA)";
  return t;
}

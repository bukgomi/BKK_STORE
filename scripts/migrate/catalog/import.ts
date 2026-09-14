/**
 * 2023 카탈로그 정리 엑셀(카탈로그_제품옵션_정리.xlsx) → 상품/옵션/이미지 DB 반영
 *
 *   npx tsx scripts/migrate/catalog/import.ts <카탈로그.xlsx> [--pages <p0xx.jpg 폴더>] [--thumbs <대표이미지 폴더>] [--reset] [--dry-run]
 *   (Docker) docker compose exec app npx tsx scripts/migrate/catalog/import.ts scripts/migrate/out/catalog.xlsx \
 *              --pages scripts/migrate/out/catalog-pages --thumbs scripts/migrate/out/images --reset
 *
 * - 시트 "제품별 옵션": 상품 1행 (No/분류/제품명/페이지/옵션 구분/무게 옵션/길이 옵션/색상 옵션/가격/비고)
 * - 시트 "옵션 전개": 실제 판매 조합 1행 (제품명/무게-길이/색상) → 그대로 ProductVariant 로 사용 (조합을 새로 만들지 않음)
 * - sku = TC-<No 3자리>. 재실행 시 sku 기준 upsert
 * - 가격: "4,000원" 은 그대로, 무게별/사이즈별 가격은 PRICE_TABLE (카탈로그 페이지 표에서 옮겨 적음) → 최저가를 판매가, 차액을 옵션 추가금으로
 * - 이미지: 카탈로그 페이지(p0xx.jpg)를 상세 이미지로, 대표 썸네일은 스마트스토어 원본(TPIAA-xx.png)이 있으면 그것, 없으면 첫 카탈로그 페이지
 * - --reset: 기존 상품/옵션 전부 삭제 후 진행 (주문 이력이 있으면 중단)
 */
import { config } from "dotenv";
config();

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { getStorage } from "../../../src/lib/storage";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const file = process.argv[2];
if (!file || file.startsWith("--")) {
  console.error("사용법: tsx scripts/migrate/catalog/import.ts <카탈로그.xlsx> [--pages 폴더] [--thumbs 폴더] [--reset] [--dry-run]");
  process.exit(1);
}
const DRY = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");
const pagesDir = arg("--pages");
const thumbsDir = arg("--thumbs");
const DEFAULT_STOCK = Number(arg("--stock", "999"));

const prisma = new PrismaClient();
const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const won = (s: string) => Number(s.replace(/[^0-9]/g, ""));

/* ───────────── 분류 → 카테고리 slug ───────────── */
function categorySlug(cat: string, name: string, note: string): string {
  const n = name, m = note;
  switch (cat) {
    case "스푼": return "spoon";
    case "지그헤드": return "jig-head";
    case "타이라바": return "tairaba";
    case "메탈지그": return "metal-jig";
    case "프로그": return "frog";
    case "스피너": return "gold-spinner";
    case "채터베이트": case "버즈베이트": return "buzzbait";
    case "스피너베이트": return "spinnerbait";
    case "러버지그": return "rubber-jig";
    case "에기": return "egi";
    case "소품": return "accessory";
    case "채비": return "other-rig";
    case "훅": return "hook";
    case "하드베이트":
      if (/바이브/.test(m)) return "vibe";
      if (/크랭크/.test(m)) return "crank";
      if (/서스펜드/.test(m)) return "suspend-minnow";
      if (/플로팅/.test(m)) return "floating-minnow";
      if (/싱킹|씽킹/.test(m)) return "sinking";
      return "other-minnow";
    case "웜":
      if (/글럽/.test(n)) return "grub";
      if (/호그/.test(n)) return "hog";
      if (/더블링거/.test(n)) return "double-ringer";
      if (/테일/.test(n)) return "tail";
      if (/새드|MINNOW/i.test(n)) return "shad";
      return "other-worm";
  }
  return "uncategorized";
}
/** 없으면 만들어 줄 카테고리 (부모 slug, 이름) */
const EXTRA_CATEGORIES: Array<{ slug: string; name: string; parent: string }> = [
  { slug: "rubber-jig", name: "러버지그", parent: "skirt-bait" },
];

/* ───────────── 가격 ─────────────
 * 카탈로그 페이지 표 기준. 키 = 무게/길이 값, 값 = 원. 표에 없으면 "기본" */
type PriceTable = Record<string, number>;
const PRICE_TABLE: Record<string, PriceTable> = {
  "TPIAA 털스푼 은색": { "5g": 5000, "7g": 5000, "9g": 5000, "11g": 5000, "13g": 5000, "15g": 5000, "17g": 5000, "21g": 5000, "25g": 6000, "30g": 6000 },
  "TPIAA 털스푼 금색": { "5g": 5000, "7g": 5000, "9g": 5000, "11g": 5000, "13g": 5000, "15g": 5000, "17g": 5000, "21g": 5000, "25g": 6000, "30g": 6000 },
  "사파이어 유동식 타이라바": { "50g": 7000, "60g": 8000, "70g": 8000, "80g": 9000, "90g": 9000, "100g": 10000, "110g": 10000, "120g": 11000 },      // p.14
  "칼립소 유동식 타이라바 헤드": { "50g": 5000, "60g": 6000, "80g": 7000, "100g": 8000, "120g": 9000, "150g": 10000, "180g": 11000 },              // p.15
  "TOP LT 메탈": { "17g": 5000, "21g": 5000, "25g": 5000, "30g": 6000, "40g": 6000, "60g": 7000, "80g": 8000, "100g": 9000, "120g": 10000 },        // p.16
  "TCLL55A 메탈": { "28g": 10000, "40g": 11000, "60g": 12000, "80g": 13000, "100g": 14000 },                                                        // p.18
  "TCLL55B 메탈": { "28g": 9000, "40g": 10000, "60g": 11000, "80g": 12000, "100g": 13000 },                                                         // p.20
  "칼립소 멀티 갈치메탈": { "80g": 7000, "100g": 8000, "120g": 9000 },                                                                              // p.25
  "레드 트레블훅": { "6#": 5000, "4#": 5000, "2#": 6000, "1#": 6000 },
  "스키아 태클박스": { "M": 360, "L": 400 },
};
/** 엑셀 가격이 비어 있는 상품 — 스마트스토어 판매가로 대체 (2026-09 기준). 카탈로그에 가격 없음 */
const PRICE_FALLBACK: Record<string, number> = {
  "편탁지그헤드": 8700, "대포 바다지그헤드": 8700, "측광 바다지그헤드(대어)": 8700,
  "멀티-L 3WAY 갈치지그헤드": 3900, "멀티-S 3WAY 갈치지그헤드": 3900,
  "대구 전용 메탈": 12000, "슬로우지그": 9000, "울트라 R38 C테일": 6000,
};
/** 소포장/박스 2중 가격 (박스는 3/0~5/0만) */
const BOX_PRICED = new Set(["와이드갭 훅", "스트레이트 훅", "옵셋 훅"]);
const BOX_SIZES = new Set(["3/0", "4/0", "5/0"]);
const BOX_EXTRA = 10000 - 2000;

function parseBasePrice(name: string, raw: string): { base: number; note?: string } {
  if (PRICE_TABLE[name]) return { base: Math.min(...Object.values(PRICE_TABLE[name])) };
  if (BOX_PRICED.has(name)) return { base: 2000 };
  const s = norm(raw);
  if (!s) {
    if (PRICE_FALLBACK[name] != null) return { base: PRICE_FALLBACK[name], note: "카탈로그에 가격 없음 → 스마트스토어 판매가 적용" };
    return { base: 0, note: "가격 미정" };
  }
  const m = s.match(/([\d,]+)\s*원/);
  if (m) return { base: won(m[1]) };
  return { base: 0, note: `가격 해석 실패: ${s}` };
}

/* ───────────── 스마트스토어 원본 썸네일 이름 매칭 ───────────── */
const THUMB_ALIAS: Record<string, string> = {
  "TPIAA 스푼 은색": "TPIAA 일반스푼 은색", "TPIAA 스푼 금색": "TPIAA 일반스푼 금색",
  "측광 바다지그헤드(대어)": "TPIAA 측광 바다지그헤드", "스텐다드지그헤드-야광": "TPIAA 스탠다드 지그헤드 (측광)",
  "플레이더지그헤드-야광": "TPIAA 플레이더 지그헤드 (측광)", "TOP TEN 텐야 갈치지그헤드": "TPIAA 텐야 갈치 지그헤드",
  "멀티-L 3WAY 갈치지그헤드": "TPIAA 멀티 L 4WAY 지그", "멀티-S 3WAY 갈치지그헤드": "TPIAA 멀티 S 4WAY 지그",
  "채터베이트": "TPIAA 채터베이트 3/8oz", "오로라 C 글럽 2인치": "TPIAA 오로라 C 2인치", "오로라 C 글럽 4인치": "TPIAA 오로라 C 4인치",
  "울트라 R93 새드 2인치": "TPIAA 울트라 새드 R93 2인치", "울트라 R93 새드 3인치": "TPIAA 울트라 새드 R93 3인치",
  "울트라 R93 새드 4인치": "TPIAA 울트라 새드 R93 4인치", "울트라 R93 새드 5인치": "TPIAA 울트라 새드 R93 5인치",
  "울트라 R93 새드 6인치": "TPIAA 울트라 새드 R93 6인치", "TIP RUN 문어 3훅 3.5": "TPIAA 팁런 문어 3훅 3.5",
};
const nameKey = (s: string) => s.toLowerCase().replace(/tpiaa/g, "").replace(/[\s\-_()]/g, "").replace(/애기/g, "에기");

/** TPIAA 원본이 없는 상품 → 스마트스토어에 등록돼 있던 사진(NS-<상품번호>) 으로 대체. public/uploads/products/smartstore 에 남아 있는 파일 사용 */
const NAVER_THUMB: Record<string, string> = {
  "사파이어 TCS156": "3242737693", "뉴사파이어 2.5 애기": "3253883200",
  "오로라 C 글럽 1인치": "7636547605", "오로라 C 글럽 1.5인치": "3130929353", "오로라 C 글럽 3인치 원톤": "3130980880",
  "T-LINE LT 5인치": "3131046673", "T-LINE TD 5인치": "3131059621", "울트라 R38 C테일": "3131203657",
  "칼라 R52": "3130908465", "칼라 R24 호그": "3130850128", "칼라 R45 호그": "3130870189", "칼라 R48 호그": "3130887285",
  "칼라 R51 호그": "3130897633", "칼라 R03": "3131224866", "칼라 R17": "3242211661",
};
const NAVER_UPLOAD_DIR = "public/uploads/products/smartstore";

type ProductRow = Record<string, any>;
type OptionRow = Record<string, any>;
type VariantIn = { name: string; optionType: string; priceModifier: number; stock: number };

/** 옵션 구분 + 실제 값 → 첫 번째 그룹 제목 (무게 / 인치 / 길이 / 사이즈) */
function optionTitle(kind: string, values: string[]): string {
  if (/^무게/.test(kind)) return "무게";
  if (/^길이/.test(kind)) return values.length && values.every((v) => /인치|호$/.test(v)) ? "인치" : "길이";
  if (/^사이즈/.test(kind)) return "사이즈";
  return "옵션";
}
function optionTypeOfTitle(t: string): string {
  return t === "무게" ? "weight" : t === "인치" || t === "길이" || t === "사이즈" ? "size" : "option";
}

function buildVariants(p: ProductRow, opts: OptionRow[], base: number): { variants: VariantIn[]; groups: string[]; fixed: string[] } {
  const name = norm(p["제품명"]);
  const table = PRICE_TABLE[name];
  const stock = /입고예정/.test(norm(p["비고"])) ? 0 : DEFAULT_STOCK;
  const rows = opts.map((r) => ({ a: norm(r["무게/길이"]), c: norm(r["색상"]) }));
  const aVals = [...new Set(rows.map((r) => r.a).filter(Boolean))];
  const cVals = [...new Set(rows.map((r) => r.c).filter(Boolean))];
  const t1 = optionTitle(norm(p["옵션 구분"]), aVals);
  const priceOf = (a: string) => (table && table[a] != null ? table[a] - base : 0);
  const fixed: string[] = [];

  // 소포장/박스 2중 가격 훅
  if (BOX_PRICED.has(name)) {
    const variants: VariantIn[] = [];
    for (const a of aVals) {
      variants.push({ name: `${a} / 소포장`, optionType: "combo:사이즈|포장", priceModifier: 0, stock });
      if (BOX_SIZES.has(a)) variants.push({ name: `${a} / 박스`, optionType: "combo:사이즈|포장", priceModifier: BOX_EXTRA, stock });
    }
    return { variants, groups: ["사이즈", "포장"], fixed };
  }

  // 사용자 지정 구조: 무게-색상 / 인치-색상. 값이 하나뿐인 그룹도 유지 (상품 페이지가 자동 선택)
  const useA = aVals.length >= 1;
  const useC = cVals.length >= 1;
  if (aVals.length === 1) fixed.push(`${t1} ${aVals[0]}`);
  if (cVals.length === 1) fixed.push(`색상 ${cVals[0]}`);
  if (rows.length <= 1) return { groups: [], fixed, variants: [] };

  if (useA && useC) {
    const type = `combo:${t1}|색상`;
    return { groups: [t1, "색상"], fixed, variants: rows.map((r) => ({ name: `${r.a} / ${r.c}`, optionType: type, priceModifier: priceOf(r.a), stock })) };
  }
  if (useA) {
    const seen = new Set<string>();
    const variants = rows.filter((r) => !seen.has(r.a) && seen.add(r.a)).map((r) => ({ name: r.a, optionType: optionTypeOfTitle(t1), priceModifier: priceOf(r.a), stock }));
    return { groups: [t1], fixed, variants };
  }
  if (useC) {
    const seen = new Set<string>();
    const variants = rows.filter((r) => r.c && !seen.has(r.c) && seen.add(r.c)).map((r) => ({ name: r.c, optionType: "color", priceModifier: 0, stock }));
    return { groups: ["색상"], fixed, variants };
  }
  return { groups: [], fixed, variants: [] };
}

function pageList(raw: unknown): number[] {
  return String(raw ?? "").split(/[,\s]+/).map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0);
}

async function main() {
  const wb = XLSX.readFile(file);
  const products = XLSX.utils.sheet_to_json<ProductRow>(wb.Sheets["제품별 옵션"], { defval: "" }).filter((r) => norm(r["제품명"]));
  const options = XLSX.utils.sheet_to_json<OptionRow>(wb.Sheets["옵션 전개"], { defval: "" });
  const optsByName = new Map<string, OptionRow[]>();
  for (const o of options) { const k = norm(o["제품명"]); (optsByName.get(k) || optsByName.set(k, []).get(k)!).push(o); }
  console.log(`카탈로그 상품 ${products.length}개 · 옵션 행 ${options.length}${DRY ? " — DRY RUN" : ""}`);

  // 썸네일 원본 인덱스 (스마트스토어 일괄등록 xlsx 의 상품명 → 파일명)
  const thumbByKey = new Map<string, string>();
  if (thumbsDir) {
    const optXlsx = "scripts/migrate/out/options.xlsx";
    if (existsSync(optXlsx)) {
      const rows = XLSX.utils.sheet_to_json<any[]>(XLSX.readFile(optXlsx).Sheets["일괄등록"], { header: 1, defval: "" }).slice(2);
      for (const r of rows) if (r[2] && r[22]) thumbByKey.set(nameKey(String(r[2])), String(r[22]).trim());
    }
  }

  // 0) 리셋
  if (RESET && !DRY) {
    const orders = await prisma.orderItem.count();
    if (orders > 0) throw new Error(`주문 항목 ${orders}건이 있어 상품을 삭제할 수 없습니다`);
    const [w, rv, q, sn] = await Promise.all([prisma.wishlist.deleteMany(), prisma.review.deleteMany(), prisma.productQuestion.deleteMany(), prisma.stockNotification.deleteMany()]);
    const v = await prisma.productVariant.deleteMany();
    const pr = await prisma.product.deleteMany();
    console.log(`✔ 리셋: 상품 ${pr.count} · 옵션 ${v.count} · 찜 ${w.count} · 리뷰 ${rv.count} · 문의 ${q.count} · 재입고알림 ${sn.count} 삭제`);
  }

  // 1) 카테고리
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catId = new Map(cats.map((c) => [c.slug, c.id]));
  for (const ex of EXTRA_CATEGORIES) {
    if (catId.has(ex.slug)) continue;
    if (DRY) { console.log(`  (dry) 카테고리 생성 예정: ${ex.slug} (${ex.name})`); continue; }
    const parentId = catId.get(ex.parent) ?? null;
    const siblings = await prisma.category.count({ where: { parentId } });
    const row = await prisma.category.create({ data: { slug: ex.slug, name: ex.name, parentId, sortOrder: siblings } });
    catId.set(ex.slug, row.id);
    console.log(`✔ 카테고리 생성: ${ex.slug}`);
  }

  const storage = pagesDir || thumbsDir ? getStorage() : null;
  const uploadedPages = new Map<number, string>();
  const uploadPage = async (n: number): Promise<string | null> => {
    if (!pagesDir) return null;
    if (uploadedPages.has(n)) return uploadedPages.get(n)!;
    const f = path.join(pagesDir, `p${String(n).padStart(3, "0")}.jpg`);
    if (!existsSync(f)) return null;
    if (DRY) { uploadedPages.set(n, `(dry)${f}`); return uploadedPages.get(n)!; }
    const up = await storage!.upload({ buffer: readFileSync(f), filename: `p${String(n).padStart(3, "0")}.jpg`, contentType: "image/jpeg", prefix: "products/catalog" });
    uploadedPages.set(n, up.url);
    return up.url;
  };

  let created = 0, updated = 0, variantCount = 0, thumbOrig = 0, thumbNaver = 0, noPrice: string[] = [], missing: string[] = [];
  const byCat = new Map<string, number>();

  for (const p of products) {
    const name = norm(p["제품명"]);
    const no = Number(p["No"]);
    const sku = `TC-${String(no).padStart(3, "0")}`;
    const note = norm(p["비고"]);
    const slug = categorySlug(norm(p["분류"]), name, note);
    const cid = catId.get(slug) ?? catId.get("uncategorized");
    if (!cid) { missing.push(`${name}: 카테고리 ${slug} 없음`); continue; }
    byCat.set(slug, (byCat.get(slug) || 0) + 1);

    const { base, note: priceNote } = parseBasePrice(name, String(p["가격"]));
    if (base === 0) noPrice.push(name);
    const opts = optsByName.get(name) || [];
    const { variants, groups, fixed } = buildVariants(p, opts, base);

    const pages = pageList(p["페이지"]);
    const specLines = [
      fixed.length ? fixed.join(" · ") : "",
      note && !/^NEW$/.test(note) ? note : "",
      priceNote || "",
    ].filter(Boolean);
    const isNew = /NEW/.test(note);
    const pending = /입고예정/.test(note);

    // 상세페이지 = 스펙 한 줄 + 카탈로그 페이지 이미지 (썸네일/갤러리에는 쓰지 않는다)
    const pageUrls: string[] = [];
    for (const n of pages) { const u = await uploadPage(n); if (u) pageUrls.push(u); }
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const description = [
      specLines.length ? `<p>${specLines.map(esc).join("<br>")}</p>` : "",
      ...pageUrls.map((u, i) => `<img src="${u}" alt="${esc(name)} 카탈로그 ${pages[i]}쪽">`),
    ].filter(Boolean).join("\n");

    // 대표 이미지: 스마트스토어 원본(TPIAA-xx) → 스마트스토어 등록 사진(NS-xxx) → 없음(플레이스홀더)
    let thumbnail: string | null = null;
    let thumbSrc = "";
    const alias = THUMB_ALIAS[name];
    const tf = thumbByKey.get(nameKey(alias || name));
    if (thumbsDir && tf && existsSync(path.join(thumbsDir, tf))) {
      if (DRY) thumbnail = `(dry)${tf}`;
      else {
        const up = await storage!.upload({ buffer: readFileSync(path.join(thumbsDir, tf)), filename: `${sku}${path.extname(tf).toLowerCase()}`, contentType: "image/png", prefix: "products/catalog" });
        thumbnail = up.url;
      }
      thumbOrig++; thumbSrc = tf;
    } else {
      const nsId = NAVER_THUMB[name];
      const nsFile = nsId ? ["png", "jpg"].map((e) => path.join(NAVER_UPLOAD_DIR, `NS-${nsId}.${e}`)).find((f) => existsSync(f)) : undefined;
      if (nsFile) {
        const ext = path.extname(nsFile).toLowerCase();
        if (DRY) thumbnail = `(dry)${path.basename(nsFile)}`;
        else {
          const up = await storage!.upload({ buffer: readFileSync(nsFile), filename: `${sku}${ext}`, contentType: ext === ".png" ? "image/png" : "image/jpeg", prefix: "products/catalog" });
          thumbnail = up.url;
        }
        thumbNaver++; thumbSrc = path.basename(nsFile);
      }
    }

    if (DRY) {
      console.log(`  ${sku} | ${slug.padEnd(15)} | ${String(base).padStart(6)}원 | [${groups.join(" × ") || "옵션 없음"}] ${variants.length} | ${thumbnail ? "썸네일:" + thumbSrc : "썸네일 없음"} | 상세 p.${pages.join(",")} | ${name}${pending ? " (입고예정→재고0)" : ""}`);
      if (variants.length) console.log(`      ${variants.slice(0, 5).map((v) => v.name + (v.priceModifier ? `(+${v.priceModifier})` : "")).join(", ")}${variants.length > 5 ? ` … +${variants.length - 5}` : ""}`);
      variantCount += variants.length; created++;
      continue;
    }

    const data = {
      name, brand: "탑캐스팅(TPIAA)", description, price: base, salePrice: null,
      stock: pending ? 0 : DEFAULT_STOCK, thumbnail, images: [] as string[],
      isActive: base > 0, isFeatured: false, categoryId: cid,
    };
    const existing = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
    const row = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data: { sku, ...data } });
    existing ? updated++ : created++;

    // 옵션: 이름 기준 upsert, 없어진 건 비활성
    const cur = await prisma.productVariant.findMany({ where: { productId: row.id } });
    const byName = new Map(cur.map((v) => [v.name, v]));
    const incoming = new Set<string>();
    for (const [i, v] of variants.entries()) {
      incoming.add(v.name);
      const payload = { optionType: v.optionType, priceModifier: v.priceModifier, stock: v.stock, sortOrder: i, isActive: true };
      const ex = byName.get(v.name);
      if (ex) await prisma.productVariant.update({ where: { id: ex.id }, data: payload });
      else await prisma.productVariant.create({ data: { ...payload, name: v.name, productId: row.id } });
      variantCount++;
    }
    const stale = cur.filter((v) => !incoming.has(v.name) && v.isActive);
    if (stale.length) await prisma.productVariant.updateMany({ where: { id: { in: stale.map((v) => v.id) } }, data: { isActive: false } });
    void isNew;
  }

  console.log(`\n✔ 상품 신규 ${created} · 갱신 ${updated} · 옵션 ${variantCount}개 · 썸네일 TPIAA원본 ${thumbOrig} / 스마트스토어사진 ${thumbNaver} / 없음 ${created + updated - thumbOrig - thumbNaver} · 상세 페이지 이미지 ${uploadedPages.size}장`);
  console.log("  분류:", [...byCat].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}(${n})`).join(", "));
  if (noPrice.length) console.warn("  ⚠ 가격 0원(비활성 처리):", noPrice.join(" | "));
  if (missing.length) console.warn("  ⚠ 건너뜀:", missing.join(" | "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

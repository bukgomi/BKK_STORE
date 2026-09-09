/**
 * 1단계: 테크노트 덤프(.sql) → 중간 JSON
 *
 *   npx tsx scripts/migrate/technote/parse.ts <dump.sql> [--out scripts/migrate/out/technote.json] [--shop shop1] [--utf8]
 *
 * DB 접속 없이 동작. 결과 JSON 을 사람이 검토한 뒤 import.ts 로 반영한다.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  decodeDump, parseDump, bucketOf, parentUid, splitPipe, splitComma, optionTypeOf,
  stripHtml, extractImgSrcs, extractYoutubeUrls, normalizeImageRef, isSkinImage, slugFor, normalizeBrand, type Row,
} from "./lib";

export type ExportCategory = { uid: string; slug: string; name: string; parentUid: string | null; sortOrder: number; legacyNo: number };
export type ExportVariant = { name: string; optionType: string; priceModifier: number; inStock: boolean; sortOrder: number };
export type ExportProduct = {
  legacyNo: number;
  sku: string;
  name: string;
  brand: string | null;
  origin: string | null;
  price: number;
  description: string;
  categoryUid: string | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  /** tntshop1 폴더 기준 상대경로 (썸네일 → 추가이미지 → 상세이미지 순) */
  thumbnailRef: string | null;
  imageRefs: string[];
  optionTitle: string | null;
  variants: ExportVariant[];
  youtube: string[];
  warnings: string[];
};
export type ExportFile = {
  source: string;
  generatedAt: string;
  shop: string;
  categories: ExportCategory[];
  products: ExportProduct[];
  /** 구 상품번호 → sku (리다이렉트 맵) */
  redirects: Record<string, string>;
  stats: Record<string, number>;
};

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error("사용법: tsx scripts/migrate/technote/parse.ts <dump.sql> [--out path.json] [--shop shop1] [--utf8]");
    process.exit(1);
  }
  const shop = arg("--shop", "shop1")!;
  const out = arg("--out", "scripts/migrate/out/technote.json")!;
  const raw = readFileSync(file);
  const sql = process.argv.includes("--utf8") ? raw.toString("utf8") : decodeDump(raw);
  const { tables } = parseDump(sql);

  const T = (suffix: string): Row[] => tables[`a_tn4_${shop}_${suffix}`] || [];
  const list = T("list"), opt = T("opt"), cnr = T("cnr"), cnr2 = T("cnr2");
  if (list.length === 0) {
    console.error(`상품 테이블 a_tn4_${shop}_list 가 비어있습니다. 테이블 목록: ${Object.keys(tables).filter((t) => t.includes("shop")).join(", ")}`);
    process.exit(1);
  }

  // ── 분류: 2자리/4자리 uid 만 (6자리 소분류는 상품이 없어 상위로 흡수)
  const taken = new Set<string>();
  const cats = cnr
    .filter((c) => c.ca_uid && c.ca_uid.length <= 4)
    .sort((a, b) => a.ca_uid.localeCompare(b.ca_uid))
    .map<ExportCategory>((c, i) => ({
      uid: c.ca_uid,
      slug: slugFor(c.ca_title || "", c.ca_uid, taken),
      name: (c.ca_title || `분류 ${c.ca_uid}`).trim(),
      parentUid: parentUid(c.ca_uid),
      sortOrder: i,
      legacyNo: Number(c.no),
    }));
  const catByNo = new Map(cnr.map((c) => [c.no, c.ca_uid]));
  const knownUid = new Set(cats.map((c) => c.uid));
  const toKnownUid = (uid: string | undefined): string | null => {
    // 6자리 uid → 4자리 상위로
    let u = uid || "";
    while (u && !knownUid.has(u)) u = parentUid(u) || "";
    return u || null;
  };

  // 상품 → 분류 (cnr2 매핑 우선, 없으면 gs_corner 의 cnr.no 목록). 가장 깊은 분류 선택
  const uidsByProduct = new Map<string, Set<string>>();
  for (const m of cnr2) {
    const u = toKnownUid(m.idx_uid);
    if (u) (uidsByProduct.get(m.idx_pnum) || uidsByProduct.set(m.idx_pnum, new Set()).get(m.idx_pnum)!).add(u);
  }

  // 옵션: 상품당 select 그룹 1개만 사용 (덤프상 모두 1개 이하)
  const optByProduct = new Map<string, Row[]>();
  for (const o of opt) (optByProduct.get(o.gsj_parent) || optByProduct.set(o.gsj_parent, []).get(o.gsj_parent)!).push(o);

  const stats: Record<string, number> = { products: 0, active: 0, hidden: 0, priceZero: 0, withVariants: 0, variants: 0, images: 0, uncategorized: 0, multiSelectGroups: 0 };
  const redirects: Record<string, string> = {};

  const products = list
    .map<ExportProduct>((p) => {
      const no = Number(p.no);
      const bucket = bucketOf(no);
      const warnings: string[] = [];
      const price = Number(p.gs_price || 0);
      const hidden = p.gs_hidden !== undefined && p.gs_hidden !== "" && p.gs_hidden !== "0";
      const sku = `TC-${String(no).padStart(4, "0")}`;

      // 분류
      let uids = uidsByProduct.get(p.no);
      if (!uids || uids.size === 0) {
        uids = new Set(splitComma(p.gs_corner).map((n) => toKnownUid(catByNo.get(n))).filter((u): u is string => !!u));
      }
      const categoryUid = uids.size ? [...uids].sort((a, b) => b.length - a.length)[0] : null;
      if (!categoryUid) { stats.uncategorized++; warnings.push("분류 없음"); }

      // 이미지
      const imageRefs: string[] = [];
      const push = (r: string | null) => { if (r && !imageRefs.includes(r)) imageRefs.push(r); };
      const dae = normalizeImageRef(p.gs_img_dae || "", { folder: "img_big", bucket });
      const jung = normalizeImageRef(p.gs_img_jung || "", { folder: "img_big", bucket });
      const thumbnailRef = dae || jung || normalizeImageRef(p.gs_img_so || "", { folder: "img_tiny", bucket });
      push(thumbnailRef);
      for (const f of splitComma(p.gs_img_add)) push(normalizeImageRef(f, { folder: "img_big", bucket }));
      const body = p.gs_txt_body || "";
      for (const src of extractImgSrcs(body)) {
        if (isSkinImage(src)) continue; // 확대 버튼 등 스킨 장식
        const r = normalizeImageRef(src);
        if (r) push(r); else if (!/youtu/.test(src)) warnings.push(`외부 이미지 유지 불가: ${src.slice(0, 80)}`);
      }
      if (!thumbnailRef) warnings.push("대표 이미지 없음");

      // 설명: 간략설명 + 본문 텍스트
      const att = (p.gs_text_att || "").replace(/=>/g, ": ").trim();
      const bodyText = stripHtml(body);
      const description = [att, bodyText].filter(Boolean).join("\n\n").slice(0, 5000);

      // 옵션
      const groups = (optByProduct.get(p.no) || []).filter((o) => o.gsj_type === "select" || o.gsj_type === "radio");
      if (groups.length > 1) { stats.multiSelectGroups++; warnings.push(`옵션 그룹 ${groups.length}개 중 첫 그룹만 사용`); }
      const g = groups[0];
      const variants: ExportVariant[] = [];
      if (g) {
        const names = splitPipe(g.gsj_opt), prices = splitPipe(g.gsj_price), stocks = splitPipe(g.gsj_stock);
        const type = optionTypeOf(g.gsj_title || "");
        names.forEach((n, i) => {
          if (!n) return;
          variants.push({ name: n, optionType: type, priceModifier: Number(prices[i] || 0), inStock: (stocks[i] ?? "1") !== "0", sortOrder: i });
        });
      }

      const isActive = !hidden && price > 0;
      stats.products++;
      if (isActive) stats.active++;
      if (hidden) stats.hidden++;
      if (price === 0) { stats.priceZero++; warnings.push("가격 0원 → 비활성"); }
      if (variants.length) { stats.withVariants++; stats.variants += variants.length; }
      stats.images += imageRefs.length;
      redirects[String(no)] = sku;

      return {
        legacyNo: no, sku,
        name: (p.gs_name || `상품 ${no}`).trim(),
        brand: normalizeBrand(p.gs_brand || p.gs_cmpny),
        origin: (p.gs_native || "").trim() || null,
        price, description, categoryUid, isActive,
        isFeatured: p.gs_hot_main === "1",
        createdAt: new Date(Number(p.gs_date || 0) * 1000).toISOString(),
        thumbnailRef, imageRefs,
        optionTitle: g?.gsj_title?.trim() || null,
        variants,
        youtube: extractYoutubeUrls(body),
        warnings,
      };
    })
    .sort((a, b) => a.legacyNo - b.legacyNo);

  const exportFile: ExportFile = {
    source: path.basename(file), generatedAt: new Date().toISOString(), shop,
    categories: cats, products, redirects, stats,
  };
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(exportFile, null, 2));

  console.log(`✔ ${out}`);
  console.log(`  분류 ${cats.length}개 (대분류 ${cats.filter((c) => !c.parentUid).length})`);
  console.log(`  상품 ${stats.products}개: 활성 ${stats.active}, 숨김 ${stats.hidden}, 0원 ${stats.priceZero}, 분류없음 ${stats.uncategorized}`);
  console.log(`  옵션 보유 상품 ${stats.withVariants}개 / 옵션값 ${stats.variants}개, 이미지 참조 ${stats.images}개`);
  const warned = products.filter((p) => p.warnings.length);
  if (warned.length) {
    console.log(`  ⚠ 경고 ${warned.length}건 (JSON 의 warnings 참고). 예:`);
    for (const p of warned.slice(0, 8)) console.log(`    - [${p.sku}] ${p.name}: ${p.warnings.join(" / ")}`);
  }
}

main();

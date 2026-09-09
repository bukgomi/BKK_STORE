/**
 * 루어낚시 카테고리 골격 시드 (상품 없음, 재실행 안전 — slug 기준 upsert)
 *
 *   npm run db:seed:categories
 *
 * 테크노트/스마트스토어 이관 엑셀의 '카테고리코드' 와 slug 가 일치한다.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 아이콘은 components/CategoryIcon 이 slug 기준으로 SVG 를 그린다. iconEmoji 는 비워 둠 (관리자 수동 지정용)
const CATEGORY_EMOJI: Record<string, string> = {};

type Cat = { slug: string; name: string; children?: Cat[] };

export const CATEGORY_TREE: Cat[] = [
  { slug: "hard-bait", name: "하드베이트", children: [
    { slug: "floating-minnow", name: "플로팅 미노우" },
    { slug: "suspend-minnow", name: "서스펜드 미노우" },
    { slug: "sinking", name: "싱킹" },
    { slug: "vibe", name: "바이브" },
    { slug: "crank", name: "크랭크" },
    { slug: "metal-jig", name: "메탈지그" },
    { slug: "tairaba", name: "타이라바" },
    { slug: "egi", name: "에기" },
    { slug: "frog", name: "개구리" },
    { slug: "other-minnow", name: "기타 미노우" },
  ]},
  { slug: "soft-bait", name: "소프트베이트", children: [
    { slug: "shad", name: "새드" },
    { slug: "tail", name: "테일" },
    { slug: "hog", name: "호그" },
    { slug: "grub", name: "글럽" },
    { slug: "double-ringer", name: "더블링거" },
    { slug: "other-worm", name: "기타 웜" },
  ]},
  { slug: "jig-spoon", name: "지그헤드 & 스푼", children: [
    { slug: "jig-head", name: "지그헤드" },
    { slug: "spoon", name: "스푼" },
  ]},
  { slug: "skirt-bait", name: "스커트베이트", children: [
    { slug: "spinnerbait", name: "스피너베이트" },
    { slug: "buzzbait", name: "버즈베이트 / 채터베이트" },
    { slug: "gold-spinner", name: "골드스피너" },
  ]},
  { slug: "rig", name: "각종 채비", children: [
    { slug: "hook", name: "바늘" },
    { slug: "sinker", name: "싱커" },
    { slug: "accessory", name: "악세사리" },
    { slug: "other-rig", name: "기타 채비" },
  ]},
  { slug: "gear", name: "각종 장비", children: [
    { slug: "rod", name: "낚시대" },
    { slug: "line", name: "라인" },
    { slug: "other-gear", name: "기타 장비" },
  ]},
  { slug: "uncategorized", name: "미분류" },
];

async function main() {
  let n = 0;
  for (const [i, top] of CATEGORY_TREE.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: top.slug },
      create: { slug: top.slug, name: top.name, sortOrder: i * 10, parentId: null, iconEmoji: CATEGORY_EMOJI[top.slug] ?? null },
      update: { name: top.name, sortOrder: i * 10, iconEmoji: CATEGORY_EMOJI[top.slug] ?? null },
    });
    n++;
    for (const [j, child] of (top.children || []).entries()) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        create: { slug: child.slug, name: child.name, sortOrder: j, parentId: parent.id, iconEmoji: CATEGORY_EMOJI[child.slug] ?? null },
        update: { name: child.name, sortOrder: j, parentId: parent.id, iconEmoji: CATEGORY_EMOJI[child.slug] ?? null },
      });
      n++;
    }
  }
  console.log(`[seed-categories] ${n}개 카테고리 반영 완료`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

/**
 * 카테고리 slug → 대표 이모지 (DB 의 Category.iconEmoji 가 비어 있을 때 사용)
 * - 관리자 → 카테고리에서 iconEmoji 를 넣으면 그 값이 우선
 * - Windows 10 에서도 렌더되도록 Unicode 12 이하 이모지만 사용
 */
export const CATEGORY_EMOJI: Record<string, string> = {
  // 하드베이트
  "hard-bait": "🐟", "floating-minnow": "🐠", "suspend-minnow": "🐟", "sinking": "🌊",
  "vibe": "📳", "crank": "🎯", "metal-jig": "⚙️", "tairaba": "🔴", "egi": "🦑",
  "frog": "🐸", "other-minnow": "🐡",
  // 소프트베이트
  "soft-bait": "🐛", "shad": "🐟", "tail": "🐍", "hog": "🦐", "grub": "🐛",
  "double-ringer": "🧬", "other-worm": "🐛",
  // 지그헤드 & 스푼
  "jig-spoon": "🥄", "jig-head": "⚓", "spoon": "🥄",
  // 스커트베이트
  "skirt-bait": "🎏", "spinnerbait": "🌀", "buzzbait": "🌪️", "gold-spinner": "✨",
  // 채비 / 장비
  "rig": "🧷", "hook": "🎣", "sinker": "⚖️", "accessory": "🧰", "other-rig": "🔗",
  "gear": "🎒", "rod": "🎣", "line": "🧵", "other-gear": "🧰",
  "uncategorized": "📦",
  // 예전 샘플 시드(seed.ts / seed-fresh.ts) 의 slug 호환
  "reel": "🎰", "lure": "🐟", "tackle": "🎒", "wear": "👕", "bag": "🧳", "clothing": "👕",
  "minnow": "🐠", "crankbait": "🎯", "vibration": "📳", "topwater": "🐸",
  "worm": "🐛", "swimbait": "🐟",
};

export const DEFAULT_CATEGORY_EMOJI = "🎣";

/** DB 값 → slug 맵 → 기본값 순으로 결정 */
export function emojiFor(slug: string, override?: string | null): string {
  return (override && override.trim()) || CATEGORY_EMOJI[slug] || DEFAULT_CATEGORY_EMOJI;
}

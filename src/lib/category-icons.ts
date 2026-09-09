/**
 * 카테고리 slug → 라인 아이콘 키 (components/CategoryIcon 이 SVG 로 그림)
 * - 관리자 → 카테고리에서 iconEmoji 를 직접 넣으면 그 값이 우선 (보통 비워 둠)
 */
export type CategoryIconKey =
  | "minnow" | "worm" | "spoon" | "jighead" | "spinner" | "hook"
  | "sinker" | "rod" | "line" | "box" | "squid" | "frog" | "tairaba" | "metaljig" | "gear";

export const CATEGORY_ICON: Record<string, CategoryIconKey> = {
  // 하드베이트
  "hard-bait": "minnow", "floating-minnow": "minnow", "suspend-minnow": "minnow", "sinking": "minnow",
  "vibe": "minnow", "crank": "minnow", "other-minnow": "minnow",
  "metal-jig": "metaljig", "tairaba": "tairaba", "egi": "squid", "frog": "frog",
  // 소프트베이트
  "soft-bait": "worm", "shad": "worm", "tail": "worm", "hog": "worm", "grub": "worm",
  "double-ringer": "worm", "other-worm": "worm",
  // 지그헤드 & 스푼
  "jig-spoon": "spoon", "jig-head": "jighead", "spoon": "spoon",
  // 스커트베이트
  "skirt-bait": "spinner", "spinnerbait": "spinner", "buzzbait": "spinner", "gold-spinner": "spinner",
  // 채비 / 장비
  "rig": "hook", "hook": "hook", "sinker": "sinker", "accessory": "gear", "other-rig": "hook",
  "gear": "rod", "rod": "rod", "line": "line", "other-gear": "gear",
  "uncategorized": "box",
  // 예전 샘플 시드 slug 호환
  "reel": "line", "lure": "minnow", "tackle": "gear", "minnow": "minnow", "crankbait": "minnow",
  "vibration": "minnow", "topwater": "frog", "worm": "worm", "swimbait": "minnow",
};

export function iconKeyFor(slug: string): CategoryIconKey {
  return CATEGORY_ICON[slug] || "box";
}

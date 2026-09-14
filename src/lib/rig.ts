import { z } from "zod";

/** 지역 — 지도 위 배치용 좌표(%) 포함 */
export const REGIONS = [
  { key: "west-north", label: "서해북부", x: 24, y: 27 },
  { key: "west-south", label: "서해남부", x: 19, y: 61 },
  { key: "east-north", label: "동해북부", x: 78, y: 17 },
  { key: "east-south", label: "동해남부", x: 88, y: 52 },
  { key: "south-west", label: "남해서부", x: 36, y: 78 },
  { key: "south-east", label: "남해동부", x: 68, y: 71 },
  { key: "jeju", label: "제주도", x: 22, y: 94 },
  { key: "fresh", label: "민물", x: 54, y: 40 },
] as const;
export type RegionKey = (typeof REGIONS)[number]["key"];

export const FISHING_TYPES = [
  { key: "lure", label: "루어낚시" },
  { key: "eging", label: "에깅" },
  { key: "jigging", label: "지깅 / 타이라바" },
  { key: "boat", label: "선상낚시" },
  { key: "float", label: "찌낚시" },
  { key: "surf", label: "원투낚시" },
  { key: "fresh", label: "민물낚시" },
] as const;
export type FishingTypeKey = (typeof FISHING_TYPES)[number]["key"];

export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export const regionLabel = (k: string) => REGIONS.find((r) => r.key === k)?.label ?? k;
export const typeLabel = (k: string) => FISHING_TYPES.find((t) => t.key === k)?.label ?? k;

export type RigComponent = { name: string; spec: string; productIds: string[] };

export const SLUG_RE = /^[a-z0-9가-힣][a-z0-9가-힣-]{1,79}$/;
export function slugifyRig(species: string, title: string): string {
  const s = `${species}-${title}`.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return SLUG_RE.test(s) ? s : `rig-${Date.now().toString(36)}`;
}

export const rigSchema = z.object({
  title: z.string().min(1).max(80),
  slug: z.string().regex(SLUG_RE, "주소는 영문 소문자·숫자·한글·하이픈만 2~80자"),
  species: z.string().min(1).max(40),
  speciesImage: z.string().max(500).optional().or(z.literal("")),
  fishingType: z.string().min(1).max(30),
  regions: z.array(z.string().max(30)).max(REGIONS.length).default([]),
  months: z.array(z.number().int().min(1).max(12)).max(12).default([]),
  summary: z.string().max(300).optional().or(z.literal("")),
  diagramImage: z.string().max(500).optional().or(z.literal("")),
  content: z.string().max(200_000).default(""),
  components: z.array(z.object({
    name: z.string().min(1).max(40),
    spec: z.string().max(200).default(""),
    productIds: z.array(z.string().min(1).max(64)).max(20).default([]),
  })).max(30).default([]),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isPublished: z.boolean().default(true),
});
export type RigInput = z.infer<typeof rigSchema>;

export function parseComponents(json: unknown): RigComponent[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((c) => c && typeof c === "object" && typeof (c as any).name === "string")
    .map((c: any) => ({ name: String(c.name), spec: String(c.spec ?? ""), productIds: Array.isArray(c.productIds) ? c.productIds.map(String) : [] }));
}

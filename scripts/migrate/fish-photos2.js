// 위키미디어 공용에서 "사진"만 (도판·그림 제외) 모아 배경이 깨끗한 순으로 정렬 → 후보 시트 생성용 메타 저장
const fs = require("fs"), path = require("path");
const UA = "topcasting-rigs/1.0 (bkk.noname.admin@gmail.com)";
const SP = {
  "갑오징어": ["Sepia esculenta", "Sepia officinalis", "cuttlefish"], "쭈꾸미": ["Amphioctopus fangsiao", "Octopus ocellatus", "Amphioctopus"], "문어": ["Octopus vulgaris", "Enteroctopus dofleini", "Octopus sinensis"],
  "광어": ["Paralichthys olivaceus", "olive flounder"], "우럭": ["Sebastes schlegelii", "Sebastes schlegeli", "black rockfish Korea"], "갈치": ["Trichiurus lepturus", "Trichiurus japonicus", "largehead hairtail"],
  "무늬오징어": ["Sepioteuthis lessoniana", "bigfin reef squid"], "한치": ["Uroteuthis edulis", "Loligo vulgaris", "Loligo forbesii", "squid"], "호래기": ["Loliolus", "Loligo vulgaris juvenile", "small squid"],
  "참돔": ["Pagrus major", "red seabream"], "농어": ["Lateolabrax japonicus", "Lateolabrax maculatus", "Japanese seabass"], "삼치": ["Scomberomorus niphonius", "Scomberomorus"],
  "부시리": ["Seriola lalandi", "Seriola quinqueradiata", "yellowtail amberjack"], "대구": ["Gadus macrocephalus", "Pacific cod"], "볼락": ["Sebastes inermis", "Sebastes"],
  "전갱이": ["Trachurus japonicus", "Trachurus"], "배스": ["Micropterus salmoides", "largemouth bass"], "쏘가리": ["Siniperca scherzeri", "Siniperca"],
  "송어": ["Oncorhynchus mykiss", "rainbow trout"], "감성돔": ["Acanthopagrus schlegelii", "black seabream"],
};
const BAD = /sushi|nigiri|dried|sashimi|food|dish|cooked|grilled|fried|meal|skelet|otolith|gladius|hectocotylus|egg|larva|paralarva|map|range|distribution|fossil|logo|stamp|coin|statue|toy|graph|chart|shell|beak|tooth|jaw|scale|illustr|drawing|plate|FMIB|Fishes of|Naturalis|painting|lithograph|engraving|Jordan|Bloch|Voyage|Cephalopoda|embryo|frame specimen|transparent|x-ray|radiograph|boiled|soup|tang|jjim|hoe|\.svg/i;
async function q(term) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=${encodeURIComponent(term)}&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=500`;
  const j = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  return Object.values(j.query?.pages || {}).map((p) => { const ii = p.imageinfo?.[0]; if (!ii) return null; const m = ii.extmetadata || {}; return { title: p.title.replace(/^File:/, ""), thumb: ii.thumburl, desc: ii.descriptionurl, license: m.LicenseShortName?.value || "", artist: (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim(), w: ii.width, h: ii.height, mime: ii.mime }; })
    .filter(Boolean).filter((x) => x.mime === "image/jpeg" && x.w >= 500 && /CC|Public domain|CC0/i.test(x.license) && !/NC|ND/i.test(x.license) && !BAD.test(x.title));
}
(async () => {
  const out = {};
  fs.mkdirSync("scripts/migrate/out/fish2", { recursive: true });
  for (const [ko, terms] of Object.entries(SP)) {
    let c = [];
    for (const t of terms) c.push(...await q(t));
    const seen = new Set(); c = c.filter((x) => !seen.has(x.title) && seen.add(x.title)).slice(0, 14);
    for (let i = 0; i < c.length; i++) {
      try { const buf = Buffer.from(await (await fetch(c[i].thumb, { headers: { "User-Agent": UA } })).arrayBuffer()); fs.writeFileSync(`scripts/migrate/out/fish2/${ko}-${i + 1}.jpg`, buf); c[i].file = `${ko}-${i + 1}.jpg`; } catch { }
    }
    out[ko] = c; console.log(ko, c.length, "장"); await new Promise((r) => setTimeout(r, 300));
  }
  fs.writeFileSync("scripts/migrate/out/fish2.json", JSON.stringify(out, null, 1));
})();

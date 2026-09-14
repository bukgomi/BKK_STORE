// 누끼가 잘 안 된 어종의 대체 후보 다운로드 → scripts/migrate/out/fish2-alt/<어종>-<n>.jpg (+ meta)
const fs = require("fs");
const UA = "topcasting-rigs/1.0 (bkk.noname.admin@gmail.com)";
const BAD = /sushi|nigiri|dried|sashimi|food|dish|cooked|grilled|fried|meal|skelet|otolith|gladius|egg|larva|paralarva|map|range|fossil|logo|stamp|coin|statue|toy|graph|chart|shell|beak|illustr|drawing|plate|FMIB|Fishes of|Naturalis|painting|lithograph|engraving|Merculiano|Voyage|Cephalopoda|embryo|transparent|x-ray|boiled|soup|hoe|\.svg|underwater|reef|diving|aquarium/i;
const TERMS = {
  "문어": ["Enteroctopus dofleini", "Octopus vulgaris caught", "Octopus vulgaris market", "Octopus sinensis", "octopus fishing catch"],
  "무늬오징어": ["Sepioteuthis lessoniana", "bigfin reef squid caught", "Sepioteuthis"],
  "한치": ["Uroteuthis edulis", "Loligo vulgaris", "Loligo forbesii", "squid caught", "Todarodes pacificus"],
  "호래기": ["Loliolus", "Loligo vulgaris", "small squid caught", "Todarodes pacificus"],
  "삼치": ["Scomberomorus niphonius", "Scomberomorus commerson caught", "Scomberomorus"],
};
async function q(term) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=${encodeURIComponent(term)}&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=1200`;
  const j = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  return Object.values(j.query?.pages || {}).map((p) => { const ii = p.imageinfo?.[0]; if (!ii) return null; const m = ii.extmetadata || {}; return { title: p.title.replace(/^File:/, ""), thumb: ii.thumburl, desc: ii.descriptionurl, license: m.LicenseShortName?.value || "", artist: (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim(), w: ii.width, h: ii.height, mime: ii.mime }; })
    .filter(Boolean).filter((x) => x.mime === "image/jpeg" && x.w >= 600 && /CC|Public domain|CC0/i.test(x.license) && !/NC|ND/i.test(x.license) && !BAD.test(x.title));
}
(async () => {
  fs.mkdirSync("scripts/migrate/out/fish2-alt", { recursive: true });
  const meta = {};
  for (const [ko, terms] of Object.entries(TERMS)) {
    let c = []; for (const t of terms) c.push(...await q(t));
    const seen = new Set(); c = c.filter((x) => !seen.has(x.title) && seen.add(x.title)).slice(0, 8);
    meta[ko] = [];
    for (let i = 0; i < c.length; i++) {
      try { const buf = Buffer.from(await (await fetch(c[i].thumb, { headers: { "User-Agent": UA } })).arrayBuffer()); if (buf.length < 8000) continue; fs.writeFileSync(`scripts/migrate/out/fish2-alt/${ko}-${i + 1}.jpg`, buf); meta[ko].push({ ...c[i], file: `${ko}-${i + 1}.jpg` }); } catch { }
    }
    console.log(ko, meta[ko].map((x, i) => `${i + 1}:${x.title.slice(0, 30)}`).join(" | "));
  }
  fs.writeFileSync("scripts/migrate/out/fish2-alt.json", JSON.stringify(meta, null, 1));
})();

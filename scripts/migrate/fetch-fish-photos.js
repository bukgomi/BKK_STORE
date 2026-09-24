// 위키미디어 공용(Commons)에서 어종 사진을 찾아 내려받고 출처/라이선스를 기록한다
const fs = require("fs");
const path = require("path");
const SPECIES = [
  ["갑오징어", ["Sepia esculenta", "Sepia officinalis cuttlefish"]],
  ["쭈꾸미", ["Amphioctopus fangsiao", "Octopus ocellatus"]],
  ["문어", ["Enteroctopus dofleini", "Octopus vulgaris"]],
  ["광어", ["Paralichthys olivaceus"]],
  ["우럭", ["Sebastes schlegelii"]],
  ["갈치", ["Trichiurus lepturus", "Trichiurus japonicus"]],
  ["무늬오징어", ["Sepioteuthis lessoniana"]],
  ["한치", ["Uroteuthis edulis", "Loligo edulis"]],
  ["호래기", ["Loliolus beka", "Loliolus japonica"]],
  ["참돔", ["Pagrus major"]],
  ["농어", ["Lateolabrax japonicus", "Lateolabrax maculatus"]],
  ["삼치", ["Scomberomorus niphonius"]],
  ["부시리", ["Seriola lalandi", "Seriola quinqueradiata"]],
  ["대구", ["Gadus macrocephalus"]],
  ["볼락", ["Sebastes inermis"]],
  ["전갱이", ["Trachurus japonicus"]],
  ["배스", ["Micropterus salmoides"]],
  ["쏘가리", ["Siniperca scherzeri"]],
  ["송어", ["Oncorhynchus mykiss rainbow trout"]],
  ["감성돔", ["Acanthopagrus schlegelii"]],
];
const UA = "topcasting-rigs/1.0 (bkk.noname.admin@gmail.com)";
async function search(term) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(term + " filetype:bitmap")}&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=800`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  const j = await r.json();
  const pages = Object.values(j.query?.pages || {});
  return pages.map((p) => {
    const ii = p.imageinfo?.[0]; if (!ii) return null;
    const m = ii.extmetadata || {};
    const license = m.LicenseShortName?.value || "";
    const artist = (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim();
    return { title: p.title, thumb: ii.thumburl, url: ii.descriptionurl, license, artist, w: ii.width, h: ii.height, mime: ii.mime };
  }).filter(Boolean).filter((x) => /jpeg|png/.test(x.mime) && x.w >= 500 && /CC|Public domain|CC0/i.test(x.license) && !/SA 4\.0 .*non/i.test(x.license));
}
(async () => {
  const out = {};
  for (const [ko, terms] of SPECIES) {
    let hit = null;
    for (const t of terms) { const res = await search(t); if (res.length) { hit = res.find((r) => r.w >= r.h) || res[0]; break; } }
    if (!hit) { console.log("✗", ko); continue; }
    const file = `${ko}.jpg`;
    const buf = Buffer.from(await (await fetch(hit.thumb, { headers: { "User-Agent": UA } })).arrayBuffer());
    fs.writeFileSync(path.join("public/images/rigs/species", file), buf);
    out[ko] = { path: `/images/rigs/species/${file}`, source: hit.url, title: hit.title.replace(/^File:/, ""), artist: hit.artist, license: hit.license };
    console.log("✔", ko, "←", hit.title.slice(5, 60), "|", hit.license, "|", hit.artist.slice(0, 30), `${Math.round(buf.length / 1024)}KB`);
    await new Promise((r) => setTimeout(r, 400));
  }
  fs.writeFileSync("public/images/rigs/species/credits.json", JSON.stringify(out, null, 2));
  console.log("완료:", Object.keys(out).length, "종");
})();

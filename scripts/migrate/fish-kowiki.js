// 한국어 위키백과 어종 문서의 대표 이미지(인포박스) 수집 → scripts/migrate/out/fish3/<어종>.<ext> + fish3.json
const fs = require("fs");
const UA = "topcasting-rigs/1.0 (bkk.noname.admin@gmail.com)";
// 어종(사이트) → 한국어 위키백과 문서 제목 후보(앞에서부터 시도)
const TITLES = {
  "갑오징어": ["참갑오징어", "갑오징어"], "쭈꾸미": ["주꾸미"], "문어": ["문어", "참문어"], "광어": ["넙치"], "우럭": ["조피볼락"], "갈치": ["갈치"],
  "무늬오징어": ["흰꼴뚜기", "무늬오징어"], "한치": ["창꼴뚜기", "한치"], "호래기": ["반원니꼴뚜기", "꼴뚜기"], "참돔": ["참돔"], "농어": ["농어"], "삼치": ["삼치"],
  "부시리": ["부시리"], "대구": ["대구 (어류)", "대구"], "볼락": ["볼락"], "전갱이": ["전갱이"], "배스": ["큰입배스", "배스"], "쏘가리": ["쏘가리"],
  "송어": ["송어", "무지개송어"], "감성돔": ["감성돔"],
};
const mode = process.argv[2] || "all";
async function j(url) { return (await fetch(url, { headers: { "User-Agent": UA } })).json(); }
async function pageImage(title) {
  const r = await j(`https://ko.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages|info&piprop=original|name&inprop=url&titles=${encodeURIComponent(title)}`);
  const p = Object.values(r.query?.pages || {})[0];
  if (!p || p.missing || !p.original) return null;
  return { title: p.title, url: p.fullurl, file: p.pageimage, orig: p.original.source, w: p.original.width, h: p.original.height };
}
async function commonsMeta(file) {
  const r = await j(`https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent("File:" + file)}&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=1600`);
  const p = Object.values(r.query?.pages || {})[0]; const ii = p?.imageinfo?.[0]; if (!ii) return null;
  const m = ii.extmetadata || {};
  return { thumb: ii.thumburl || ii.url, desc: ii.descriptionurl, license: m.LicenseShortName?.value || "", artist: (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim(), mime: ii.mime };
}
(async () => {
  fs.mkdirSync("scripts/migrate/out/fish3", { recursive: true });
  const out = {};
  for (const [ko, cands] of Object.entries(TITLES)) {
    let pi = null;
    for (const t of cands) { pi = await pageImage(t); if (pi) break; }
    if (!pi) { console.log("✗", ko, "문서/이미지 없음"); continue; }
    const cm = await commonsMeta(pi.file) || {};
    const ext = /svg/i.test(cm.mime || "") ? "svg" : /png/i.test(cm.mime || "") ? "png" : "jpg";
    const src = cm.thumb || pi.orig;
    let buf = Buffer.from(await (await fetch(src, { headers: { "User-Agent": UA } })).arrayBuffer());
    const file = `${ko}.${ext}`;
    fs.writeFileSync(`scripts/migrate/out/fish3/${file}`, buf);
    out[ko] = { article: pi.title, articleUrl: pi.url, file, commonsFile: pi.file, source: cm.desc, license: cm.license, artist: cm.artist, mime: cm.mime, w: pi.w, h: pi.h };
    console.log("✔", ko, "←", pi.title, "|", pi.file, "|", cm.license, "|", pi.w + "x" + pi.h, "|", Math.round(buf.length / 1024) + "KB");
    await new Promise((r) => setTimeout(r, 200));
  }
  fs.writeFileSync("scripts/migrate/out/fish3.json", JSON.stringify(out, null, 1));
})();

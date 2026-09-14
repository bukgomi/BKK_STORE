// 약한 어종: 한국어/영어/일본어 위키백과 문서의 사진 후보 수집 → out/fish3-alt/<어종>-<n>.jpg + fish3-alt.json
const fs = require("fs");
const UA = "topcasting-rigs/1.0 (bkk.noname.admin@gmail.com)";
const BAD = /map|range|skelet|otolith|larva|egg|\.svg|\.gif|logo|icon|sushi|sashimi|dish|cooked|fossil|drawing|illustr|distribution|Commons|Wiki|status|Picto|emoji|Flag|Nuvola|Symbol|Question|Edit|Ambox|Crystal|Disambig|Star|Cuisine|Food|料理|寿司|刺身|Sashimi|Nigiri|dried|Dried|Fillet|fillet|Market|market|Boiled|Fried|Grilled|Soup|Stew|Gyotaku/i;
const P = {
  "한치": [["ja", "ケンサキイカ"], ["en", "Uroteuthis edulis"], ["ja", "ヤリイカ"], ["en", "Swordtip squid"]],
  "삼치": [["ja", "サワラ"], ["en", "Japanese Spanish mackerel"], ["en", "Scomberomorus"]],
  "부시리": [["ja", "ヒラマサ"], ["en", "Yellowtail amberjack"], ["en", "Seriola aureovittata"]],
  "대구": [["ja", "マダラ"], ["en", "Pacific cod"], ["en", "Gadus"]],
  "송어": [["ja", "サクラマス"], ["en", "Masu salmon"], ["ja", "ニジマス"], ["en", "Rainbow trout"]],
  "무늬오징어": [["ja", "アオリイカ"], ["en", "Bigfin reef squid"]],
  "호래기": [["ja", "ベイカ"], ["ja", "ジンドウイカ"], ["en", "Loliolus"], ["ja", "ヒメイカ"]],
  "갑오징어": [["ja", "コウイカ"], ["en", "Sepia esculenta"], ["ko", "갑오징어"]],
  "광어": [["ja", "ヒラメ"], ["en", "Olive flounder"], ["ko", "넙치"]],
  "쏘가리": [["ja", "コウライケツギョ"], ["en", "Siniperca scherzeri"], ["ko", "쏘가리"]],
  "감성돔": [["ja", "クロダイ"], ["en", "Blackhead seabream"], ["ko", "감성돔"]],
  "농어": [["ja", "スズキ (魚)"], ["en", "Japanese sea bass"], ["ko", "농어"]],
  "전갱이": [["ja", "マアジ"], ["en", "Japanese jack mackerel"], ["ko", "전갱이"]],
  "우럭": [["ja", "クロソイ"], ["en", "Korean rockfish"], ["ko", "조피볼락"]],
  "문어": [["ja", "マダコ"], ["en", "Octopus sinensis"], ["ja", "ミズダコ"], ["ko", "문어"]],
  "쭈꾸미": [["ja", "イイダコ"], ["en", "Amphioctopus fangsiao"], ["ko", "주꾸미"]],
  "갈치": [["ja", "タチウオ"], ["en", "Largehead hairtail"], ["ko", "갈치"]],
  "참돔": [["ja", "マダイ"], ["en", "Red seabream"], ["ko", "참돔"]],
  "볼락": [["ja", "メバル"], ["en", "Sebastes inermis"], ["ko", "볼락"]],
  "배스": [["en", "Largemouth bass"], ["ja", "オオクチバス"], ["ko", "큰입배스"]],
};
async function j(url) { return (await fetch(url, { headers: { "User-Agent": UA } })).json(); }
async function articleImages(lang, title) {
  const r = await j(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=images|pageimages&piprop=name&imlimit=50&titles=${encodeURIComponent(title)}`);
  const p = Object.values(r.query?.pages || {})[0]; if (!p || p.missing) return null;
  const files = (p.images || []).map((i) => i.title.replace(/^[^:]+:/, "")).filter((t) => /\.(jpe?g|png)$/i.test(t) && !BAD.test(t));
  if (p.pageimage && !files.includes(p.pageimage)) files.unshift(p.pageimage);
  else if (p.pageimage) { files.splice(files.indexOf(p.pageimage), 1); files.unshift(p.pageimage); }
  return { article: `${lang}:${p.title}`, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`, files };
}
async function info(files) {
  const out = [];
  for (let i = 0; i < files.length; i += 20) {
    const r = await j(`https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(files.slice(i, i + 20).map((f) => "File:" + f).join("|"))}&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=1600`);
    for (const p of Object.values(r.query?.pages || {})) { const ii = p.imageinfo?.[0]; if (!ii) continue; const m = ii.extmetadata || {}; out.push({ title: p.title.replace(/^File:/, ""), thumb: ii.thumburl || ii.url, desc: ii.descriptionurl, license: m.LicenseShortName?.value || "", artist: (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim(), w: ii.width, h: ii.height, mime: ii.mime }); }
  }
  return out.filter((x) => x.w >= 500 && /jpeg|png/.test(x.mime) && !/NC|ND/i.test(x.license));
}
(async () => {
  fs.mkdirSync("scripts/migrate/out/fish3-alt", { recursive: true });
  const out = {};
  for (const [ko, cands] of Object.entries(P)) {
    const order = []; const seen = new Set(); const artOf = {};
    for (const [lang, t] of cands) { const a = await articleImages(lang, t); if (!a) { console.log("  (없음)", lang, t); continue; } for (const f of a.files) if (!seen.has(f)) { seen.add(f); order.push(f); artOf[f] = a; } }
    const metas = await info(order); metas.sort((a, b) => order.indexOf(a.title.replace(/ /g, "_")) - order.indexOf(b.title.replace(/ /g, "_")));
    out[ko] = [];
    for (let i = 0; i < Math.min(metas.length, 8); i++) {
      const m = metas[i]; const a = artOf[m.title.replace(/ /g, "_")] || artOf[m.title] || {};
      try { const buf = Buffer.from(await (await fetch(m.thumb, { headers: { "User-Agent": UA } })).arrayBuffer()); if (buf.length < 5000) continue; const file = `${ko}-${out[ko].length + 1}.jpg`; fs.writeFileSync(`scripts/migrate/out/fish3-alt/${file}`, buf); out[ko].push({ ...m, file, article: a.article, articleUrl: a.url }); } catch { }
    }
    console.log(ko, "→", out[ko].map((x, i) => `${i + 1}:${x.title.slice(0, 26)}(${x.w}x${x.h},${x.license.slice(0, 12)})`).join(" | "));
    await new Promise((r) => setTimeout(r, 150));
  }
  fs.writeFileSync("scripts/migrate/out/fish3-alt.json", JSON.stringify(out, null, 1));
})();

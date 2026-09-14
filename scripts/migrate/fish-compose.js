// (컨테이너) rembg 누끼(PNG, 알파) → 흰 배경 800x800 정사각형 + 미리보기 시트
const sharp = require("sharp"), fs = require("fs");
(async () => {
  const dir = "scripts/migrate/out/fish-cut";
  const files = fs.readdirSync(dir).filter((f) => /^pick-.*\.png$/.test(f));
  const credits = JSON.parse(fs.readFileSync("scripts/migrate/out/fish2-credits.json", "utf8"));
  const names = [];
  for (const f of files) {
    const ko = f.replace(/^pick-/, "").replace(/\.png$/, "");
    let img = sharp(`${dir}/${f}`);
    try { img = sharp(await img.trim({ threshold: 10 }).toBuffer()); } catch { }
    const cut = await img.resize(700, 700, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    const r = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#ffffff" } }).composite([{ input: cut, gravity: "centre" }]).jpeg({ quality: 90 }).toFile(`public/uploads/rigs/species/${ko}.jpg`);
    names.push(ko); console.log(ko, r.width + "x" + r.height, Math.round(r.size / 1024) + "KB");
  }
  fs.writeFileSync("public/uploads/rigs/species/credits.json", JSON.stringify(credits, null, 2));
  const S = 190, cols = 5, rows = Math.ceil(names.length / cols); const comps = [];
  for (let i = 0; i < names.length; i++) { const ko = names[i]; const buf = await sharp(`public/uploads/rigs/species/${ko}.jpg`).resize(S - 8, S - 8).toBuffer(); comps.push({ input: buf, left: (i % cols) * S + 4, top: Math.floor(i / cols) * S + 4 }); comps.push({ input: Buffer.from(`<svg width="${S}" height="26"><rect width="${S}" height="26" fill="#111" opacity="0.7"/><text x="8" y="19" font-size="15" font-family="sans-serif" fill="#fff">${ko}</text></svg>`), left: (i % cols) * S, top: Math.floor(i / cols) * S + S - 26 }); }
  await sharp({ create: { width: cols * S, height: rows * S, channels: 3, background: "#e5e7eb" } }).composite(comps).jpeg({ quality: 80 }).toFile("scripts/migrate/out/fish-cut-final.jpg");
  console.log("완료", names.length);
})();

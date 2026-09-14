// (컨테이너) 후보 사진의 배경 깨끗함 점수 계산 → 상위 6장씩 시트 생성
const sharp = require("sharp"), fs = require("fs");
async function score(file) {
  const img = sharp(file).resize(120, 120, { fit: "fill" });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
  const border = [];
  for (let x = 0; x < 120; x += 3) { border.push(px(x, 2), px(x, 117)); }
  for (let y = 0; y < 120; y += 3) { border.push(px(2, y), px(117, y)); }
  const lum = border.map(([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b);
  const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
  const sd = Math.sqrt(lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length);
  const sat = border.map(([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b)).reduce((a, b) => a + b, 0) / border.length;
  // 밝고(흰 배경) 균일하며 채도 낮을수록 좋음
  return Math.round(mean * 0.5 + (60 - Math.min(sd, 60)) * 1.5 + (60 - Math.min(sat, 60)) * 0.8);
}
(async () => {
  const all = JSON.parse(fs.readFileSync("scripts/migrate/out/fish2.json", "utf8"));
  const ranked = {};
  for (const [ko, list] of Object.entries(all)) {
    const withScore = [];
    for (const c of list) { if (!c.file) continue; try { withScore.push({ ...c, score: await score(`scripts/migrate/out/fish2/${c.file}`) }); } catch { } }
    withScore.sort((a, b) => b.score - a.score);
    ranked[ko] = withScore.slice(0, 6);
  }
  fs.writeFileSync("scripts/migrate/out/fish2-ranked.json", JSON.stringify(ranked, null, 1));
  const names = Object.keys(ranked), CW = 170, CH = 130, LW = 80, cols = 6;
  const W = LW + CW * cols, H = CH * names.length; const comps = [];
  for (let r = 0; r < names.length; r++) {
    const ko = names[r];
    comps.push({ input: Buffer.from(`<svg width="${LW}" height="${CH}"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="6" y="${CH / 2 + 6}" font-size="17" font-family="sans-serif" fill="#111">${ko}</text></svg>`), left: 0, top: r * CH });
    for (let i = 0; i < ranked[ko].length; i++) {
      const c = ranked[ko][i];
      const buf = await sharp(`scripts/migrate/out/fish2/${c.file}`).resize(CW - 6, CH - 6, { fit: "contain", background: "#fff" }).toBuffer();
      comps.push({ input: buf, left: LW + i * CW + 3, top: r * CH + 3 });
      comps.push({ input: Buffer.from(`<svg width="46" height="20"><rect width="46" height="20" fill="#111"/><text x="5" y="15" font-size="13" font-family="sans-serif" fill="#fff">${i + 1} ${c.score}</text></svg>`), left: LW + i * CW + 3, top: r * CH + 3 });
    }
  }
  const sheet = await sharp({ create: { width: W, height: H, channels: 3, background: "#ddd" } }).composite(comps).jpeg({ quality: 82 }).toBuffer();
  const half = Math.ceil(names.length / 2);
  await sharp(sheet).extract({ left: 0, top: 0, width: W, height: half * CH }).toFile("scripts/migrate/out/fish2-sheet-1.jpg");
  await sharp(sheet).extract({ left: 0, top: half * CH, width: W, height: H - half * CH }).toFile("scripts/migrate/out/fish2-sheet-2.jpg");
  console.log("done", W, H);
})();

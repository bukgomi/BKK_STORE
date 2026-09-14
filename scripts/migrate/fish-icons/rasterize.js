// SVG 아이콘 → public/uploads/rigs/species/<어종>.jpg (800px) + 미리보기 시트. 컨테이너 안에서 실행
const sharp = require("sharp"), fs = require("fs");
(async () => {
  const dir = "scripts/migrate/fish-icons";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg"));
  for (const f of files) {
    const ko = f.replace(".svg", "");
    await sharp(`${dir}/${f}`, { density: 192 }).resize(800, 800).jpeg({ quality: 90 }).toFile(`public/uploads/rigs/species/${ko}.jpg`);
  }
  const S = 190, cols = 5, rows = Math.ceil(files.length / cols); const comps = [];
  for (let i = 0; i < files.length; i++) {
    const ko = files[i].replace(".svg", "");
    const buf = await sharp(`public/uploads/rigs/species/${ko}.jpg`).resize(S - 8, S - 8).toBuffer();
    comps.push({ input: buf, left: (i % cols) * S + 4, top: Math.floor(i / cols) * S + 4 });
    comps.push({ input: Buffer.from(`<svg width="${S}" height="26"><rect width="${S}" height="26" fill="#111" opacity="0.7"/><text x="8" y="19" font-size="15" font-family="sans-serif" fill="#fff">${ko}</text></svg>`), left: (i % cols) * S, top: Math.floor(i / cols) * S + S - 26 });
  }
  await sharp({ create: { width: cols * S, height: rows * S, channels: 3, background: "#e5e7eb" } }).composite(comps).jpeg({ quality: 80 }).toFile("scripts/migrate/out/fish-icons-preview.jpg");
  fs.writeFileSync("public/uploads/rigs/species/credits.json", "{}"); // 외부 사진 출처 없음 (자체 제작)
  console.log("변환 완료", files.length);
})();

// 고른 사진을 고해상도로 받아 박스에 맞게 가공 (긴 물고기도 안 잘리게: 흐린 배경 + 원본 contain)
// 1단계(호스트): 다운로드 → scripts/migrate/out/fish2/pick-<어종>.jpg, credits.json 갱신
// 2단계(컨테이너): node scripts/migrate/fish-pick2.js process
const fs = require("fs");
const UA = "topcasting-rigs/1.0 (bkk.noname.admin@gmail.com)";
// 어종 → [후보 어종 키, 순위]  (fish2-ranked.json 기준)
const PICK = {
  "갑오징어": ["갑오징어", 1], "쭈꾸미": ["쭈꾸미", 3], "문어": ["문어", 2], "광어": ["광어", 4], "우럭": ["우럭", 3], "갈치": ["갈치", 4],
  "무늬오징어": ["무늬오징어", 1], "한치": ["한치", 5], "호래기": ["한치", 6], "참돔": ["참돔", 1], "농어": ["농어", 4], "삼치": ["삼치", 3],
  "부시리": ["부시리", 4], "대구": ["대구", 2], "볼락": ["볼락", 3], "전갱이": ["전갱이", 3], "배스": ["배스", 6], "쏘가리": ["쏘가리", 1],
  "송어": ["송어", 3], "감성돔": ["감성돔", 3],
};
const mode = process.argv[2] || "download";
(async () => {
  if (mode === "download") {
    const ranked = JSON.parse(fs.readFileSync("scripts/migrate/out/fish2-ranked.json", "utf8"));
    const credits = {};
    for (const [ko, [src, n]] of Object.entries(PICK)) {
      const c = ranked[src][n - 1]; if (!c) { console.log("✗", ko); continue; }
      const big = c.thumb.replace(/\/\d+px-/, "/1200px-");
      let buf; try { buf = Buffer.from(await (await fetch(big, { headers: { "User-Agent": UA } })).arrayBuffer()); if (buf.length < 8000) throw 0; } catch { buf = Buffer.from(await (await fetch(c.thumb, { headers: { "User-Agent": UA } })).arrayBuffer()); }
      fs.writeFileSync(`scripts/migrate/out/fish2/pick-${ko}.jpg`, buf);
      credits[ko] = { path: `/uploads/rigs/species/${ko}.jpg`, source: c.desc, title: c.title, artist: c.artist, license: c.license, ...(src !== ko ? { note: "유사 어종 사진" } : {}) };
      console.log("✔", ko, "←", c.title.slice(0, 55), "|", c.license, "|", Math.round(buf.length / 1024) + "KB");
      await new Promise((r) => setTimeout(r, 250));
    }
    fs.writeFileSync("scripts/migrate/out/fish2-credits.json", JSON.stringify(credits, null, 2));
  } else {
    const sharp = require("sharp");
    const credits = JSON.parse(fs.readFileSync("scripts/migrate/out/fish2-credits.json", "utf8"));
    for (const ko of Object.keys(credits)) {
      const src = `scripts/migrate/out/fish2/pick-${ko}.jpg`;
      const meta = await sharp(src).metadata();
      const isWhiteish = await (async () => { const { data } = await sharp(src).resize(50, 50, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true }); let s = 0, n = 0; for (let i = 0; i < data.length; i += 3) { const x = (i / 3) % 50, y = Math.floor(i / 3 / 50); if (x < 3 || x > 46 || y < 3 || y > 46) { s += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; } } return s / n > 225; })();
      let out;
      if (isWhiteish) {
        out = sharp(await sharp(src).trim({ threshold: 24 }).toBuffer()).resize(720, 720, { fit: "contain", background: "#ffffff" }).extend({ top: 40, bottom: 40, left: 40, right: 40, background: "#ffffff" });
      } else {
        const bg = await sharp(src).resize(800, 800, { fit: "cover" }).blur(28).modulate({ brightness: 1.05, saturation: 0.9 }).toBuffer();
        const fgW = meta.width >= meta.height ? 760 : Math.round(760 * meta.width / meta.height), fgH = meta.width >= meta.height ? Math.round(760 * meta.height / meta.width) : 760;
        const fg = await sharp(src).resize(fgW, fgH, { fit: "inside" }).toBuffer();
        out = sharp(bg).composite([{ input: fg, gravity: "centre" }]);
      }
      const r = await out.jpeg({ quality: 88 }).toFile(`public/uploads/rigs/species/${ko}.jpg`);
      console.log(ko, isWhiteish ? "흰배경 트림" : "흐린배경 합성", r.width + "x" + r.height, Math.round(r.size / 1024) + "KB");
    }
    fs.writeFileSync("public/uploads/rigs/species/credits.json", JSON.stringify(credits, null, 2));
    // 미리보기
    const names = Object.keys(credits), S = 190, cols = 5, rows = Math.ceil(names.length / cols); const comps = [];
    for (let i = 0; i < names.length; i++) { const ko = names[i]; const buf = await sharp(`public/uploads/rigs/species/${ko}.jpg`).resize(S - 8, S - 8).toBuffer(); comps.push({ input: buf, left: (i % cols) * S + 4, top: Math.floor(i / cols) * S + 4 }); comps.push({ input: Buffer.from(`<svg width="${S}" height="26"><rect width="${S}" height="26" fill="#111" opacity="0.7"/><text x="8" y="19" font-size="15" font-family="sans-serif" fill="#fff">${ko}</text></svg>`), left: (i % cols) * S, top: Math.floor(i / cols) * S + S - 26 }); }
    await sharp({ create: { width: cols * S, height: rows * S, channels: 3, background: "#e5e7eb" } }).composite(comps).jpeg({ quality: 80 }).toFile("scripts/migrate/out/fish2-final.jpg");
    console.log("완료", names.length);
  }
})();

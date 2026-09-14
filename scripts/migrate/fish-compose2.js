// (컨테이너) 누끼 PNG → 가장 큰 덩어리만 남기고(작은 잔여물 제거) 흰 배경 800x800 으로. 사용법:
//   node scripts/migrate/fish-compose2.js <입력폴더> <출력폴더> <시트파일>
const sharp = require("sharp"), fs = require("fs"), path = require("path");
const [inDir, outDir, sheet] = process.argv.slice(2);

async function keepLargest(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const a = new Uint8Array(N); for (let i = 0; i < N; i++) a[i] = data[i * 4 + 3] > 40 ? 1 : 0;
  const label = new Int32Array(N); let cur = 0; const sizes = [0];
  const stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (!a[s] || label[s]) continue;
    cur++; let sp = 0; stack[sp++] = s; label[s] = cur; let size = 0;
    while (sp) { const p = stack[--sp]; size++; const x = p % W, y = (p / W) | 0;
      const nb = [p - 1, p + 1, p - W, p + W];
      if (x === 0) nb[0] = -1; if (x === W - 1) nb[1] = -1; if (y === 0) nb[2] = -1; if (y === H - 1) nb[3] = -1;
      for (const n of nb) if (n >= 0 && a[n] && !label[n]) { label[n] = cur; stack[sp++] = n; } }
    sizes.push(size);
  }
  let best = 1; for (let i = 2; i < sizes.length; i++) if (sizes[i] > sizes[best]) best = i;
  // 가장 큰 덩어리의 8% 미만인 조각은 지움 (도구·루어 등 잔여물)
  const keep = new Set(); sizes.forEach((sz, i) => { if (i > 0 && sz >= sizes[best] * 0.08) keep.add(i); });
  for (let i = 0; i < N; i++) if (a[i] && !keep.has(label[i])) data[i * 4 + 3] = 0;
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(inDir).filter((f) => f.endsWith(".png")).sort();
  const names = [];
  for (const f of files) {
    const name = f.replace(/^pick-/, "").replace(/\.png$/, "");
    let png = await keepLargest(fs.readFileSync(path.join(inDir, f)));
    try { png = await sharp(png).trim({ threshold: 10 }).toBuffer(); } catch { }
    const cut = await sharp(png).resize(700, 700, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    await sharp({ create: { width: 800, height: 800, channels: 3, background: "#ffffff" } }).composite([{ input: cut, gravity: "centre" }]).jpeg({ quality: 90 }).toFile(path.join(outDir, `${name}.jpg`));
    names.push(name);
  }
  const S = 190, cols = 5, rows = Math.ceil(names.length / cols); const comps = [];
  for (let i = 0; i < names.length; i++) { const n = names[i]; const buf = await sharp(path.join(outDir, `${n}.jpg`)).resize(S - 8, S - 8).toBuffer(); comps.push({ input: buf, left: (i % cols) * S + 4, top: Math.floor(i / cols) * S + 4 }); comps.push({ input: Buffer.from(`<svg width="${S}" height="26"><rect width="${S}" height="26" fill="#111" opacity="0.7"/><text x="8" y="19" font-size="15" font-family="sans-serif" fill="#fff">${n}</text></svg>`), left: (i % cols) * S, top: Math.floor(i / cols) * S + S - 26 }); }
  await sharp({ create: { width: cols * S, height: rows * S, channels: 3, background: "#e5e7eb" } }).composite(comps).jpeg({ quality: 80 }).toFile(sheet);
  console.log("완료", names.length, "→", outDir);
})();

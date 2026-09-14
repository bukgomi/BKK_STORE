// 위키백과 후보 중 선택 → out/fish3-in/pick-<어종>.jpg + out/fish3-credits.json
const fs = require("fs");
const base = JSON.parse(fs.readFileSync("scripts/migrate/out/fish3.json", "utf8"));      // ko 위키 대표이미지
const alt = JSON.parse(fs.readFileSync("scripts/migrate/out/fish3-alt.json", "utf8"));   // ko/en/ja 문서 내 후보
// 어종 → "base" (ko 대표이미지) 또는 alt 번호
const PICK = {
  "갑오징어": 8, "쭈꾸미": 4, "문어": 3, "광어": 6, "우럭": "base", "갈치": 5, "무늬오징어": 7, "한치": 1, "참돔": "base", "농어": 6,
  "삼치": 7, "부시리": 2, "대구": 4, "볼락": "base", "전갱이": 6, "배스": 4, "쏘가리": "base", "송어": 5, "감성돔": 1,
};
const NOTE = { "한치": "유사 어종(창꼴뚜기) 사진", "대구": "유사 어종(대서양대구) 사진" };
fs.mkdirSync("scripts/migrate/out/fish3-in", { recursive: true });
const credits = {};
for (const [ko, sel] of Object.entries(PICK)) {
  let src, c;
  if (sel === "base") { c = base[ko]; src = `scripts/migrate/out/fish3/${c.file}`; }
  else { c = alt[ko][sel - 1]; src = `scripts/migrate/out/fish3-alt/${c.file}`; }
  fs.copyFileSync(src, `scripts/migrate/out/fish3-in/pick-${ko}.jpg`);
  credits[ko] = { path: `/uploads/rigs/species/${ko}.jpg`, source: c.source || c.desc, title: c.commonsFile || c.title, artist: c.artist, license: c.license, article: c.articleUrl || c.article, ...(NOTE[ko] ? { note: NOTE[ko] } : {}) };
  console.log("✔", ko, "←", (c.commonsFile || c.title).slice(0, 50), "|", c.license);
}
fs.writeFileSync("scripts/migrate/out/fish3-credits.json", JSON.stringify(credits, null, 2));

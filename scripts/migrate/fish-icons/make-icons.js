// 자체 제작 어종 아이콘 (플랫 벡터, 원본 저작물) → SVG. 이후 rasterize.js 가 800px JPG 로 변환
const fs = require("fs"), path = require("path");
const V = 200; // viewBox
const fin = (d, c) => `<path d="${d}" fill="${c}"/>`;

// 기본 형태들 — 모두 왼쪽을 머리로 하는 측면 실루엣
const SHAPES = {
  perch: (c, c2) => `
    ${fin("M118 62 L128 40 L138 60 L148 42 L156 62 L164 48 L170 66 Z", c2)}
    ${fin("M126 138 L134 158 L142 140 L150 156 L156 140 Z", c2)}
    <path d="M28 100 C40 66 80 50 122 54 C150 57 168 74 176 100 C168 126 150 143 122 146 C80 150 40 134 28 100 Z" fill="${c}"/>
    ${fin("M176 100 L198 76 L192 100 L198 124 Z", c2)}
    ${fin("M84 118 C92 130 106 136 116 128 C106 124 96 120 84 118 Z", c2)}
    <circle cx="52" cy="90" r="8" fill="#fff"/><circle cx="54" cy="90" r="4" fill="#1f2937"/>
    <path d="M30 102 C40 108 50 108 58 104" stroke="#1f2937" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  bream: (c, c2) => `
    ${fin("M100 44 L112 24 L124 44 L136 26 L148 46 L160 32 L168 52 Z", c2)}
    ${fin("M110 158 L120 176 L132 158 L144 174 L154 156 Z", c2)}
    <path d="M24 100 C36 56 78 34 120 40 C152 45 172 70 178 100 C172 130 152 155 120 160 C78 166 36 144 24 100 Z" fill="${c}"/>
    ${fin("M176 100 L198 70 L190 100 L198 130 Z", c2)}
    ${fin("M86 120 C96 134 112 140 124 130 C110 126 98 122 86 120 Z", c2)}
    <circle cx="50" cy="88" r="9" fill="#fff"/><circle cx="52" cy="88" r="4.5" fill="#1f2937"/>
    <path d="M26 104 C36 110 46 110 54 106" stroke="#1f2937" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  mackerel: (c, c2) => `
    ${fin("M100 70 L110 52 L122 70 L134 56 L146 72 Z", c2)}
    ${fin("M150 72 L156 64 L160 74 Z M164 74 L170 66 L174 76 Z", c2)}
    <path d="M18 100 C36 78 80 68 130 74 C156 77 174 88 184 100 C174 112 156 123 130 126 C80 132 36 122 18 100 Z" fill="${c}"/>
    ${fin("M182 100 L198 74 L192 100 L198 126 Z", c2)}
    ${fin("M70 118 C80 128 96 130 106 122 C94 118 82 116 70 118 Z", c2)}
    <circle cx="40" cy="94" r="7" fill="#fff"/><circle cx="42" cy="94" r="3.5" fill="#1f2937"/>
    <path d="M60 84 L150 78" stroke="${c2}" stroke-width="2" opacity="0.5"/>`,
  cod: (c, c2) => `
    ${fin("M74 66 L84 48 L96 66 Z M104 62 L116 44 L128 62 Z M136 66 L148 50 L158 68 Z", c2)}
    ${fin("M96 140 L106 154 L116 138 Z M128 136 L138 150 L148 134 Z", c2)}
    <path d="M22 100 C36 72 80 62 126 66 C154 68 172 82 182 100 C172 118 154 132 126 134 C80 138 36 128 22 100 Z" fill="${c}"/>
    ${fin("M180 100 L198 82 L194 100 L198 118 Z", c2)}
    <circle cx="46" cy="90" r="8" fill="#fff"/><circle cx="48" cy="90" r="4" fill="#1f2937"/>
    <path d="M28 108 C34 114 38 116 42 118" stroke="#1f2937" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M40 118 L44 128" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>`,
  flatfish: (c, c2) => `
    <path d="M20 100 C30 60 70 42 112 44 C150 46 176 66 184 100 C176 134 150 154 112 156 C70 158 30 140 20 100 Z" fill="${c}"/>
    <path d="M30 100 C40 68 74 54 112 56 C146 58 168 74 176 100 C168 126 146 142 112 144 C74 146 40 132 30 100 Z" fill="none" stroke="${c2}" stroke-width="3" stroke-dasharray="6 5" opacity="0.7"/>
    ${fin("M182 100 L198 84 L196 100 L198 116 Z", c2)}
    <circle cx="48" cy="84" r="8" fill="#fff"/><circle cx="50" cy="84" r="4" fill="#1f2937"/>
    <circle cx="62" cy="70" r="7" fill="#fff"/><circle cx="64" cy="70" r="3.5" fill="#1f2937"/>
    <path d="M30 108 C40 114 50 114 58 110" stroke="#1f2937" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="5" fill="${c2}" opacity="0.6"/><circle cx="130" cy="86" r="4" fill="${c2}" opacity="0.6"/><circle cx="126" cy="120" r="4" fill="${c2}" opacity="0.6"/>`,
  hairtail: (c, c2) => `
    ${fin("M50 80 L60 66 L72 80 L86 68 L100 82 L114 72 L128 84 L142 76 L156 88 L170 84 Z", c2)}
    <path d="M14 100 C30 86 60 82 90 86 C120 90 150 100 190 108 C160 114 130 118 100 116 C60 114 30 112 14 100 Z" fill="${c}"/>
    <circle cx="34" cy="96" r="7" fill="#fff"/><circle cx="36" cy="96" r="3.5" fill="#1f2937"/>
    <path d="M20 104 L28 110 M24 102 L34 112" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round"/>`,
  trout: (c, c2, spot) => `
    ${fin("M104 64 L116 46 L130 64 Z", c2)}
    ${fin("M150 72 L156 66 L160 74 Z", c2)}
    ${fin("M110 138 L120 152 L132 136 Z", c2)}
    <path d="M22 100 C36 74 80 64 126 68 C154 70 172 84 182 100 C172 116 154 130 126 132 C80 136 36 126 22 100 Z" fill="${c}"/>
    ${fin("M180 100 L198 80 L194 100 L198 120 Z", c2)}
    <path d="M40 100 C70 92 120 92 170 100" stroke="${spot}" stroke-width="10" opacity="0.35" stroke-linecap="round" fill="none"/>
    ${[60, 80, 100, 120, 140].map((x, i) => `<circle cx="${x}" cy="${86 + (i % 2) * 8}" r="3.5" fill="#1f2937" opacity="0.55"/>`).join("")}
    <circle cx="46" cy="92" r="7" fill="#fff"/><circle cx="48" cy="92" r="3.5" fill="#1f2937"/>`,
  squid: (c, c2, wide) => {
    const w = wide ? 30 : 22; // 몸통 반폭
    const f = wide ? 50 : 36; // 지느러미 폭
    return `
    <path d="M100 18 C${100 + w} 18 ${100 + w + 2} 60 ${100 + w - 2} 112 L${100 - w + 2} 112 C${100 - w - 2} 60 ${100 - w} 18 100 18 Z" fill="${c}"/>
    <path d="M100 18 C${100 + f} 34 ${100 + f - 2} 90 ${100 + w - 2} 104 L100 96 L${100 - w + 2} 104 C${100 - f + 2} 90 ${100 - f} 34 100 18 Z" fill="${c2}" opacity="0.55"/>
    <circle cx="86" cy="118" r="7" fill="#fff"/><circle cx="86" cy="118" r="3.5" fill="#1f2937"/>
    <circle cx="114" cy="118" r="7" fill="#fff"/><circle cx="114" cy="118" r="3.5" fill="#1f2937"/>
    ${[76, 86, 96, 104, 114, 124].map((x, i) => `<path d="M${x} 126 C${x - 6 + i * 2} 150 ${x + 4} 162 ${x - 2} 184" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`).join("")}
    <path d="M70 126 C50 150 46 172 40 194 M130 126 C150 150 154 172 160 194" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  },
  octopus: (c, c2) => `
    <path d="M100 22 C134 22 150 50 150 80 C150 102 128 112 100 112 C72 112 50 102 50 80 C50 50 66 22 100 22 Z" fill="${c}"/>
    <circle cx="84" cy="80" r="9" fill="#fff"/><circle cx="86" cy="80" r="4.5" fill="#1f2937"/>
    <circle cx="116" cy="80" r="9" fill="#fff"/><circle cx="118" cy="80" r="4.5" fill="#1f2937"/>
    ${[[62, 110, 30, 150, 44, 186], [76, 112, 58, 150, 66, 188], [92, 114, 84, 150, 90, 190], [108, 114, 116, 150, 110, 190], [124, 112, 142, 150, 134, 188], [138, 110, 170, 150, 156, 186], [54, 104, 14, 130, 22, 160], [146, 104, 186, 130, 178, 160]].map(([x1, y1, cx, cy, x2, y2]) => `<path d="M${x1} ${y1} C${cx} ${cy} ${cx} ${cy} ${x2} ${y2}" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>`).join("")}
    <circle cx="70" cy="60" r="4" fill="${c2}" opacity="0.6"/><circle cx="130" cy="60" r="4" fill="${c2}" opacity="0.6"/><circle cx="100" cy="46" r="4" fill="${c2}" opacity="0.6"/>`,
};

// 어종별 형태·색
const SPECIES = {
  "갑오징어": ["squid", "#c9a56b", "#8a6a3a", true],
  "쭈꾸미": ["octopus", "#b06a4a", "#7a3f28"],
  "문어": ["octopus", "#c0392b", "#7b1f16"],
  "광어": ["flatfish", "#8b6f47", "#4a3a22"],
  "우럭": ["perch", "#4b5563", "#1f2937"],
  "갈치": ["hairtail", "#b8c4d6", "#6b7a90"],
  "무늬오징어": ["squid", "#8fb3a9", "#4f7a70", false],
  "한치": ["squid", "#d9b3b3", "#9a6b6b", false],
  "호래기": ["squid", "#e0c8a8", "#a08658", false],
  "참돔": ["bream", "#e2574c", "#9b2f27"],
  "농어": ["perch", "#9aa5b1", "#4b5563"],
  "삼치": ["mackerel", "#6b8fb3", "#2f5a86"],
  "부시리": ["mackerel", "#7fa9c9", "#c9a227"],
  "대구": ["cod", "#a08c6c", "#5c4c33"],
  "볼락": ["perch", "#7a6a5a", "#3f332a"],
  "전갱이": ["mackerel", "#9db7c9", "#4f6f86"],
  "배스": ["perch", "#6a8f5a", "#2f4f24"],
  "쏘가리": ["perch", "#c9a640", "#6b5210"],
  "송어": ["trout", "#88a3b8", "#4f6f86", "#e07a9a"],
  "감성돔": ["bream", "#6b7280", "#1f2937"],
};

for (const [ko, [shape, c, c2, extra]] of Object.entries(SPECIES)) {
  const body = SHAPES[shape](c, c2, extra);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${V} ${V}" width="800" height="800">
  <rect width="${V}" height="${V}" fill="#ffffff"/>
  <circle cx="100" cy="100" r="86" fill="#eef4fb"/>
  <g transform="translate(0,4)">${body}</g>
</svg>`;
  fs.writeFileSync(path.join(__dirname, `${ko}.svg`), svg);
}
console.log("생성:", Object.keys(SPECIES).length, "개");

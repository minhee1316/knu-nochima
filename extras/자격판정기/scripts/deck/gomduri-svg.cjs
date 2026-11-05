// 곰두리 (강원대 마스코트 스타일을 참고해 새로 그린 그림) — 공식 이미지를 복사하지 않음
// 하늘색 몸·진한 파랑 외곽선·초승달 눈썹·동그란 눈·흰 주둥이·W 입·가슴 하트·망토 (참고한 특징)
const LINE = '#2A5CAA', BODY = '#84C9EE', INNER = '#BFE6FA', W = 4.2;

// 머리만 (100×100)
const HEAD = `
<g stroke="${LINE}" stroke-width="${W}" stroke-linejoin="round" stroke-linecap="round">
  <circle cx="24" cy="24" r="12" fill="${BODY}"/><circle cx="78" cy="24" r="12" fill="${BODY}"/>
  <path d="M17 26 a7 7 0 0 1 12 -6" fill="none" stroke="#fff" stroke-width="4"/>
  <path d="M85 26 a7 7 0 0 0 -12 -6" fill="none" stroke="#fff" stroke-width="4"/>
  <path d="M50 18 C74 18 93 31 93 53 C93 76 74 91 51 91 C33 91 18 85 13 76 C9 70 9 65 14 61 C17 58 15 55 14 50 C13 31 29 18 50 18 Z" fill="${BODY}"/>
  <path d="M33 39 q4 -5 8 0 M59 39 q4 -5 8 0" fill="none" stroke-width="3.2"/>
</g>
<circle cx="37" cy="55" r="4.6" fill="${LINE}"/><circle cx="63" cy="55" r="4.6" fill="${LINE}"/>
<circle cx="35.6" cy="53.5" r="1.3" fill="#fff"/><circle cx="61.6" cy="53.5" r="1.3" fill="#fff"/>
<ellipse cx="50" cy="69" rx="17" ry="11.5" fill="#fff"/>
<path d="M44.5 62.5 c0 -2.6 2.4 -3.4 3.6 -1.6 c0.6 0.9 1.2 0.9 1.8 0 c1.2 -1.8 3.6 -1 3.6 1.6 c0 2.4 -2.6 3.6 -4.5 3.6 c-1.9 0 -4.5 -1.2 -4.5 -3.6 z" fill="${LINE}"/>
<path d="M40.5 66 q-3 3 0.5 5.2 q5.5 2.8 9 -4.2 q3.5 7 9 4.2 q3.5 -2.2 0.5 -5.2" fill="none" stroke="${LINE}" stroke-width="2.6" stroke-linecap="round"/>`;

// 서서 손가락으로 가리키는 자세 (200×250) — 발표 표지용
const FULL = `
<g stroke="${LINE}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
  <path d="M138 150 C156 162 166 184 170 206 C173 220 182 228 194 230 C180 242 158 242 142 236 Z" fill="${LINE}"/>
  <path d="M66 140 C54 160 52 190 58 214 C62 230 70 238 68 244 C80 248 94 246 98 240 C101 233 104 228 110 228 C116 228 118 235 120 242 C132 246 146 244 150 238 C144 218 150 192 146 168 C143 152 136 142 130 138 Z" fill="${BODY}"/>
  <path d="M66 162 C52 160 38 154 26 146 C22 136 14 132 12 138 C11 143 16 148 20 150 C20 158 28 164 36 162 C46 168 56 172 64 174" fill="${BODY}"/>
  <path d="M140 168 C148 177 149 188 143 196 C137 200 131 197 132 191" fill="${BODY}"/>
</g>
<path d="M94 176 c0 -6 6 -8 9 -4 c3 -4 9 -2 9 4 c0 6 -6 10 -9 12 c-3 -2 -9 -6 -9 -12 z" fill="#fff"/>
<g transform="translate(5 -6) scale(1.55)">${HEAD}</g>`;

module.exports = {
  head: (size = 100, cls = '') => `<svg ${cls ? `class="${cls}" ` : ''}viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${HEAD}</svg>`,
  full: (w = 200) => `<svg viewBox="0 0 200 250" width="${w}" height="${Math.round(w * 1.25)}" aria-hidden="true">${FULL}</svg>`
};

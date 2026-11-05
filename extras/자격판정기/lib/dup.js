// 중복 공지 판별 — 서버(api/notices.js)와 화면(index.html)이 같은 규칙을 쓴다.
// 같은 공지: 마감일이 같고 제목을 정규화하면 똑같음 → 저장 차단
// 비슷한 공지: 마감일이 같고 제목 유사도 ≥ 0.75 → 경고만 (다른 장학금일 수도 있어 막지 않음)

// [말머리], (괄호), 공백·기호를 지운 제목
export const normTitle = s => String(s || '').toLowerCase()
  .replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, '')
  .replace(/[^0-9a-z가-힣]/g, '');

const bigrams = s => {
  const m = new Map();
  for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); }
  return m;
};

// 두 글자 묶음(bigram) 겹침 비율(Dice 계수), 0~1
export function similarity(a, b) {
  a = normTitle(a); b = normTitle(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a), B = bigrams(b);
  let hit = 0;
  for (const [k, v] of A) hit += Math.min(v, B.get(k) || 0);
  return (2 * hit) / (a.length - 1 + b.length - 1);
}

const sameDay = (a, b) => (a.deadline || '') === (b.deadline || '');
export const isSame = (a, b) => sameDay(a, b) && normTitle(a.title) !== '' && normTitle(a.title) === normTitle(b.title);

// 가장 비슷한 기존 공지 하나: { notice, same } 또는 null
export function findDup(n, list, threshold = 0.75) {
  let best = null, bestScore = 0;
  for (const x of list) {
    if (x.id === n.id || !sameDay(x, n)) continue;
    const s = similarity(x.title, n.title);
    if (s > bestScore) { best = x; bestScore = s; }
  }
  if (!best || bestScore < threshold) return null;
  return { notice: best, same: isSame(best, n) };
}

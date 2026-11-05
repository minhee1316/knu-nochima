// 강원대 공개 게시판(www.kangwon.ac.kr/ko/bbs/…) HTML 파서. 공식 API가 없어 공개 페이지를 읽는다.
// robots.txt(2026-11 확인): /ko/ 허용. 로그인·저장 경로와 /neibis-api/는 쓰지 않는다.

import { tagsFor } from '../lib/tags.js';

export const BASE = 'https://www.kangwon.ac.kr';

// AI 요약이 없을 때 카드에 보일 본문 앞부분 (인사말·빈 줄 제외, 3줄)
export const snippetOf = body => String(body || '').split('\n').map(s => s.trim())
  .filter(s => s.length >= 6 && !/^(안녕|아래와 같이|다음과 같이|붙임|※\s*문의)/.test(s)).slice(0, 3).join('\n').slice(0, 160);
// 같은 글이 두 메뉴에 걸린 게시판(750=721, 718=720)은 하나만 쓴다.
export const BOARDS = [
  { id: 721, name: '장학공지', type: '장학금' },
  { id: 719, name: '공모안내', type: '공모전' },
  { id: 715, name: '행사안내', type: '비교과' },
  { id: 720, name: '학사공지', type: '공지' },
  // 일반공지에는 장학·공모·비교과가 섞여 있어 종류는 AI가 정한다(mixed)
  { id: 504, name: '일반공지', type: '공지', mixed: true },
  // 취업정보: 채용·인턴·취업 프로그램·설명회 (교육·행사 글은 lib/categories.js 규칙이 교육·행사로 옮김)
  { id: 717, name: '취업정보', type: '대외활동', tags: ['취업·진로'] }
];
const CAMPUS = ['춘천', '삼척', '도계', '강릉', '원주'];

const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
export const decode = s => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

// HTML → 줄바꿈을 살린 일반 텍스트
export const toText = html => decode(String(html)
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
  .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n')
  .replace(/<\/t[dh]>/gi, '\t')
  .replace(/<[^>]+>/g, ''))
  .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const campusesIn = block => {
  const found = [...block.matchAll(/photo-chip[^>]*>\s*([^<]+?)\s*</g), ...block.matchAll(/label-status campus[^>]*aria-label="([^"]+)"/g)].map(m => m[1].trim());
  return [...new Set(found.flatMap(c => CAMPUS.filter(k => c.includes(k))))];
};

// 목록 페이지 → [{ sn, title, posted, dept, campus[], pinned }]
export function parseList(html) {
  const rows = [];
  for (const tr of html.split(/<tr[\s>]/i).slice(1)) {
    const a = tr.match(/data-sn="(\d+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    // 캠퍼스 칩·공지 표시·제목 칸을 뺀 나머지 칸에서 등록일과 부서를 찾는다
    const raw = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
    const cells = raw.filter(h => !/photo-chip|label-status|class="noti"|data-sn=/.test(h)).map(toText);
    const posted = (cells.find(c => /^\d{4}\.\d{2}\.\d{2}/.test(c)) || '').slice(0, 10).replace(/\./g, '-');
    const title = toText(a[2]);
    const dept = cells.find(c => c && !/^[\d,.\s:-]+$/.test(c)) || '';
    rows.push({ sn: a[1], title, posted, dept, campus: campusesIn(tr), pinned: /class="noti"/.test(tr) });
  }
  return rows;
}

// 상세 페이지 → { campus[], dept, phone, body, files[] }
export function parseDetail(html) {
  const field = label => {
    const m = html.match(new RegExp(`<th[^>]*>\\s*(?:<span[^>]*>)?\\s*${label}\\s*(?:</span>)?\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`));
    return m ? m[1] : '';
  };
  const start = html.indexOf('editor-wrap');
  // 본문 끝: 첨부파일 → 버튼 영역 → 만족도 설문 → 푸터 중 먼저 나오는 곳 (첨부가 없으면 버튼 영역에서 끊김)
  const endCands = ['view-file-container', 'view-file-list', 'btn-area', 'satisfy-form', 'id="footer"']
    .map(k => html.indexOf(k, start)).filter(i => i > start).map(i => html.lastIndexOf('<', i));
  const bodyHtml = start < 0 ? '' : html.slice(html.indexOf('>', start) + 1, endCands.length ? Math.min(...endCands) : start + 60000);
  const files = [...html.matchAll(/href="(\/ko\/cmmn\/download\.do\?[^"]+)"[\s\S]{0,400}?view-file-name"?[^>]*>([^<]+)/g)]
    .map(m => ({ name: decode(m[2]).trim(), url: BASE + decode(m[1]) }));
  return {
    campus: campusesIn(field('캠퍼스')),
    dept: toText(field('작성자')),
    phone: toText(field('문의전화')),
    body: toText(bodyHtml).replace(/\s*파일\s*$/, '').slice(0, 8000),
    files
  };
}

// 본문의 '신청기간·접수기간·마감' 줄에서 마지막 날짜를 마감일로 본다. 못 찾으면 ''.
const KEY = /(신청|접수|모집|제출|응모|참가\s*신청)\s*(기간|기한|마감|일정|일)|마감\s*(일|기한)?|기\s*한|까지/;
const TILDE = /[~∼～]\s*([’'‘]?\d{2,4}\s*[.\-/년]\s*)?\d{1,2}\s*[.\-/월]\s*\d{1,2}/;
const DATE = /(?:(20\d{2}|[’'‘]\d{2})\s*[.\-/년]\s*)?(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)\s*일?/g;
export function guessDeadline(text, posted) {
  const base = posted ? new Date(posted + 'T00:00:00') : new Date();
  let best = '';
  for (const line of String(text).split('\n')) {
    // '기간' 줄 또는 제목의 '(~11/13)' 같은 물결표 마감
    const kw = line.search(KEY), k = kw >= 0 ? 0 : line.search(TILDE); // 키워드 줄은 줄 전체, 아니면 물결표부터
    if (kw < 0 && k < 0) continue;
    let year = base.getFullYear(), last = '';
    for (const m of line.slice(k).matchAll(DATE)) {
      const mo = +m[2], d = +m[3];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      if (m[1]) year = m[1].length === 4 ? +m[1] : 2000 + +m[1].slice(1);
      let dt = new Date(year, mo - 1, d);
      if (!m[1] && dt < base - 30 * 864e5) dt = new Date(year + 1, mo - 1, d); // 연도 없는 날짜가 게시일보다 한참 이전이면 다음 해
      last = `${dt.getFullYear()}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    if (last && (!posted || last >= posted)) { best = last; break; } // 게시일 이후인 첫 '기간' 줄을 마감으로
  }
  return best;
}

// AI가 "원문 확인 필요(unknown)"로 둔 조건 중, 원문 전체에 그 조건과 관련된 말이 한 번도 없으면 "제한 없음"으로 바꾼다.
// 예: 특강 공지에 거주·국적 이야기가 전혀 없는데 거주 unknown → 제한 없음. 관련 말이 있으면 그대로 둔다(사람이 확인).
const MENTION = {
  campus: /캠퍼스|춘천|삼척|도계|강릉|원주/, grade: /학년|신입생|졸업\s*예정|졸업생|휴학/, college: /학과|학부|계열|전공|단과대/,
  residence: /자취|기숙|생활관|통학|거주|주거|월세|임차|전세/, status: /외국인|유학생|국적|내국인|교환학생/,
  minGpa: /평점|성적|학점|GPA|백분위/i, maxIncome: /소득|분위|구간|기초생활|차상위|저소득|한부모/
};
export function tightenCond(cond, text) {
  const c = { ...cond }, t = String(text || ''), freed = [];
  if (!t.trim()) return { cond: c, freed }; // 본문이 없으면(이미지 공지) 판단하지 않음
  for (const [k, re] of Object.entries(MENTION)) if (c[k] === 'unknown' && !re.test(t)) { c[k] = null; freed.push(k); }
  return { cond: c, freed };
}

// 공지 본문(과 첨부 판독 글)에서 학사 기준을 근거 문장과 함께 뽑는다 (팀원 판정 규칙을 옮겨 옴).
// 숫자 기준만, 근거 문장이 있을 때만. "강원대학교 재학생"이 본문 아무 데나 있다고 재학 조건으로 보지 않는다(휴학생 오판 방지).
const cmp = v => String(v || '').replace(/\s+/g, ' ').trim();
export function extractRules(text, fromAttachment = false) {
  const lines = String(text || '').split(/\n+/).map(cmp).filter(Boolean), rules = [];
  const add = (field, re, label) => { for (const l of lines) { const m = l.match(re); if (m) { rules.push({ field, min: Number(m[1]), evidence: l.slice(0, 160), label, fromAttachment }); break; } } };
  add('lastGpa', /직전\s*학기[^\n]{0,65}?(?:평점\s*평균|평균\s*평점)[^\d\n]{0,12}(\d(?:\.\d{1,2})?)\s*(?:점)?\s*이상/, '직전 학기 평점');
  add('cumulativeGpa', /(?:전체\s*학기|전체\s*평균|총\s*평균)[^\n]{0,45}?(?:평점\s*평균|평균\s*평점|평점)[^\d\n]{0,12}(\d(?:\.\d{1,2})?)\s*(?:점)?(?:\([^)]*\))?\s*이상/, '전체 평균평점');
  add('lastCredits', /직전\s*학기\s*(?:이수|취득)\s*학점\s*(\d{1,2}(?:\.\d)?)\s*학점\s*이상/, '직전 학기 이수학점');
  add('earnedCredits', /(?:총|전체)\s*(?:이수|취득)\s*학점\s*(\d{1,3}(?:\.\d)?)\s*학점\s*이상/, '총 취득학점');
  add('completedSemesters', /(?:정규\s*)?(\d{1,2})\s*학기\s*이상\s*이수/, '이수 학기 수');
  add('incomeBracket', /(?:학자금\s*지원\s*구간|소득\s*분위)[^\n]{0,20}?(\d{1,2})\s*(?:구간|분위)?\s*이하/, '학자금 지원구간');
  add('lastPercentile', /직전\s*학기[^\n]{0,18}(?:백분위|백분율|백점\s*환산)[^\d\n]{0,8}(\d{2,3})(?:점)?\s*이상/, '직전 학기 백분위');
  const elig = lines.filter(l => /신청\s*대상|지원\s*자격|자격\s*기준|지원\s*대상|선발\s*대상/.test(l)).join(' ');
  const ys = elig.match(/(\d)\s*학년\s*(1|2)\s*학기\s*(?:재학생|대상|에\s*재학)/);
  if (ys) rules.push({ field: 'currentSemester', expected: ys[2], evidence: elig.slice(0, 160), label: '현재 학기', fromAttachment });
  if (/학부생만|학부생\s*한정|대학원생\s*제외/.test(elig)) rules.push({ field: 'program', expected: '학부', evidence: elig.slice(0, 160), label: '학위 과정', fromAttachment });
  if (/대학원생만|대학원생\s*한정/.test(elig)) rules.push({ field: 'program', expected: '대학원', evidence: elig.slice(0, 160), label: '학위 과정', fromAttachment });
  if (/재학생(?:만|에\s*한함)/.test(elig) && !/휴학생/.test(elig)) rules.push({ field: 'academic', expected: '재학', evidence: elig.slice(0, 160), label: '학적 상태', fromAttachment });
  return rules;
}

// 게시판 글 + 상세 → 화면용 공지(AI 분석 전 기본값)
export function toNotice(board, row, det) {
  const campus = det.campus.length ? det.campus : row.campus;
  return {
    id: `${board.id}-${row.sn}`,
    type: board.type,
    source: board.name,
    title: row.title.replace(/\s+/g, ' ').trim(),
    org: det.dept || row.dept || '',
    phone: det.phone || '',
    posted: row.posted,
    amount: 0,
    deadline: guessDeadline(row.title + '\n' + det.body, row.posted),
    cond: { campus: campus.length && campus.length < CAMPUS.length ? campus : null, grade: null, college: null, residence: null, status: null, minGpa: null, maxIncome: null },
    docs: [],
    summary: '',
    snippet: snippetOf(det.body),
    body: String(det.body || '').slice(0, 1800), // 곰두리 공지 Q&A의 근거 문장용 (앞부분만)
    tags: [...new Set([...tagsFor(row.title + '\n' + det.body), ...(board.tags || [])])],
    files: det.files,
    imageOnly: String(det.body || '').trim().length < 30, // 본문이 이미지·첨부뿐이라 글로 읽을 내용이 없음
    url: `${BASE}/ko/bbs/${board.id}/detail.do?pstSn=${row.sn}`,
    aiPending: true
  };
}

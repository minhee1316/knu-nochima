// 커뮤니티 데이터 수집 → data/community.json (build.mjs가 공지에 '커뮤니티 언급'을 붙이고, 새 기회를 '커뮤니티' 탭에 넣는다)
// 출처: 카카오(다음) 검색 API(블로그·카페) 또는 네이버 검색 API(지식iN·카페·블로그) — 공식 허용 방식.
// (네이버 검색 API는 2026-11 기준 새 신청이 NAVER API Hub(네이버 클라우드)로 옮겨져, 키 하나로 되는 카카오를 먼저 쓴다) 에브리타임처럼 로그인이 필요한 개인 글은 수집하지 않는다.
// 글 내용은 제목·요약·링크만 쓰고, 사실(자격·마감)은 공식 공고에서 확인하라고 표시한다.
// 키: .env의 KAKAO_REST_KEY (developers.kakao.com → 애플리케이션 추가 → REST API 키) 또는 NAVER_CLIENT_ID·NAVER_CLIENT_SECRET
// 실행: node scripts/community.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SRC = { kin: '네이버 지식iN', cafearticle: '네이버 카페', blog: '네이버 블로그' };
const KSRC = { blog: '다음 블로그', cafe: '다음 카페' };
// 카카오 응답(documents): title, contents, url, blogname/cafename, datetime(ISO)
export const toKakaoPost = (src, d) => ({ src: KSRC[src] || src, title: clean(d.title), desc: clean(d.contents).slice(0, 200), link: d.url,
  date: /^\d{4}-\d{2}-\d{2}/.test(d.datetime || '') ? d.datetime.slice(0, 10) : '', by: clean(d.blogname || d.cafename || '') });
const STOP = new Set(['안내', '모집', '선발', '공고', '신청', '접수', '대학생', '학생', '학생들', '강원대학교', '강원대', '프로그램', '참가자', '참여자', '개최', '운영', '관련', '대상', '학년도', '학기', '연장', '변경', '추가', '결과', '공지', '모집안내', '선발안내', '희망자', '수강', '재학생', '춘천', '삼척', '캠퍼스', '2학기', '1학기', '및', '등', '위한', '대한']);
export const clean = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
// 공지 제목 → 커뮤니티 글에서 찾을 핵심 단어 (연도·괄호 기호·흔한 말 제외)
export const coreWords = title => [...new Set(clean(title).replace(/20\d{2}|\d+기|\d+차|\d+회/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ')
  .map(w => w.replace(/(을|를|은|는|이|가|의|에|에서|으로|와|과)$/, '')).filter(w => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)))].slice(0, 5);
export const toPost = (src, it) => ({ src: SRC[src] || src, title: clean(it.title), desc: clean(it.description).slice(0, 200), link: it.link,
  date: /^\d{8}$/.test(it.postdate || '') ? `${it.postdate.slice(0, 4)}-${it.postdate.slice(4, 6)}-${it.postdate.slice(6, 8)}` : '', by: clean(it.cafename || it.bloggername || '') });
// 글이 그 공지 얘기인지: 핵심 단어 2개 이상이 제목·요약에 함께 나와야 함(한 단어 우연 일치 방지)
export function mentions(notice, posts) {
  const ws = coreWords(notice.title);
  if (ws.length < 2) return [];
  return posts.filter(p => { const t = (p.title + ' ' + p.desc).toLowerCase(); return ws.filter(w => t.includes(w.toLowerCase())).length >= 2; });
}
// 학교 게시판에 없는 새 기회: 날짜가 있는 최근 글 중 모집·공모 글만 (마감·자격은 모르므로 '공식 공고 확인 필요')
const RECRUIT = /(장학생|장학금|장학).{0,12}(모집|선발|신청|접수)|(공모전|경진대회|서포터즈|대외활동).{0,12}(모집|접수|개최|공고)|(모집|접수).{0,8}(장학|공모전)/;
export function discover(posts, used, today, max = 15) {
  const since = new Date(new Date(today + 'T00:00:00Z').getTime() - 30 * 864e5).toISOString().slice(0, 10), seen = new Set();
  return posts.filter(p => p.date && p.date >= since && RECRUIT.test(p.title) && !used.has(p.link))
    .filter(p => { const k = p.title.replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max).map((p, i) => ({
      id: `comm-${p.date}-${i}`, kind: 'community', type: /장학/.test(p.title) ? '장학금' : '공모전', source: p.src, org: p.by, region: '전국', title: p.title,
      posted: p.date, deadline: '', amount: 0, docs: [], files: [], tags: [], snippet: p.desc, url: p.link, aiPending: false,
      cond: { campus: null, grade: null, college: null, residence: null, status: null, minGpa: null, maxIncome: null },
      summary: `누가: 커뮤니티 글 (공식 공고에서 자격 확인 필요)\n내용: ${p.desc.slice(0, 120)}\n신청: 공식 공고 확인`
    }));
}

async function main() {
  const file = p => fileURLToPath(new URL(p, import.meta.url));
  try { process.loadEnvFile(file('../.env')); } catch { /* .env 없음 */ }
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET, kakao = process.env.KAKAO_REST_KEY;
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const out = { collectedAt: new Date().toISOString(), ok: false, error: '', posts: [], byNotice: {} };
  out.provider = kakao ? '카카오(다음) 검색 API' : '네이버 검색 API';
  if (!kakao && (!id || !secret)) { out.error = '검색 API 키 없음 (KAKAO_REST_KEY 또는 NAVER_CLIENT_ID·SECRET)'; await writeFile(file('../data/community.json'), JSON.stringify(out, null, 1)); return console.log(out.error); }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let calls = 0;
  const search = async (src, query, display = 20, sort = 'sim') => {
    calls++; await sleep(120); // 초당 10회 한도 아래로
    if (kakao) {
      const r = await fetch(`https://dapi.kakao.com/v2/search/${src}?` + new URLSearchParams({ query, size: Math.min(display, 50), sort: sort === 'date' ? 'recency' : 'accuracy' }),
        { headers: { Authorization: `KakaoAK ${kakao}` }, signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`${r.status} ${j.errorType || ''} ${j.message || ''}`.trim());
      return (j.documents || []).map(d => toKakaoPost(src, d));
    }
    const r = await fetch(`https://openapi.naver.com/v1/search/${src}.json?` + new URLSearchParams({ query, display, sort }),
      { headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }, signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${r.status} ${j.errorCode || ''} ${j.errorMessage || ''}`.trim());
    return (j.items || []).map(it => toPost(src, it));
  };
  try {
    // ① 공지별: 핵심 단어로 찾아 실제로 그 공지 얘기인 글만 센다
    const { notices } = JSON.parse(await readFile(file('../data/notices.json'), 'utf8'));
    for (const n of notices.filter(n => !n.kind)) {
      const ws = coreWords(n.title); if (ws.length < 2) continue;
      const q = ws.slice(0, 3).join(' '), found = [];
      for (const src of kakao ? ['cafe', 'blog'] : ['cafearticle', 'kin', 'blog']) found.push(...await search(src, q, 10));
      const hit = mentions(n, found);
      if (hit.length) out.byNotice[n.id] = hit.slice(0, 5).map(({ src, title, link, date }) => ({ src, title, link, date }));
    }
    // ② 새 기회: 강원대·대학생 장학·공모 최신 글
    for (const q of ['강원대 장학금', '강원대 공모전', '강원대학교 장학생 모집', '대학생 장학생 모집', '대학생 공모전 모집', '강원 대학생 지원사업'])
      for (const src of kakao ? ['blog', 'cafe'] : ['blog', 'cafearticle']) out.posts.push(...await search(src, q, 30, 'date'));
    out.ok = true;
  } catch (e) { out.error = e.message; }
  await writeFile(file('../data/community.json'), JSON.stringify(out, null, 1));
  console.log(`저장: data/community.json — 언급 붙은 공지 ${Object.keys(out.byNotice).length}건, 최신 글 ${out.posts.length}건, API 호출 ${calls}회${out.error ? ' · 오류: ' + out.error : ''}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

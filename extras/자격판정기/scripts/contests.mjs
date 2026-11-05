// 외부 공모전·대외활동·인턴 사이트 '당일 스냅샷' → data/contests.json (build.mjs가 공모전·대외활동으로 합친다)
// 사용 기준(2026-11-06 확인):
//  - robots.txt가 일반 수집을 허용하고, 로그인 없이 목록이 보이는 곳만: 위비티·씽유·링커리어
//  - 제외: 올포영(robots.txt가 AI 수집기를 명시적으로 차단), 캠퍼스픽(에브리커리어=에브리타임 운영사, 에브리타임과 같은 이유),
//          올콘·스펙토리(목록이 스크립트로만 그려져 페이지 글에 없음)
//  - 사실 정보만: 제목·주최·접수 기간·분야·원문 링크. 포스터 이미지·상세 설명은 가져오지 않는다(저작권).
//  - 사이트마다 목록 첫 페이지 1번만, 1초 간격, 최대 30건 (DB 통째 복제 방지). 출처와 수집일을 화면에 표시한다.
// 실행: node scripts/contests.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tagsFor } from '../lib/tags.js';
import { normTitle } from '../lib/dup.js';

const MAX = 30;
const dec = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const addDays = (today, n) => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const COND0 = { campus: null, grade: null, college: null, residence: null, status: null, minGpa: null, maxIncome: null };
const item = (site, o, today) => ({
  id: `ct-${site.key}-${o.sid}`, kind: 'contest', type: site.type || '공모전', source: site.label || site.name, org: o.org || '', region: '전국', title: o.title,
  start: o.start || '', deadline: o.deadline || '', posted: today, amount: 0, docs: [], files: [], snippet: '', aiPending: false, cond: { ...COND0 },
  tags: [...new Set([...tagsFor(`${o.title} ${o.field || ''}`), ...(site.tags || [])])], url: o.url,
  summary: `누가: 원문 사이트에서 ${site.type === '대외활동' ? '지원' : '참가'} 자격 확인\n내용: ${o.field ? '분야 ' + o.field : site.kindName || '공모전'} · ${site.type === '대외활동' ? '기관' : '주최'} ${o.org || '원문 확인'}\n신청: ${o.start ? o.start + ' ~ ' : ''}${o.deadline || '마감 원문 확인'} · ${site.name}`
});

// 위비티: <li> 안에 tit(제목·링크·분야) / organ(주최) / day(D-n)
export function parseWevity(html, today) {
  const out = [];
  for (const m of html.matchAll(/<li[^>]*>\s*(?:<!--[^>]*-->)?\s*<div class="tit">\s*<a href="([^"]*ix=(\d+)[^"]*)">([\s\S]*?)<\/a>\s*(?:<div class="sub-tit">([\s\S]*?)<\/div>)?[\s\S]*?<div class="organ">([\s\S]*?)<\/div>\s*<div class="day">\s*D-(\d+)/g)) {
    const title = dec(m[3].replace(/<span[\s\S]*?<\/span>/g, ''));
    if (/이벤트/.test(title)) continue; // 경품 이벤트는 공모전이 아님
    out.push({ sid: m[2], title, field: dec(m[4]).replace(/^분야\s*:\s*/, ''), org: dec(m[5]), deadline: addDays(today, +m[6]),
      url: `https://www.wevity.com/index.php?c=find&s=1&gub=1&gbn=view&ix=${m[2]}` });
  }
  return out;
}
// 씽유: div.tr 안에 /contest/ID 링크, h3 제목, '주최 : ', 기간 yy-mm-dd ~ yy-mm-dd
export function parseThinkyou(html) {
  const out = [], y = s => `20${s}`;
  for (const m of html.matchAll(/<a href="\/contest\/(\d+)\/[^"]*">\s*<dl>\s*<dt><h3>([\s\S]*?)<\/h3><\/dt>\s*<dd>주최\s*:\s*([\s\S]*?)<\/dd>[\s\S]*?<div class="etc">(\d{2}-\d{2}-\d{2})\s*~\s*(\d{2}-\d{2}-\d{2})<\/div>/g))
    out.push({ sid: m[1], title: dec(m[2]), org: dec(m[3]), start: y(m[4]), deadline: y(m[5]), url: `https://thinkyou.co.kr/contest/${m[1]}/` });
  return out;
}
// 링커리어: 페이지에 들어 있는 데이터(__NEXT_DATA__)의 Activity 항목
export function parseLinkareer(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const d = JSON.parse(m[1]), ap = d.props?.pageProps?.__APOLLO_STATE__ || d.props?.apolloState || {};
  const kst = ms => new Date(+ms + 9 * 3600e3).toISOString().slice(0, 10);
  return Object.entries(ap).filter(([k, a]) => k.startsWith('Activity:') && a.title && a.recruitCloseAt)
    .map(([, a]) => ({ sid: a.id, title: dec(a.title), org: dec(a.organizationName), deadline: kst(a.recruitCloseAt), start: a.recruitStartAt ? kst(a.recruitStartAt) : '',
      url: `https://linkareer.com/activity/${a.id}` }));
}

export const SITES = [
  { key: 'wevity', name: '위비티', url: 'https://www.wevity.com/index.php?c=find&s=1&gub=1', parse: parseWevity },
  { key: 'thinkyou', name: '씽유', url: 'https://thinkyou.co.kr/contest/', parse: parseThinkyou },
  { key: 'linkareer', name: '링커리어', url: 'https://linkareer.com/list/contest', parse: parseLinkareer },
  // 대외활동·인턴도 같은 방식(같은 사이트·같은 데이터 구조): 서포터즈·기자단·모니터링단 / 채용연계형·체험형 인턴
  { key: 'linkareer-act', name: '링커리어', label: '링커리어 대외활동', type: '대외활동', kindName: '대외활동', url: 'https://linkareer.com/list/activity', parse: parseLinkareer },
  { key: 'linkareer-intern', name: '링커리어', label: '링커리어 인턴', type: '대외활동', kindName: '인턴', tags: ['취업·진로'], url: 'https://linkareer.com/list/intern', parse: parseLinkareer }
];
// 같은 공모전이 여러 사이트에 있으면 하나만 (먼저 나온 사이트 기준, 다른 출처는 alsoOn)
export function merge(lists, today) {
  const seen = new Map(), out = [];
  for (const { site, rows } of lists)
    for (const r of rows.filter(r => r.title && (!r.deadline || r.deadline >= today)).slice(0, MAX)) {
      const k = normTitle(r.title).replace(/\s+/g, '');
      if (seen.has(k)) { const x = seen.get(k); if (!x.alsoOn.includes(site.name)) x.alsoOn.push(site.name); continue; }
      const it = { ...item(site, r, today), alsoOn: [] }; seen.set(k, it); out.push(it);
    }
  return out;
}

async function main() {
  const file = p => fileURLToPath(new URL(p, import.meta.url));
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), lists = [], sources = {};
  for (const site of SITES) {
    try {
      const r = await fetch(site.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KNU-hackathon-student-project; one-time snapshot)' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const rows = site.parse(await r.text(), today);
      if (!rows.length) throw new Error('목록을 읽지 못함(사이트 구조 변경?)');
      lists.push({ site, rows }); sources[site.label || site.name] = { ok: true, read: rows.length, url: site.url };
    } catch (e) { sources[site.label || site.name] = { ok: false, error: e.message, url: site.url }; }
    console.log(site.label || site.name, JSON.stringify(sources[site.label || site.name]));
    await new Promise(r => setTimeout(r, 1000));
  }
  const items = merge(lists, today);
  for (const s of Object.values(sources)) if (s.ok) s.used = 0;
  for (const it of items) sources[it.source].used++;
  await writeFile(file('../data/contests.json'), JSON.stringify({ collectedAt: new Date().toISOString(), date: today, sources, items }, null, 1));
  console.log(`저장: data/contests.json — 외부 공모전 ${items.filter(i => i.type === '공모전').length}건 · 대외활동·인턴 ${items.filter(i => i.type === '대외활동').length}건 (${today} 기준)`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

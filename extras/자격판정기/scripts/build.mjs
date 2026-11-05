// data/raw.json → data/notices.json (화면이 읽는 파일)
// GEMINI_API_KEY가 있으면 AI로 자격 조건을 분석하고, 없으면 규칙(마감일·캠퍼스)만 채운다.
// 이미 AI로 분석한 공지는 다시 호출하지 않는다(무료 한도 절약).
// 실행: node scripts/build.mjs [--no-ai] [--limit 10]
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { toNotice, tightenCond, extractRules } from './knu.mjs';
import { analyze } from '../api/extract.js';
import { perksOf } from '../lib/gomduri.js';
import { discover } from './community.mjs';
import { applyCategories } from '../lib/categories.js';

const file = p => fileURLToPath(new URL(p, import.meta.url));
try { process.loadEnvFile(file('../.env')); } catch { /* .env 없음 */ }
const env = process.env;
const useAI = !!env.GEMINI_API_KEY && !process.argv.includes('--no-ai');
const li = process.argv.indexOf('--limit'), LIMIT = li > 0 ? Number(process.argv[li + 1]) : Infinity;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const raw = JSON.parse(await readFile(file('../data/raw.json'), 'utf8'));
let prev = new Map();
try { prev = new Map(JSON.parse(await readFile(file('../data/notices.json'), 'utf8')).notices.filter(n => !n.aiPending).map(n => [n.id, n])); } catch { /* 처음 */ }

const out = [];
let called = 0, failed = 0;
for (const { board, row, det } of raw.items) {
  const n = toNotice(board, row, det);
  const cached = prev.get(n.id);
  if (cached) { out.push({ ...n, ...pick(cached), ...(board.mixed ? { type: cached.type } : {}), aiPending: false }); continue; }
  // 춘천·삼척이 아닌 캠퍼스 전용 글은 어차피 아래에서 빠지므로 AI 무료 한도를 쓰지 않는다
  if (Array.isArray(n.cond?.campus) && !n.cond.campus.some(c => ['춘천', '삼척'].includes(c))) { out.push(n); continue; }
  if (useAI && called < LIMIT) {
    called++;
    let r = await analyze(`제목: ${n.title}\n작성 부서: ${n.org}\n게시일: ${n.posted}\n\n${det.body}`, null, env);
    if (r.status === 429) { console.log('  무료 한도 대기 60초…'); await sleep(60000); r = await analyze(`제목: ${n.title}\n\n${det.body}`, null, env); }
    if (r.status === 200) {
      const a = r.json.notice;
      Object.assign(n, {
        type: board.mixed ? a.type : n.type, // 일반공지처럼 종류가 섞인 게시판은 AI 판단을 쓴다
        cond: { ...a.cond, campus: a.cond.campus ?? n.cond.campus }, // 게시판의 캠퍼스 표시는 AI보다 확실
        amount: a.amount, docs: a.docs, summary: a.summary,
        tags: a.tags.length ? a.tags : n.tags,
        deadline: a.deadline || n.deadline, aiPending: false
      });
      console.log(`  ✓ ${n.title.slice(0, 40)}`);
    } else { failed++; console.warn(`  ✕ ${n.title.slice(0, 40)}: ${r.json.error}`); }
    await sleep(6500); // 무료 티어 분당 한도 아래로
  }
  out.push(n);
}
function pick(c) { return { cond: c.cond, amount: c.amount, docs: c.docs, summary: c.summary, deadline: c.deadline, tags: c.tags }; }

// 지역 행사(scripts/events.mjs)를 공지와 같은 모양으로 합친다. 자격 제한 없는 '누구나' 행사로 둔다.
let ev = null;
try { ev = JSON.parse(await readFile(file('../data/events.json'), 'utf8')); } catch { /* 지역 행사 없음 */ }
// 정부·기관 지원사업(scripts/gov.mjs: 한국장학재단·보조금24·K-Startup·온통청년) + 전국문화축제(춘천·삼척)
let gov = null;
try { gov = JSON.parse(await readFile(file('../data/gov.json'), 'utf8')); } catch { /* 아직 수집 안 함 */ }
const evTitles = new Set((ev?.events || []).map(e => e.title.replace(/\s+/g, '')));
const allEvents = [...(ev?.events || []), ...(gov?.events || []).filter(e => !evTitles.has(e.title.replace(/\s+/g, '')))]; // 같은 축제는 한 번만
for (const g of gov?.items || []) out.push(g);
// 외부 공모전 사이트 당일 스냅샷(scripts/contests.mjs: 위비티·씽유·링커리어) — 학교 공지와 같은 공모전이면 학교 공지만 남김
let contests = null;
try { contests = JSON.parse(await readFile(file('../data/contests.json'), 'utf8')); } catch { /* 아직 수집 안 함 */ }
const ownTitles = new Set(out.map(n => n.title.replace(/\s+/g, '')));
for (const c of contests?.items || []) if (!ownTitles.has(c.title.replace(/\s+/g, ''))) out.push(c);
for (const e of allEvents) out.push({
  id: e.id, kind: 'event', ...(e.sample ? { sample: true } : {}), type: '지역행사', source: e.source, region: e.region, title: e.title, org: e.source, phone: e.tel || '',
  posted: '', start: e.start, amount: 0, deadline: e.end,
  cond: { campus: null, grade: null, college: null, residence: null, status: null, minGpa: null, maxIncome: null },
  docs: [], summary: `누가: 누구나 (${e.region} 지역 주민·방문객·학생)\n내용: ${e.start === e.end ? e.start : `${e.start} ~ ${e.end}`} · ${e.category || `${e.region} 지역 행사`}${e.place ? ` · ${e.place}` : ''}\n신청: ${e.fee ? `요금 ${e.fee} · ` : ''}자세한 내용은 주최 기관 원문에서 확인`,
  snippet: '', tags: [], files: [], url: e.url, aiPending: false
});

// 지금은 춘천·삼척 위주: 다른 캠퍼스 전용 공지와 다른 지역 행사는 뺀다 (캠퍼스 제한 없는 공지는 유지)
const CAMPUS_NOW = ['춘천', '삼척'];
for (let i = out.length - 1; i >= 0; i--) {
  const n = out[i], c = n.cond?.campus;
  if (n.kind === 'event' ? !CAMPUS_NOW.includes(n.region) : Array.isArray(c) && !c.some(x => CAMPUS_NOW.includes(x))) out.splice(i, 1);
}
// 첨부 판독본(data/doc_scan.json: 팀원이 첨부 PDF 텍스트 추출·OCR로 만든 글)
let SCAN = {};
try { SCAN = JSON.parse(await readFile(file('../data/doc_scan.json'), 'utf8')).scan || {}; } catch { /* 없음 */ }
for (const n of out) n.perks = n.kind === 'event' ? [] : perksOf(n);
// "확인 필요" 줄이기: 원문 전체(최대 8천 자)에 관련 말이 없는 unknown 조건은 제한 없음으로
const fullText = new Map(raw.items.map(({ board, row, det }) => [`${board.id}-${row.sn}`, row.title + '\n' + det.body]));
let freedN = 0, ruleN = 0;
for (const n of out) {
  if (n.kind === 'event') continue;
  if (SCAN[n.id]) n.scan = SCAN[n.id].map(d => ({ name: d.name, url: d.url, method: d.method, lines: d.lines.slice(0, 8) }));
  // 학사 기준(평점·이수학점·학기 등): 본문 전체 + 첨부 판독 글에서 근거 문장과 함께
  const rules = [...extractRules(fullText.get(n.id) || n.body || ''), ...extractRules((n.scan || []).flatMap(d => d.lines).join('\n'), true)];
  const seen = new Set();
  n.rules = rules.filter(r => { const k = r.field + (r.min ?? r.expected); if (seen.has(k)) return false; seen.add(k); return true; })
    .filter(r => !(r.field === 'lastGpa' && Number(n.cond?.minGpa) === r.min) && !(r.field === 'incomeBracket' && Number(n.cond?.maxIncome) === r.min));
  ruleN += n.rules.length;
}
for (const n of out) if (n.cond && fullText.has(n.id) && !n.aiPending) { const r = tightenCond(n.cond, fullText.get(n.id)); n.cond = r.cond; freedN += r.freed.length; }
console.log(`원문에 언급이 없는 "원문 확인 필요" 조건 ${freedN}개를 제한 없음으로 정리 · 학사 기준 ${ruleN}개 추출 · 첨부 판독 ${Object.keys(SCAN).length}건`);
// 종류 정리: 사람이 검토한 data/categories.json(종류·관심 분야·중복/광고 숨김) → 검토 전 새 글은 lib/categories.js 규칙
let REVIEW = {};
try { REVIEW = JSON.parse(await readFile(file('../data/categories.json'), 'utf8')).items || {}; } catch { /* 검토본 없음 */ }
{ const r = applyCategories(out, REVIEW); out.splice(0, out.length, ...r.list); console.log(`종류 정리: 검토본 ${r.byReview}건 · 규칙 ${r.byRule}건 · 중복/광고 숨김 ${r.hidden}건`); }
// 커뮤니티(scripts/community.mjs: 네이버 검색 API): 공지마다 언급 글을 붙이고, 게시판에 없는 새 모집 글은 '커뮤니티' 항목으로
let comm = null;
try { comm = JSON.parse(await readFile(file('../data/community.json'), 'utf8')); } catch { /* 아직 수집 안 함 */ }
const used = new Set();
for (const n of out) { const m = comm?.byNotice?.[n.id]; if (m?.length) { n.community = m; m.forEach(x => used.add(x.link)); } }
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const found = comm?.ok ? discover(comm.posts || [], used, today) : [];
out.push(...found);
console.log(`커뮤니티: ${comm ? (comm.ok ? `언급 붙은 공지 ${out.filter(n => n.community).length}건 · 새 모집 글 ${found.length}건` : '수집 안 됨 — ' + comm.error) : 'data/community.json 없음'}`);
out.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
await writeFile(file('../data/notices.json'), JSON.stringify({
  collectedAt: raw.collectedAt, eventsAt: ev?.collectedAt || null, govAt: gov?.collectedAt || null, govSources: gov?.sources || null, govStats: gov?.stats || null, communityAt: comm?.collectedAt || null, contestsDate: contests?.date || null, contestsSources: contests?.sources || null, communityOk: !!comm?.ok, communityProvider: comm?.provider || '', communityError: comm?.error || '', builtAt: new Date().toISOString(),
  analyzed: out.filter(n => !n.aiPending && !n.kind).length, notices: out
}, null, 1));
const withDl = out.filter(n => n.deadline).length;
console.log(`저장: data/notices.json — ${out.length}건 (마감일 확인 ${withDl}건, AI 분석 ${out.filter(n => !n.aiPending && !n.kind).length}건, 지역 행사 ${ev?.events?.length || 0}건${useAI ? `, 이번 호출 ${called}회·실패 ${failed}회` : (env.GEMINI_API_KEY ? ', --no-ai: AI 호출 안 함' : ', GEMINI_API_KEY 없음: 규칙만 적용')})`);

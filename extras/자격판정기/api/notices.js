// 공유 공지 목록 (Supabase). GET: 목록, POST: 학생이 추가(검토 전 상태).
// 필요한 환경변수: SUPABASE_URL, SUPABASE_SECRET_KEY (서버에만. 브라우저 코드에 넣지 않음)
import { normalize } from './extract.js';
import { isSame } from '../lib/dup.js';
import { db, hasDb } from '../lib/db.js';
import { limit, tooMany, reqIp } from '../lib/ratelimit.js';

const ADD_RULES = [
  { name: 'add-h', max: 20, sec: 3600, msg: s => `공지를 너무 많이 추가했어요. ${Math.ceil(s / 60)}분 뒤에 다시 시도해 주세요.` }
];

const LIST_KEYS = ['campus', 'grade', 'college', 'residence', 'status'];

// 화면에서 온 공지(cond 형태)를 AI 원본 형태로 되돌려 같은 검증(normalize)을 다시 통과시킨다.
export function fromNotice(n) {
  const c = n && typeof n.cond === 'object' && n.cond ? n.cond : {};
  const raw = { ...n, unclear: [] };
  for (const k of LIST_KEYS) {
    if (c[k] === 'unknown') { raw.unclear.push(k); raw[k] = []; } else raw[k] = Array.isArray(c[k]) ? c[k] : [];
  }
  for (const k of ['minGpa', 'maxIncome']) {
    if (c[k] === 'unknown') { raw.unclear.push(k); raw[k] = null; } else raw[k] = c[k] ?? null;
  }
  return normalize(raw);
}

const toClient = r => ({
  id: r.id, type: r.type, title: r.title, org: r.org, amount: r.amount, deadline: r.deadline || '',
  cond: r.cond, docs: r.docs, summary: r.summary, tags: r.tags || [], url: r.url, added: r.status === 'pending'
});

export async function notices(body, env, method = 'GET', ip) {
  if (!hasDb(env)) return { status: 503, json: { error: '공유 DB가 설정되지 않았습니다.' } };
  try {
    if (method === 'GET') {
      const r = await db(env, 'notices?select=*&status=neq.rejected&order=deadline.asc.nullslast&limit=500');
      if (!r.ok) return { status: 502, json: { error: `DB 조회 실패 (${r.status})` } };
      return { status: 200, json: { notices: (await r.json()).map(toClient) } };
    }
    if (method === 'POST') {
      const l = await limit(env, ip, ADD_RULES);
      if (!l.ok) return tooMany(l);
      const n = fromNotice(body?.notice);
      // 같은 마감일 공지 중 제목이 같은 것이 있으면 저장하지 않는다 (조회 실패 시엔 저장을 막지 않음)
      const q = await db(env, `notices?select=*&status=neq.rejected&deadline=${n.deadline ? 'eq.' + n.deadline : 'is.null'}&limit=300`);
      if (q.ok) {
        const dup = (await q.json()).find(r => isSame({ ...r, deadline: r.deadline || '' }, n));
        if (dup) return { status: 409, json: { error: '이미 같은 공지가 등록돼 있어요.', duplicate: toClient(dup) } };
      }
      const row = { status: 'pending', type: n.type, title: n.title, org: n.org, amount: n.amount, deadline: n.deadline || null, cond: n.cond, docs: n.docs, summary: n.summary, tags: n.tags };
      const r = await db(env, 'notices', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
      if (!r.ok) return { status: 502, json: { error: `DB 저장 실패 (${r.status})` } };
      return { status: 201, json: { notice: toClient((await r.json())[0]) } };
    }
    return { status: 405, json: { error: 'GET·POST만 지원합니다.' } };
  } catch {
    return { status: 504, json: { error: 'DB 응답이 늦어요.' } };
  }
}

// Vercel 진입점
export default async function handler(req, res) {
  const r = await notices(req.body, process.env, req.method, reqIp(req));
  for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);
  res.status(r.status).json(r.json);
}

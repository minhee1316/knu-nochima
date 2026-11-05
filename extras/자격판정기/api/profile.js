// 로그인한 회원의 '내 조건' 저장·불러오기. GET/PUT /api/profile, Authorization: Bearer <access_token>
// 평점·학자금 지원구간은 민감 정보라 서버에 저장하지 않는다(브라우저에만).
import { db, hasDb } from '../lib/db.js';
import { ROLES, CAMPUSES } from './auth.js';
import { TAGS } from '../lib/tags.js';

const GRADE = ['1', '2', '3', '4'], COLLEGE = ['인문·사회', '자연과학', '공학·IT', '보건·의료', '예술·체육'], RES = ['자취', '기숙사', '통학'], STATUS = ['내국인', '유학생'];
const one = (v, allow) => (allow.includes(v) ? v : null);

export function cleanProfile(p) {
  const r = p && typeof p === 'object' ? p : {};
  return {
    campus: one(r.campus, CAMPUSES), grade: one(String(r.grade ?? ''), GRADE), college: one(r.college, COLLEGE),
    residence: one(r.residence, RES), status: one(r.status, STATUS),
    interests: Array.isArray(r.interests) ? [...new Set(r.interests.filter(t => TAGS.includes(t)))] : []
  };
}

async function whoami(env, headers) {
  const token = String(headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return null;
  const u = await r.json();
  return { id: u.id, role: ROLES.includes(u.user_metadata?.role) ? u.user_metadata.role : '학생' };
}

export async function profile(body, env, method, ip, headers) {
  if (!hasDb(env)) return { status: 503, json: { error: '계정 서버가 설정되지 않았어요.' } };
  try {
    const me = await whoami(env, headers);
    if (!me) return { status: 401, json: { error: '다시 로그인해 주세요.' } };
    if (method === 'GET') {
      const r = await db(env, `profiles?select=campus,grade,college,residence,status,interests&id=eq.${me.id}`);
      if (!r.ok) return { status: 502, json: { error: `프로필 조회 실패 (${r.status})` } };
      const row = (await r.json())[0];
      return { status: 200, json: { profile: row ? cleanProfile(row) : null } };
    }
    if (method === 'PUT') {
      const row = { id: me.id, role: me.role, ...cleanProfile(body?.profile), updated_at: new Date().toISOString() };
      const r = await db(env, 'profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
      if (!r.ok) return { status: 502, json: { error: `프로필 저장 실패 (${r.status})` } };
      return { status: 200, json: { ok: true } };
    }
    return { status: 405, json: { error: 'GET·PUT만 지원합니다.' } };
  } catch {
    return { status: 504, json: { error: '계정 서버 응답이 늦어요.' } };
  }
}

export default async function handler(req, res) {
  const r = await profile(req.body, process.env, req.method, null, req.headers);
  res.status(r.status).json(r.json);
}

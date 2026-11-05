// 자격판정기 전용 계정 (Supabase Auth). 강원대 K-Cloud 계정과 무관하다.
// POST /api/auth {action:'signup'|'login'|'refresh'|'recover', ...}
// - signup: 서버 secret 키로 '확인된' 계정을 만든다(기본 메일은 팀원 주소로만 가서 확인 메일을 쓸 수 없음).
// - 학생·교직원 구분은 본인 선택이다(학교 API 없이 신분을 검증하지 않음).
// - 이름·생년월일·휴대폰·학번은 받지 않는다.
import { limit, tooMany, reqIp } from '../lib/ratelimit.js';
import { hasDb } from '../lib/db.js';

export const ROLES = ['학생', '교직원', '지역주민', '방문객'];
export const CAMPUSES = ['춘천', '삼척', '도계', '강릉', '원주'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
// 강원대 K-Cloud 비밀번호 규칙과 같은 수준: 9자 이상, 영문·숫자·특수문자 모두 포함
export const passwordOk = p => typeof p === 'string' && p.length >= 9 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p) && !/(.)\1\1\1/.test(p);

const authApi = (env, path, init = {}) => fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/${path}`, {
  ...init, headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(10000)
});
const meta = u => ({ id: u.id, email: u.email, role: u.user_metadata?.role || '학생', campus: u.user_metadata?.campus || '', nickname: u.user_metadata?.nickname || '' });
const session = j => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: meta(j.user) });
const fail = (status, error) => ({ status, json: { error } });

const RULES = {
  signup: [{ name: 'su-h', max: 5, sec: 3600, msg: s => `가입 시도가 너무 많아요. ${Math.ceil(s / 60)}분 뒤에 다시 시도해 주세요.` }],
  login: [{ name: 'li-m', max: 10, sec: 300, msg: s => `로그인 시도가 너무 많아요. ${Math.ceil(s / 60)}분 뒤에 다시 시도해 주세요.` }],
  recover: [{ name: 'rc-h', max: 3, sec: 3600, msg: () => '재설정 요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.' }],
  refresh: [{ name: 'rf-m', max: 30, sec: 60, msg: () => '잠시 뒤에 다시 시도해 주세요.' }]
};

async function login(env, email, password) {
  const r = await authApi(env, 'token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (r.status === 400) return fail(401, '이메일 또는 비밀번호가 맞지 않아요.');
  if (!r.ok) return fail(502, `로그인 서버 오류 (${r.status})`);
  return { status: 200, json: session(await r.json()) };
}

export async function auth(body, env, method, ip) {
  if (method !== 'POST') return fail(405, 'POST만 지원합니다.');
  if (!hasDb(env)) return fail(503, '계정 서버(Supabase)가 설정되지 않았어요.');
  const action = String(body?.action || '');
  if (!RULES[action]) return fail(400, '알 수 없는 요청이에요.');
  const email = String(body.email || '').trim().toLowerCase();
  try {
    const l = await limit(env, ip, RULES[action]);
    if (!l.ok) return tooMany(l);

    if (action === 'signup') {
      const { password } = body;
      const role = ROLES.includes(body.role) ? body.role : null;
      const campus = CAMPUSES.includes(body.campus) ? body.campus : '';
      const nickname = String(body.nickname || '').trim().slice(0, 20);
      if (!EMAIL.test(email)) return fail(400, '이메일 형식을 확인해 주세요.');
      if (!passwordOk(password)) return fail(400, '비밀번호는 9자 이상, 영문·숫자·특수문자를 모두 넣어 주세요. 같은 글자를 4번 이상 반복할 수 없어요.');
      if (!role) return fail(400, '구분(학생·교직원·지역주민·방문객)을 골라 주세요.');
      if (body.agree !== true) return fail(400, '개인정보 수집·이용에 동의해야 가입할 수 있어요.');
      const r = await authApi(env, 'admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { role, campus, nickname } }) });
      if (r.status === 422 || r.status === 409) return fail(409, '이미 가입된 이메일이에요. 로그인하거나 비밀번호를 재설정해 주세요.');
      if (!r.ok) return fail(502, `가입 서버 오류 (${r.status})`);
      return login(env, email, password);
    }
    if (action === 'login') {
      if (!EMAIL.test(email) || typeof body.password !== 'string') return fail(400, '이메일과 비밀번호를 입력해 주세요.');
      return login(env, email, body.password);
    }
    if (action === 'refresh') {
      const r = await authApi(env, 'token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: String(body.refresh_token || '') }) });
      if (!r.ok) return fail(401, '다시 로그인해 주세요.');
      return { status: 200, json: session(await r.json()) };
    }
    // recover: 가입 여부를 알려 주지 않도록 결과와 상관없이 같은 답을 준다
    if (EMAIL.test(email)) await authApi(env, 'recover', { method: 'POST', body: JSON.stringify({ email }) }).catch(() => {});
    return { status: 200, json: { ok: true } };
  } catch {
    return fail(504, '계정 서버 응답이 늦어요. 잠시 뒤에 다시 시도해 주세요.');
  }
}

export default async function handler(req, res) {
  const r = await auth(req.body, process.env, req.method, reqIp(req));
  for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);
  res.status(r.status).json(r.json);
}

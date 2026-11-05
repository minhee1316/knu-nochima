// node api/auth.test.mjs — 가짜 Supabase로 가입·로그인·재설정·프로필 확인
import assert from 'node:assert/strict';
import { auth, passwordOk } from './auth.js';
import { profile, cleanProfile } from './profile.js';

assert.ok(passwordOk('knu2026!ok'));
assert.ok(!passwordOk('short1!'));          // 9자 미만
assert.ok(!passwordOk('onlyletters!!'));    // 숫자 없음
assert.ok(!passwordOk('abcd12345'));        // 특수문자 없음
assert.ok(!passwordOk('aaaa1234!x'));       // 같은 글자 4번 반복

const env = { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' };
const calls = [];
const user = { id: 'u1', email: 'a@b.co', user_metadata: { role: '학생', campus: '삼척', nickname: '곰' } };
let mode = 'ok';
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
  if (url.includes('rpc/rate_hit')) return new Response('1');
  if (url.endsWith('/auth/v1/admin/users')) return mode === 'dup' ? new Response('{}', { status: 422 }) : new Response(JSON.stringify(user), { status: 200 });
  if (url.includes('grant_type=password')) return mode === 'badpw' ? new Response('{}', { status: 400 }) : new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user }));
  if (url.endsWith('/auth/v1/recover')) return new Response('{}');
  if (url.endsWith('/auth/v1/user')) return init.headers.Authorization === 'Bearer AT' ? new Response(JSON.stringify(user)) : new Response('{}', { status: 401 });
  if (url.includes('/rest/v1/profiles?select')) return new Response(JSON.stringify([{ campus: '삼척', grade: '3', interests: ['AI·SW', '이상한값'] }]));
  if (url.endsWith('/rest/v1/profiles')) return new Response('', { status: 201 });
  return new Response('{}', { status: 404 });
};
const ok = { action: 'signup', email: 'A@B.co', password: 'knu2026!ok', role: '학생', campus: '삼척', nickname: '곰', agree: true };

let r = await auth(ok, env, 'POST', '1.1.1.1');
assert.equal(r.status, 200);
assert.equal(r.json.access_token, 'AT');
assert.deepEqual(r.json.user, { id: 'u1', email: 'a@b.co', role: '학생', campus: '삼척', nickname: '곰' });
const created = calls.find(c => c.url.endsWith('/admin/users')).body;
assert.equal(created.email, 'a@b.co');            // 소문자로
assert.equal(created.email_confirm, true);         // 확인 메일 없이 바로 사용
assert.equal(created.user_metadata.role, '학생');

assert.equal((await auth({ ...ok, agree: false }, env, 'POST', '1.1.1.2')).status, 400);   // 동의 없음
assert.equal((await auth({ ...ok, password: 'abc' }, env, 'POST', '1.1.1.3')).status, 400);
assert.equal((await auth({ ...ok, role: '관리자' }, env, 'POST', '1.1.1.4')).status, 400);
mode = 'dup'; assert.equal((await auth(ok, env, 'POST', '1.1.1.5')).status, 409);
mode = 'badpw'; assert.equal((await auth({ action: 'login', email: 'a@b.co', password: 'x' }, env, 'POST', '1.1.1.6')).status, 401);
mode = 'ok';
// 재설정: 가입 여부와 상관없이 같은 답
assert.deepEqual((await auth({ action: 'recover', email: 'nobody@x.kr' }, env, 'POST', '1.1.1.7')).json, { ok: true });
assert.equal((await auth({ action: 'hack' }, env, 'POST', '1.1.1.8')).status, 400);
assert.equal((await auth(ok, {}, 'POST', '1.1.1.9')).status, 503);                       // DB 없음

// 프로필: 토큰 확인, 허용값만 저장, 평점·소득은 저장 안 함
assert.equal((await profile({}, env, 'GET', null, {})).status, 401);
r = await profile({}, env, 'GET', null, { authorization: 'Bearer AT' });
assert.deepEqual(r.json.profile.interests, ['AI·SW']);
await profile({ profile: { campus: '삼척', grade: 3, gpa: 4.1, income: 2, interests: ['창업'] } }, env, 'PUT', null, { authorization: 'Bearer AT' });
const saved = calls.filter(c => c.url.endsWith('/rest/v1/profiles')).at(-1).body;
assert.equal(saved.id, 'u1');
assert.equal(saved.grade, '3');
assert.equal('gpa' in saved || 'income' in saved, false);
assert.deepEqual(cleanProfile({ campus: '서울' }).campus, null);
console.log('auth tests ok');

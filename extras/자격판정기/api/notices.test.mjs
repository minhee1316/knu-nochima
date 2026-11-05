// node api/notices.test.mjs — 화면에서 온 공지가 서버 검증을 다시 통과하는지 확인
import assert from 'node:assert/strict';
import { fromNotice, notices } from './notices.js';

const n = fromNotice({
  type: '장학금', title: 'x', org: 'o', amount: 1000, deadline: '2026-12-01', summary: '',
  docs: ['신청서', '<script>'.repeat(30)],
  cond: { campus: ['삼척', '부산'], grade: null, college: 'unknown', residence: null, status: null, minGpa: 'unknown', maxIncome: 99 }
});
assert.deepEqual(n.cond.campus, ['삼척']);      // 허용 안 된 값 제거
assert.equal(n.cond.grade, null);
assert.equal(n.cond.college, 'unknown');        // '확인 필요' 유지
assert.equal(n.cond.minGpa, 'unknown');
assert.equal(n.cond.maxIncome, null);           // 범위 밖 버림
assert.equal(n.docs[1].length, 60);             // 길이 제한

assert.equal(fromNotice(null).title, '제목 없는 공지'); // 쓰레기 입력에도 터지지 않음
assert.equal((await notices({}, {})).status, 503);       // DB 미설정
// 가짜 Supabase로 GET/POST 요청 모양 확인
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  const row = { id: 7, status: 'pending', type: '공지', title: 't', org: '', amount: 0, deadline: null, cond: {}, docs: [], summary: '', url: '' };
  return new Response(JSON.stringify([row]), { status: init?.method === 'POST' ? 201 : 200 });
};
const env = { SUPABASE_URL: 'https://p.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_x' };
const g = await notices({}, env, 'GET');
assert.equal(g.status, 200);
assert.deepEqual(g.json.notices[0], { id: 7, type: '공지', title: 't', org: '', amount: 0, deadline: '', cond: {}, docs: [], summary: '', tags: [], url: '', added: true });
assert.match(calls[0].url, /^https:\/\/p\.supabase\.co\/rest\/v1\/notices\?.*status=neq\.rejected/);
assert.equal(calls[0].init.headers.apikey, 'sb_secret_x');
assert.equal(calls[0].init.headers.Authorization, undefined);  // 새 secret 키는 apikey 헤더만

const p = await notices({ notice: { title: 'x', type: '장학금', status: 'approved', cond: {} } }, env, 'POST', '1.2.3.4');
assert.equal(p.status, 201);
assert.ok(calls.some(c => c.url.endsWith('/rpc/rate_hit')));    // 호출 횟수 기록
assert.ok(calls.some(c => /deadline=is\.null/.test(c.url)));    // 저장 전 같은 마감일 공지 조회
const save = calls.find(c => c.url.endsWith('/rest/v1/notices') && c.init.method === 'POST');
const sent = JSON.parse(save.init.body);
assert.equal(sent.status, 'pending');                           // 클라이언트가 승인 상태를 보내도 무시
assert.equal(sent.deadline, null);

// 이미 있는 공지(DB에 제목 't')와 같으면 409, 저장 요청을 보내지 않음
const before = calls.length;
const dup = await notices({ notice: { title: '[재공고] t', type: '공지', cond: {} } }, env, 'POST', '1.2.3.4');
assert.equal(dup.status, 409);
assert.equal(dup.json.duplicate.id, 7);
assert.ok(!calls.slice(before).some(c => c.url.endsWith('/rest/v1/notices') && c.init.method === 'POST'));
console.log('notices tests ok');

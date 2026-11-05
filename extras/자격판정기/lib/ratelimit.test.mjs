// node lib/ratelimit.test.mjs
import assert from 'node:assert/strict';
import { limit, clientId } from './ratelimit.js';

const msg = s => `wait ${s}`;
const t0 = Date.UTC(2026, 10, 5, 12, 0, 10); // 12:00:10
const rules = [{ name: 't-m', max: 3, sec: 60, msg }];

// 메모리 모드(DB 없음): 3번 통과, 4번째 차단, 남은 시간 50초
for (let i = 0; i < 3; i++) assert.ok((await limit({}, 'a', rules, t0)).ok);
const blocked = await limit({}, 'a', rules, t0);
assert.equal(blocked.ok, false);
assert.equal(blocked.retryAfter, 50);
assert.equal(blocked.message, 'wait 50');
assert.ok((await limit({}, 'b', rules, t0)).ok);                // 다른 사람은 영향 없음
assert.ok((await limit({}, 'a', rules, t0 + 60_000)).ok);       // 다음 1분 창에서 다시 허용

// 전체(global) 제한은 사람이 달라도 같이 센다
const g = [{ name: 't-g', max: 2, sec: 86400, global: true, msg }];
assert.ok((await limit({}, 'x', g, t0)).ok);
assert.ok((await limit({}, 'y', g, t0)).ok);
assert.equal((await limit({}, 'z', g, t0)).ok, false);

// IP 원문은 키에 들어가지 않는다
assert.equal(clientId({}, '1.2.3.4').length, 16);
assert.ok(!clientId({}, '1.2.3.4').includes('1.2.3.4'));

// DB 모드: rate_hit 결과 횟수로 판정, 키에는 해시만
const sent = [];
globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return new Response('6'); };
const env = { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' };
const r = await limit(env, '9.9.9.9', [{ name: 'ex-m', max: 5, sec: 60, msg }], t0);
assert.equal(r.ok, false);
assert.match(sent[0].p_key, /^ex-m:[0-9a-f]{16}:\d+$/);
assert.equal(sent[0].p_ttl, 60);

// DB 장애 시 메모리로 계속 동작
globalThis.fetch = async () => { throw new Error('down'); };
assert.ok((await limit(env, '9.9.9.9', [{ name: 't-f', max: 1, sec: 60, msg }], t0)).ok);
console.log('ratelimit tests ok');

// 호출 횟수 제한 (고정 시간 창). 카운터는 Supabase rate_hit() 함수에 저장하고, DB가 없으면 메모리에 저장한다.
// IP는 그대로 저장하지 않고 서버 비밀값으로 HMAC 해시한 앞 16자리만 쓴다.
import { createHmac } from 'node:crypto';
import { db, hasDb } from './db.js';

// shortcut: 메모리 카운터는 서버 인스턴스마다 따로라 배포 환경에선 느슨함 → 배포 시 Supabase 설정 필요
const mem = new Map();

async function hit(env, key, ttl, now) {
  if (hasDb(env)) {
    try {
      const r = await db(env, 'rpc/rate_hit', { method: 'POST', body: JSON.stringify({ p_key: key, p_ttl: ttl }) });
      if (r.ok) return Number(await r.json());
    } catch { /* DB 장애 시 아래 메모리 카운터로 계속 */ }
  }
  for (const [k, v] of mem) if (v.exp <= now) mem.delete(k);
  const v = mem.get(key) || { n: 0, exp: now + ttl * 1000 };
  v.n++;
  mem.set(key, v);
  return v.n;
}

export const clientId = (env, ip) =>
  createHmac('sha256', env.SUPABASE_SECRET_KEY || env.GEMINI_API_KEY || 'dev').update(String(ip || 'unknown')).digest('hex').slice(0, 16);

// rules: [{ name, max, sec, global?, msg(retryAfterSec) }] → 처음 넘친 규칙에서 멈춘다
export async function limit(env, ip, rules, now = Date.now()) {
  const id = clientId(env, ip);
  const t = Math.floor(now / 1000);
  for (const r of rules) {
    const win = Math.floor(t / r.sec);
    const count = await hit(env, `${r.name}:${r.global ? 'all' : id}:${win}`, r.sec, now);
    if (count > r.max) {
      const retryAfter = (win + 1) * r.sec - t;
      return { ok: false, retryAfter, message: r.msg(retryAfter) };
    }
  }
  return { ok: true };
}

export const tooMany = l => ({ status: 429, json: { error: l.message, retryAfter: l.retryAfter }, headers: { 'Retry-After': String(l.retryAfter) } });

// Vercel이 넣어 주는 접속 IP 헤더
export const reqIp = req => req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;

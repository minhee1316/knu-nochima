// Supabase REST(PostgREST) 호출. secret 키는 서버에서만 쓴다.
export const hasDb = env => !!(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY);

export function db(env, path, init = {}) {
  const key = env.SUPABASE_SECRET_KEY;
  const headers = { apikey: key, 'Content-Type': 'application/json', ...init.headers };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // 예전 service_role(JWT) 키 호환
  return fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, { ...init, headers, signal: AbortSignal.timeout(10000) });
}

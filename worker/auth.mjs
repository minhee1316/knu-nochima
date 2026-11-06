const SESSION_SECONDS = 7 * 24 * 60 * 60;
const PROFILE_FIELDS = ['campus', 'status', 'program', 'year', 'currentSemester', 'major', 'lastGpa', 'cumulativeGpa', 'gpaScale', 'earnedCredits', 'completedSemesters', 'lastCredits', 'lastPercentile', 'incomeBracket'];
const apiJson = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }
});
const randomToken = (length = 32) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
const sha256 = async (value) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function passwordMatches(password, salt, expected) {
  const actual = await passwordHash(password, salt);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}
function sessionCookie(token, maxAge = SESSION_SECONDS) {
  return `esungan_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
function requestCookie(request) {
  return request.headers.get('cookie')?.match(/(?:^|;\s*)esungan_session=([a-f0-9]{64})(?:;|$)/)?.[1] || '';
}
function validOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
async function requestBody(request) {
  const raw = await request.text();
  if (raw.length > 8192) throw new Error('입력 내용이 너무 깁니다.');
  try { return JSON.parse(raw); } catch { throw new Error('입력 형식을 확인해 주세요.'); }
}
async function currentAccount(request, db) {
  const token = requestCookie(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  return db.prepare('SELECT accounts.id, accounts.username FROM sessions JOIN accounts ON accounts.id = sessions.account_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?')
    .bind(tokenHash, Date.now()).first();
}
async function limited(db, key, threshold, durationMs) {
  const keyHash = await sha256(key);
  const now = Date.now();
  const row = await db.prepare('SELECT attempts, expires_at FROM auth_attempts WHERE key_hash = ?').bind(keyHash).first();
  if (row && row.expires_at > now && row.attempts >= threshold) return true;
  await db.prepare('INSERT INTO auth_attempts (key_hash, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key_hash) DO UPDATE SET attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END')
    .bind(keyHash, now + durationMs, now, now).run();
  return false;
}
async function createSession(db, account) {
  const token = randomToken();
  await db.prepare('INSERT INTO sessions (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), account.id, Date.now() + SESSION_SECONDS * 1000, new Date().toISOString()).run();
  return apiJson({ user: { id: account.id, username: account.username } }, 200, { 'set-cookie': sessionCookie(token) });
}
function accountInput(body) {
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');
  const email = username.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);
  if (!email && !/^[\p{L}\p{N}._-]{3,24}$/u.test(username)) return { error: '이메일 또는 기존 아이디를 입력해 주세요.' };
  if (password.length < 10 || password.length > 128) return { error: '비밀번호는 10~128자로 입력해 주세요.' };
  return { username: email ? username.toLowerCase() : username, password };
}
async function handleAuth(request, env) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/auth/')) return null;
  if (!env.DB) return apiJson({ error: '계정 저장소를 연결하는 중입니다.' }, 503);
  if (path === '/api/auth/me' && request.method === 'GET') {
    const account = await currentAccount(request, env.DB);
    return apiJson({ user: account ? { id: account.id, username: account.username } : null });
  }
  if (request.method !== 'POST') return apiJson({ error: '지원하지 않는 요청입니다.' }, 405);
  if (!validOrigin(request)) return apiJson({ error: '요청 출처를 확인할 수 없습니다.' }, 403);
  if (path === '/api/auth/logout') {
    const token = requestCookie(request);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return apiJson({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }
  let body;
  try { body = await requestBody(request); } catch (error) { return apiJson({ error: error.message }, 400); }
  if (path === '/api/auth/delete') {
    const account = await currentAccount(request, env.DB);
    if (!account) return apiJson({ error: '로그인이 필요합니다.' }, 401);
    const password = String(body?.password || '');
    const stored = await env.DB.prepare('SELECT password_salt, password_hash FROM accounts WHERE id = ?').bind(account.id).first();
    if (!stored || !(await passwordMatches(password, stored.password_salt, stored.password_hash))) return apiJson({ error: '비밀번호가 맞지 않습니다.' }, 401);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM profiles WHERE account_id = ?').bind(account.id),
      env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(account.id),
      env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(account.id)
    ]);
    return apiJson({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }
  const { username, password, error } = accountInput(body);
  if (error) return apiJson({ error }, 400);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (path === '/api/auth/signup') {
    if (body.role!=null&&!['학생','교직원'].includes(body.role)) return apiJson({error:'가입 구분은 학생 또는 교직원을 선택해 주세요.'},400);
    if (await limited(env.DB, `signup:${ip}`, 5, 60 * 60 * 1000)) return apiJson({ error: '가입 요청이 많습니다. 잠시 뒤 다시 시도해 주세요.' }, 429);
    const existing = await env.DB.prepare('SELECT id FROM accounts WHERE username = ?').bind(username).first();
    if (existing) return apiJson({ error: '이미 사용 중인 아이디입니다.' }, 409);
    const account = { id: crypto.randomUUID(), username };
    const salt = randomToken(16);
    try {
      const createdAt = new Date().toISOString();
      const role = body.role || '학생';
      await env.DB.batch([
        env.DB.prepare('INSERT INTO accounts (id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(account.id, username, salt, await passwordHash(password, salt), createdAt),
        env.DB.prepare('INSERT INTO profiles (account_id, data_json, updated_at) VALUES (?, ?, ?)')
          .bind(account.id, JSON.stringify({accountRole:role,conditions:{role, affiliation:role==='교직원'?'교직원':''}}), createdAt)
      ]);
    } catch (cause) {
      console.error('signup storage failure', cause);
      return apiJson({ error: '계정을 만들 수 없습니다. 잠시 뒤 다시 시도해 주세요.' }, 500);
    }
    return createSession(env.DB, account);
  }
  if (path === '/api/auth/login') {
    if (await limited(env.DB, `login:${ip}:${username.toLowerCase()}`, 8, 15 * 60 * 1000)) return apiJson({ error: '로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.' }, 429);
    const account = await env.DB.prepare('SELECT id, username, password_salt, password_hash FROM accounts WHERE username = ?').bind(username).first();
    if (!account || !(await passwordMatches(password, account.password_salt, account.password_hash))) return apiJson({ error: '아이디 또는 비밀번호가 맞지 않습니다.' }, 401);
    await env.DB.prepare('DELETE FROM auth_attempts WHERE key_hash = ?').bind(await sha256(`login:${ip}:${username.toLowerCase()}`)).run();
    return createSession(env.DB, account);
  }
  return apiJson({ error: '페이지를 찾을 수 없습니다.' }, 404);
}
async function handleProfile(request, env) {
  if (new URL(request.url).pathname !== '/api/profile') return null;
  if (!env.DB) return apiJson({ error: '계정 저장소를 연결하는 중입니다.' }, 503);
  const account = await currentAccount(request, env.DB);
  if (!account) return apiJson({ error: '로그인이 필요합니다.' }, 401);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT data_json, updated_at FROM profiles WHERE account_id = ?').bind(account.id).first();
    return apiJson({ profile: row ? JSON.parse(row.data_json) : null, updatedAt: row?.updated_at || null });
  }
  if (!validOrigin(request)) return apiJson({ error: '요청 출처를 확인할 수 없습니다.' }, 403);
  if (request.method === 'DELETE') {
    await env.DB.prepare("UPDATE profiles SET data_json=json_object('accountRole',COALESCE(json_extract(data_json,'$.accountRole'),json_extract(data_json,'$.conditions.role'),'학생')),updated_at=? WHERE account_id=?").bind(new Date().toISOString(),account.id).run();
    return apiJson({ profile: null });
  }
  if (request.method !== 'PUT') return apiJson({ error: '지원하지 않는 요청입니다.' }, 405);
  let input;
  try { input = await requestBody(request); } catch (error) { return apiJson({ error: error.message }, 400); }
  const profile = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, String(input?.[field] ?? '').trim()]));
  if (!['춘천', '삼척'].includes(profile.campus) || !['재학', '휴학', '졸업예정', '졸업'].includes(profile.status)
    || !['학부', '대학원'].includes(profile.program) || !/^[1-5]$/.test(profile.year)
    || !/^[12]$/.test(profile.currentSemester) || profile.major.length > 80) return apiJson({ error: '학사정보 입력값을 확인해 주세요.' }, 400);
  for (const [field, max] of Object.entries({ lastGpa: 4.5, cumulativeGpa: 4.5, earnedCredits: 300, completedSemesters: 20, lastCredits: 40, lastPercentile: 100, incomeBracket: 10 })) {
    if (profile[field] && (!Number.isFinite(Number(profile[field])) || Number(profile[field]) < 0 || Number(profile[field]) > max)) return apiJson({ error: `${field} 입력값을 확인해 주세요.` }, 400);
  }
  await env.DB.prepare("INSERT INTO profiles (account_id,data_json,updated_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET data_json=json_set(excluded.data_json, '$.accountRole', COALESCE(json_extract(profiles.data_json,'$.accountRole'),json_extract(profiles.data_json,'$.conditions.role'),'학생')), updated_at=excluded.updated_at")
    .bind(account.id, JSON.stringify(profile), new Date().toISOString()).run();
  return apiJson({ profile });
}

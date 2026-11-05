// 로컬 개발용: 정적 파일 + /api/extract. 배포(Vercel)에서는 쓰지 않는다.  실행: npm run dev
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from './api/extract.js';
import { notices } from './api/notices.js';
import { auth } from './api/auth.js';
import { profile } from './api/profile.js';
import { chat } from './api/chat.js';
const ROUTES = { '/api/extract': extract, '/api/notices': notices, '/api/auth': auth, '/api/profile': profile, '/api/chat': chat };

const root = fileURLToPath(new URL('.', import.meta.url));
try { process.loadEnvFile(join(root, '.env')); } catch { console.warn('.env 없음: AI 조건 읽기는 키를 넣기 전까지 오류를 돌려줍니다.'); }
const TYPE = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PORT = Number(process.env.PORT) || 5178;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = ROUTES[url.pathname];
  if (route) {
    if (url.pathname === '/api/extract' && req.method !== 'POST') { res.writeHead(405); return res.end(); }
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > 8e6) { res.writeHead(413); return res.end(); } chunks.push(c); }
    let body; try { body = JSON.parse(Buffer.concat(chunks)); } catch { body = {}; }
    const r = await route(body, process.env, req.method, req.socket.remoteAddress, req.headers); // 로컬은 헤더 대신 실제 소켓 주소
    res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', ...r.headers });
    return res.end(JSON.stringify(r.json));
  }
  const file = normalize(join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
  if (!file.startsWith(root) || /[\\/](api|\.env)/.test(file.slice(root.length - 1))) { res.writeHead(404); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPE[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));

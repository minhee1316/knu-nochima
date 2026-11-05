// 강원대 공개 게시판에서 최근 공지를 모아 data/raw.json에 저장한다. (AI 분석은 build.mjs)
// 실행: node scripts/collect.mjs [--days 45] [--pages 1]
// 예의: 요청 사이 1초 대기, 목록 30개 단위, 로그인·다운로드 경로는 건드리지 않음.
import { writeFile, mkdir } from 'node:fs/promises';
import { BASE, BOARDS, parseList, parseDetail } from './knu.mjs';
import { normTitle } from '../lib/dup.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const DAYS = arg('days', 45), PAGES = arg('pages', 5); // 최대 쪽수: 45일 안의 글이 더 없으면 그 전에 멈춘다
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'KNU-Eligibility-Hackathon/0.1 (student prototype; low-rate)';

async function get(path) {
  await sleep(1000);
  const r = await fetch(BASE + path, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.text();
}

const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
const seen = new Set(), items = [];
for (const board of BOARDS) {
  let rows = [];
  const sns = new Set();
  for (let p = 1; p <= PAGES; p++) {
    // 상단 고정글은 쪽마다 반복되므로 처음 본 글만 센다. 새 글이 없으면(45일 밖) 다음 쪽은 안 읽음
    const fresh = parseList(await get(`/ko/bbs/${board.id}/list.do?pageIndex=${p}&pageItm=30`)).filter(r => r.posted >= since && !sns.has(r.sn));
    fresh.forEach(r => sns.add(r.sn)); rows.push(...fresh);
    if (!fresh.length) break;
  }
  console.log(`${board.name}(${board.id}): 최근 ${DAYS}일 ${rows.length}건`);
  for (const row of rows) {
    const key = normTitle(row.title) + row.posted; // 같은 글이 여러 게시판에 걸린 경우 한 번만
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      items.push({ board, row, det: parseDetail(await get(`/ko/bbs/${board.id}/detail.do?pstSn=${row.sn}`)) });
    } catch (e) { console.warn('  건너뜀:', row.title, e.message); }
  }
}
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/raw.json', import.meta.url), JSON.stringify({ collectedAt: new Date().toISOString(), days: DAYS, items }, null, 1));
console.log(`저장: data/raw.json (${items.length}건)`);

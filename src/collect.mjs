import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDetail, parseList, matchesScope, BASE_URL, BOARDS } from './parse.mjs';
import { collectEvents } from './collect-events.mjs';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = resolve(projectDir, 'data/notices.json');
const previewDataPath = resolve(projectDir, 'dist/notices.json');
const watch = process.argv.includes('--watch');
const intervalMinutes = 15;

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'KNU-E-sungan-student-prototype/0.1 (public notices; 15-minute polling)' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function readExisting() {
  try {
    const value = JSON.parse(await readFile(dataPath, 'utf8'));
    if (!Array.isArray(value)) throw new Error('기존 데이터 형식이 잘못됐습니다.');
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function collect() {
  const lists = await Promise.all(BOARDS.map(async (board) => {
    const listUrl = `${BASE_URL}${board.path}/list.do?pageIndex=1&pageItm=10`;
    return parseList(await fetchHtml(listUrl), board).filter(matchesScope);
  }));
  const list = lists.flat();
  const existing = await readExisting();
  const knownIds = new Set(existing.map((item) => item.id));
  const pending = list.filter((item) => !knownIds.has(item.id));
  const imageBackfill = existing.filter((item) => !item.body && !item.images && list.some((post) => post.id === item.id));
  const fresh = [];
  const enriched = new Map();

  for (const item of [...pending, ...imageBackfill]) {
    try {
      const detail = parseDetail(await fetchHtml(item.url));
      const value = { ...item, ...detail, collectedAt: item.collectedAt || new Date().toISOString() };
      if (knownIds.has(item.id)) enriched.set(item.id, value);
      else fresh.push(value);
      await new Promise((done) => setTimeout(done, 500));
    } catch (error) {
      console.error(`본문 수집 실패 (${item.postId}): ${error.message}`);
    }
  }

  if (fresh.length || enriched.size) {
    const merged = [...fresh, ...existing.map((item) => enriched.get(item.id) || item)].sort((a, b) =>
      b.postedAt.localeCompare(a.postedAt) || Number(b.postId) - Number(a.postId)
    );
    await mkdir(dirname(dataPath), { recursive: true });
    const serialized = JSON.stringify(merged, null, 2) + '\n';
    await writeFile(dataPath, serialized, 'utf8');
    await writeFile(previewDataPath, serialized, 'utf8');
  }

  console.log(`확인 ${list.length}건 · 새 공지 ${fresh.length}건 · 이미지 정보 보완 ${enriched.size}건 · 저장 ${existing.length + fresh.length}건`);
  console.log(`저장 위치: ${dataPath}`);
  for (const item of fresh.slice(0, 5)) {
    console.log(`- [${item.campuses.join('·')}] ${item.title}`);
  }
}

async function main() {
  do {
    try { await collect(); }
    catch (error) { console.error(`수집 오류: ${error.message}`); if (!watch) process.exitCode = 1; }
    try { await collectEvents(); }
    catch (error) { console.error(`지역 행사 수집 오류: ${error.message}`); if (!watch) process.exitCode = 1; }
    if (!watch) break;
    await new Promise((done) => setTimeout(done, intervalMinutes * 60_000));
  } while (true);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

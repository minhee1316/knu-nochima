import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChuncheonEvents, parseSamcheokEvents, samcheokEventDays } from './parse-events.mjs';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const calendarUrl = 'https://www.stcf.or.kr/01298/01402.web';
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const month = (offset) => {
  const [year, currentMonth] = today().slice(0, 7).split('-').map(Number);
  const date = new Date(Date.UTC(year, currentMonth - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
};

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'KNU-E-sungan-event-prototype/0.1 (public calendars; 30-minute polling)' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

export async function collectEvents() {
  const events = parseChuncheonEvents(await fetchHtml('https://www.chuncheon.go.kr/tour/festival-event/main/'));
  for (const currentMonth of [month(0), month(1)]) {
    const listUrl = `${calendarUrl}?smonth=${currentMonth}`;
    const days = samcheokEventDays(await fetchHtml(listUrl));
    for (const day of days) {
      const dayUrl = `${listUrl}&selday=${encodeURIComponent(day)}`;
      events.push(...parseSamcheokEvents(await fetchHtml(dayUrl), dayUrl));
      await new Promise((done) => setTimeout(done, 300));
    }
  }
  const unique = [...new Map(events.map((item) => [item.id, item])).values()]
    .filter((item) => item.endAt >= today())
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const serialized = JSON.stringify(unique.map((item) => ({ ...item, collectedAt: new Date().toISOString() })), null, 2) + '\n';
  await Promise.all([
    writeFile(resolve(projectDir, 'data/events.json'), serialized, 'utf8'),
    writeFile(resolve(projectDir, 'dist/events.json'), serialized, 'utf8')
  ]);
  console.log(`지역 행사 ${unique.length}건 · 춘천 ${unique.filter((item) => item.region === '춘천').length}건 · 삼척 ${unique.filter((item) => item.region === '삼척').length}건`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  collectEvents().catch((error) => { console.error(`지역 행사 수집 오류: ${error.message}`); process.exitCode = 1; });
}

// 춘천·삼척 지역 행사 수집 → data/events.json (build.mjs가 공지 목록에 합친다)
// 출처: 춘천여행ON(춘천시 관광포털 축제·행사), 삼척관광문화재단 행사 달력. 둘 다 robots.txt 허용(2026-11 확인).
// 실행: node scripts/events.mjs   (요청 사이 1초 대기, 목록 페이지만 읽음)
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { decode } from './knu.mjs';
import { normTitle } from '../lib/dup.js';

const CC = 'https://www.chuncheon.go.kr', SC = 'https://www.stcf.or.kr';
const clean = s => decode(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// 춘천: 목록 카드 → 종료되지 않은 행사만
export function parseChuncheon(html) {
  const out = [];
  for (const m of html.matchAll(/tourEventId=(\d+)"\s*data-content="([^"]*)"[\s\S]*?class="label ([a-z]+)"[\s\S]*?class="date">([\s\S]*?)<\/span>/g)) {
    const [s, e] = clean(m[4]).match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (!s || m[3] === 'complete') continue;
    out.push({ id: `ev-cc-${m[1]}`, region: '춘천', source: '춘천여행ON', title: clean(m[2]), start: s, end: e || s,
      url: `${CC}/tour/festival-event/main/view/?tourEventId=${m[1]}` });
  }
  return out;
}

// 삼척: 월 달력의 날짜 칸 → 같은 제목이 이어지는 날은 한 행사(시작~끝)로 묶는다
export function parseSamcheok(html, month) {
  const days = [];
  for (const a of html.matchAll(/\?selday=(\d+)&amp;smonth=(\d{4}-\d{2})[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (a[2] !== month) continue;
    for (const t of a[3].matchAll(/class="a1t1"[^>]*>(?:<em>[^<]*<\/em>)?([^<]+)</g))
      days.push({ day: +a[1], title: clean(t[1]) });
  }
  const byTitle = new Map();
  for (const d of days) (byTitle.get(d.title) || byTitle.set(d.title, []).get(d.title)).push(d.day);
  const out = [], ymd = d => `${month}-${String(d).padStart(2, '0')}`;
  for (const [title, all] of byTitle) {
    const ds = [...new Set(all)].sort((a, b) => a - b);
    let from = ds[0];
    ds.forEach((d, i) => {
      if (ds[i + 1] === d + 1) return; // 다음 날도 같은 행사면 이어 붙임
      out.push({ id: `ev-sc-${ymd(from)}-${title.replace(/[^\p{L}\p{N}]+/gu, '_')}`, region: '삼척', source: '삼척관광문화재단', title, start: ymd(from), end: ymd(d),
        url: `${SC}/01298/01402.web?smonth=${month}&selday=${from}` });
      from = ds[i + 1];
    });
  }
  return out;
}

// ===== 공공데이터포털(data.go.kr) API: DATA_GO_KR_KEY가 있을 때만 =====
// 한국관광공사 TourAPI(KorService2) 축제·공연·행사. 법정동 코드: 강원 51, 춘천 110·삼척 230 (원주 130·강릉 150은 나중에 추가)
export const TOUR_CITIES = { 110: '춘천', 230: '삼척' };
// 분류체계 코드(신분류체계정보 관광타입정보 연계 정의서.xlsx의 EV 부분)
export const EV = { EV01: '축제', EV010100: '문화관광축제', EV010200: '문화예술축제', EV010300: '지역특산물축제', EV010400: '전통역사축제', EV010500: '생태자연축제', EV010600: '기타축제',
  EV02: '공연', EV020100: '전통공연', EV020200: '연극', EV020300: '뮤지컬', EV020400: '오페라', EV020500: '무용', EV020600: '클래식음악회', EV020700: '대중콘서트', EV020800: '영화', EV020900: '기타공연', EV021000: '넌버벌',
  EV03: '행사', EV030100: '전시회', EV030200: '박람회', EV030300: '스포츠경기', EV030400: '기타행사' };
const ymd8 = s => s ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '';
const hrefOf = s => (String(s || '').match(/https?:\/\/[^"'<>\s]+/) || [''])[0]; // 홈페이지 칸은 <a href=...> 형태일 때가 있음

// TourAPI 목록 항목(+소개·공통정보) → 행사
export function fromTour(it, intro = {}, common = {}) {
  const ev = EV[it.lclsSystm3] || EV[it.lclsSystm2] || '';
  return { id: `ev-tour-${it.contentid}`, region: TOUR_CITIES[it.lDongSignguCd] || (String(it.addr1 || '').match(/(\S+?)(시|군)\s/) || [])[1] || '강원', source: '한국관광공사', title: it.title,
    start: ymd8(it.eventstartdate), end: ymd8(it.eventenddate), category: ev, place: intro.eventplace || it.addr1 || '',
    fee: String(intro.usetimefestival || '').replace(/<[^>]+>/g, ' ').trim(), tel: it.tel || intro.sponsor1tel || '',
    url: hrefOf(common.homepage) || hrefOf(intro.eventhomepage) || `https://korean.visitkorea.or.kr/search/search_list.do?keyword=${encodeURIComponent(it.title)}` };
}
// 춘천시 관내 공연행사(ccevent)·문화축제(ccculture) 항목 → 행사
export const fromChuncheonApi = (r, kind) => ({ id: `ev-cc${kind}-${r.eventNo ?? r.cultureNo}`, region: '춘천', source: '춘천시 공공데이터',
  title: r.eventNm || r.cultureNm, start: r.startDate, end: r.endDate || r.startDate, category: kind === 'ev' ? '공연행사' : '문화축제',
  place: r.site || '', fee: r.charge || r.feeInfo || '', tel: r.telno || '', url: hrefOf(r.homepage) || hrefOf(r.reservationInfo) });
// 삼척시 전국대회개최정보(odcloud) 항목 → 행사
export const fromSamcheokContest = r => ({ id: `ev-scc-${r['대회시작일']}-${String(r['대회명']).replace(/[^\p{L}\p{N}]+/gu, '_')}`, region: '삼척', source: '삼척시 공공데이터',
  title: r['대회명'], start: r['대회시작일'], end: r['대회마감일'] || r['대회시작일'], category: '전국대회', place: r['장소'] || '', fee: '',
  tel: r['문의처'] || '', url: hrefOf(r['홈페이지주소']) });

async function fromDataGoKr(key, today, fails) {
  const out = [], j = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
  const T = 'https://apis.data.go.kr/B551011/KorService2/', base = { serviceKey: key, MobileOS: 'WEB', MobileApp: 'KNUEligibility', _type: 'json' };
  const tour = (op, p) => j(T + op + '?' + new URLSearchParams({ ...base, ...p })).then(x => [].concat(x.response?.body?.items?.item || []));
  // 지금은 춘천·삼척만(TOUR_CITIES). 진행 중이거나 앞으로 열리는 행사만 온다.
  for (const code of Object.keys(TOUR_CITIES)) {
    try {
      for (const it of await tour('searchFestival2', { numOfRows: 100, pageNo: 1, arrange: 'C', eventStartDate: today.replace(/-/g, ''), lDongRegnCd: 51, lDongSignguCd: code })) {
        const [intro] = await tour('detailIntro2', { contentId: it.contentid, contentTypeId: 15 }).catch(() => []);
        const [common] = await tour('detailCommon2', { contentId: it.contentid }).catch(() => []);
        out.push(fromTour(it, intro, common));
      }
    } catch (e) { fails.push(`관광공사: ${e.message}`); }
  }
  // 춘천시·삼척시 API는 2022~2023년 자료까지만 있어(2026-11 확인) 지금은 대부분 기간이 지나 걸러진다. 갱신되면 자동으로 나온다.
  for (const [kind, path, op] of [['ev', 'ccevent', 'getEventList'], ['cu', 'ccculture', 'get_cultureList']]) {
    try {
      for (let p = 1; p <= 5; p++) {
        const x = await j(`https://apis.data.go.kr/4180000/${path}/${op}?` + new URLSearchParams({ serviceKey: key, pageNo: p, numOfRows: 200 }));
        out.push(...(x.data || []).map(r => fromChuncheonApi(r, kind)));
        if (p * 200 >= +x.totalCount) break;
      }
    } catch (e) { fails.push(`춘천시 ${path}: ${e.message}`); }
  }
  try {
    const doc = await j('https://infuser.odcloud.kr/oas/docs?namespace=15027891/v1');
    const [path] = Object.entries(doc.paths).sort((a, b) => a[1].get.summary.slice(-8).localeCompare(b[1].get.summary.slice(-8))).at(-1); // 가장 최근 파일
    const x = await j(`https://api.odcloud.kr/api${path}?` + new URLSearchParams({ serviceKey: key, page: 1, perPage: 200 }));
    out.push(...(x.data || []).map(fromSamcheokContest));
  } catch (e) { fails.push(`삼척시 전국대회: ${e.message}`); }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* .env 없음 */ }
  const UA = 'KNU-Eligibility-Hackathon/0.1 (student prototype; low-rate)';
  const get = async url => {
    await new Promise(r => setTimeout(r, 1000));
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.text();
  };
  const now = new Date(), today = now.toISOString().slice(0, 10);
  const months = [0, 1].map(k => { const d = new Date(now.getFullYear(), now.getMonth() + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const events = [], fails = [];
  try { events.push(...parseChuncheon(await get(`${CC}/tour/festival-event/main/`))); } catch (e) { fails.push('춘천: ' + e.message); }
  for (const m of months) {
    try { events.push(...parseSamcheok(await get(`${SC}/01298/01402.web?smonth=${m}`), m)); } catch (e) { fails.push(`삼척 ${m}: ` + e.message); }
  }
  const key = process.env.DATA_GO_KR_KEY;
  const api = key ? await fromDataGoKr(key, today, fails) : [];
  if (!key) console.log('DATA_GO_KR_KEY 없음: 공공데이터(관광공사·춘천시·삼척시) API는 건너뜀');
  // 같은 행사가 여러 출처에 있으면 기관 홈페이지 쪽(먼저 넣은 것)만 남긴다
  const seen = new Set(), live = [];
  for (const e of [...events, ...api]) {
    const k = normTitle(e.title);
    if (!e.title || !e.end || e.end < today || seen.has(k)) continue;
    seen.add(k); live.push(e);
  }
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/events.json', import.meta.url), JSON.stringify({ collectedAt: now.toISOString(), events: live }, null, 1));
  const by = Object.entries(Object.groupBy(live, e => e.source)).map(([s, l]) => `${s} ${l.length}`).join(', ');
  console.log(`저장: data/events.json — 지역 행사 ${live.length}건 (${by}) · API 원자료 ${api.length}건 중 기간 지난 것 제외`);
  if (fails.length) console.warn('실패:', fails.join(' / '));
}

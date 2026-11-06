const BOARDS = [
  { key: 'general', name: '일반공지', path: '504' },
  { key: 'campus-event', name: '행사안내', path: '715' },
  { key: 'contest', name: '공모안내', path: '719' },
  { key: 'scholarship', name: '장학공지', path: '721' }
];
const KNU_ORIGIN = 'https://www.kangwon.ac.kr';
const TTL_SECONDS = 15 * 60;
const feedMemory = new Map();
const json = (value, extra = {}) => new Response(JSON.stringify(value), {
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', ...extra }
});
const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const bundled = (path) => JSON.parse(STATIC_ASSETS[path].body);

// Only public, numbered university attachments. Rebuild the upstream URL from
// validated fields instead of forwarding an arbitrary user-supplied address.
async function schoolAttachment(url) {
  const name = url.searchParams.get('dn') || '';
  const path = url.searchParams.get('path') || '';
  if (!/^\d{8,30}[\w-]*\.(pdf|png|jpe?g|webp)$/i.test(name) || !/^\/bbs\/\d{1,5}$/.test(path)) return new Response('Unsupported attachment', {status:400});
  const query = new URLSearchParams({dn:name,path,fn:name});
  const upstream = await fetch(KNU_ORIGIN+'/ko/cmmn/download.do?'+query, {headers:{'User-Agent':'KNU-Notice/1.0 (public university attachments)'},redirect:'manual',signal:AbortSignal.timeout(18000)});
  if (!upstream.ok || Number(upstream.headers.get('content-length')) > 15*1024*1024) return new Response('Attachment unavailable', {status:422});
  return new Response(upstream.body,{headers:{'access-control-allow-origin':'*','cache-control':'public,max-age=3600','content-type':'application/octet-stream','content-disposition':'attachment','x-content-type-options':'nosniff'}});
}

async function enrichNotice(item) {
  const html = await publicHtml(item.url);
  const clean = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const opening = /<div\b[^>]*\bclass=["'][^"']*\beditor-wrap\b[^"']*["'][^>]*>/i.exec(clean);
  let editor = '';
  if (opening) {
    const inside = clean.slice(opening.index + opening[0].length);
    let depth = 1;
    for (const tag of inside.matchAll(/<\/?div\b[^>]*>/gi)) {
      depth += tag[0][1] === '/' ? -1 : 1;
      if (!depth) { editor = inside.slice(0,tag.index); break; }
    }
  }
  const files = [];
  for (const match of html.matchAll(/href=["']([^"']*\/ko\/cmmn\/download\.do\?[^"']+)["']/gi)) {
    const u = new URL(match[1].replaceAll('&amp;','&'), KNU_ORIGIN);
    if(u.origin !== KNU_ORIGIN)continue;
    files.push({url:u.href,name:u.searchParams.get('fn')||u.searchParams.get('dn')||'첨부'});
  }
  const body=cleanText(editor.replace(/<\/?(?:p|li|br)\b[^>]*>/gi,' ')).slice(0,9000);
  return {...item,body,files,contentType:body?'text':item.contentType};
}

async function cachedFeed(request, compute, fallback) {
  const key = new URL(request.url).pathname;
  const saved = feedMemory.get(key);
  if (saved?.expiresAt > Date.now()) return json(saved.value);
  let value;
  try { value = await compute(); }
  catch (error) { value = { ...fallback, mode: 'snapshot', error: String(error.message || error) }; }
  if (value.mode === 'live') feedMemory.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  return json(value);
}

async function schoolFeed() {
  const now = new Date().toISOString();
  const lists = await Promise.all(BOARDS.map(async (board) => {
    const response = await fetch(`${KNU_ORIGIN}/ko/bbs/${board.path}/list.do?pageIndex=1&pageItm=10`, {
      headers: { 'User-Agent': 'KNU-E-sungan/0.2 (public school notices; 15-minute cache)' },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`강원대 ${board.name} ${response.status}`);
    const items = parseSchoolListLive(await response.text(), board);
    if (!items.length) throw new Error(`강원대 ${board.name} 목록을 읽지 못했습니다.`);
    return items;
  }));
  const staticItems = bundled('/notices.json');
  const known = new Map(staticItems.map((item) => [item.id, item]));
  for (const item of lists.flat()) {
    const previous = known.get(item.id);
    known.set(item.id, { ...previous, ...item,
      body: previous?.body || '', images: previous?.images || [],
      originalLinks: previous?.originalLinks || [], contentType: previous?.contentType || 'empty', collectedAt: now });
  }
  const items = [...known.values()].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  const fresh=items.filter(x=>!x.body).slice(0,8);
  const extra=await Promise.allSettled(fresh.map(enrichNotice));
  extra.forEach((r,i)=>{if(r.status==='fulfilled') Object.assign(fresh[i],r.value);});
  return { items, mode: 'live', updatedAt: now, refreshMinutes: 15 };
}

async function tourEvents(env, today) {
  if (!env.TOUR_API_KEY) return null;
  const start = new Date(`${today}T00:00:00+09:00`);
  start.setUTCDate(start.getUTCDate() - 120);
  const params = new URLSearchParams({
    serviceKey: env.TOUR_API_KEY, MobileOS: 'ETC', MobileApp: 'KNU_Esungan', _type: 'json',
    eventStartDate: start.toISOString().slice(0, 10).replaceAll('-', ''),
    areaCode: '32', numOfRows: '1000', pageNo: '1'
  });
  const response = await fetch(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?${params}`, {
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`TourAPI ${response.status}`);
  const payload = await response.json();
  const root = payload.response || payload;
  if (String(root.header?.resultCode) !== '0000') throw new Error(`TourAPI ${root.header?.resultMsg || '응답 오류'}`);
  return normalizeTourEvents(root.body?.items?.item, today);
}

async function publicHtml(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`${response.status} ${new URL(url).hostname}`);
  return response.text();
}

async function chuncheonEvents() {
  const items = parseChuncheonLive(await publicHtml('https://www.chuncheon.go.kr/tour/festival-event/main/'));
  if (!items.length) throw new Error('춘천 행사 목록을 읽지 못했습니다.');
  return items;
}

async function chuncheonApiEvents(env, type, today) {
  if (!env.TOUR_API_KEY) return null;
  const service = type === 'culture' ? 'ccculture/get_cultureList' : 'ccevent/getEventList';
  const params = new URLSearchParams({ serviceKey: env.TOUR_API_KEY, pageNo: '1', numOfRows: '1000' });
  const response = await fetch(`https://apis.data.go.kr/4180000/${service}?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`춘천시 ${type} API ${response.status}`);
  const payload = await response.json();
  const root = payload.response || payload;
  if (root.resultCode && !['0', '00', '0000'].includes(String(root.resultCode))) throw new Error(`춘천시 ${type} API 응답 오류`);
  return normalizeChuncheonApi(root, type, today);
}

async function samcheokCompetitionApi(env, today) {
  if (!env.TOUR_API_KEY) return null;
  const params = new URLSearchParams({ serviceKey: env.TOUR_API_KEY, page: '1', perPage: '1000' });
  const response = await fetch(`https://api.odcloud.kr/api/15027891/v1/uddi:74b07909-54ad-4145-a634-f6140f4f6d17?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`삼척시 전국대회 API ${response.status}`);
  return normalizeSamcheokCompetitionApi(await response.json(), today);
}

async function samcheokEvents(today) {
  const yearMonth = today.slice(0, 7);
  const [year, month] = yearMonth.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  const months = [yearMonth, nextMonth];
  const perMonth = await Promise.all(months.map(async (current) => {
    const base = `https://www.stcf.or.kr/01298/01402.web?smonth=${current}`;
    const days = samcheokDaysLive(await publicHtml(base));
    const details = await Promise.allSettled(days.map(async (day) => {
      const url = `${base}&selday=${encodeURIComponent(day)}`;
      return parseSamcheokLive(await publicHtml(url), url);
    }));
    return details.filter((result) => result.status === 'fulfilled').flatMap((result) => result.value);
  }));
  return [...new Map(perMonth.flat().map((item) => [item.id, item])).values()];
}

async function tourFeed(env) {
  const today = todayKst();
  const [tour, culture, performance, competition, chuncheon, samcheok] = await Promise.allSettled([
    tourEvents(env, today), chuncheonApiEvents(env, 'culture', today), chuncheonApiEvents(env, 'event', today), samcheokCompetitionApi(env, today), chuncheonEvents(), samcheokEvents(today)
  ]);
  const tourItems = tour.status === 'fulfilled' ? tour.value || [] : [];
  const apiItems = [culture, performance, competition].filter((result) => result.status === 'fulfilled').flatMap((result) => result.value || []);
  const cityItems = [chuncheon, samcheok].filter((result) => result.status === 'fulfilled').flatMap((result) => result.value);
  const sources = [tour.status === 'fulfilled' && tour.value !== null && 'TourAPI', culture.status === 'fulfilled' && culture.value !== null && '춘천시 문화축제 API', performance.status === 'fulfilled' && performance.value !== null && '춘천시 공연행사 API', competition.status === 'fulfilled' && competition.value !== null && '삼척시 전국대회 API', chuncheon.status === 'fulfilled' && '춘천여행ON', samcheok.status === 'fulfilled' && '삼척관광문화재단'].filter(Boolean);
  const fallbackSources = new Set([
    chuncheon.status === 'rejected' && '춘천여행ON', samcheok.status === 'rejected' && '삼척관광문화재단'
  ].filter(Boolean));
  const fallback = bundled('/events.json').filter((item) => item.endAt >= today && fallbackSources.has(item.source));
  const items = [...new Map([...tourItems, ...apiItems, ...fallback, ...cityItems]
    .filter((item) => item.endAt >= today)
    .map((item) => [`${item.region}:${item.title.replace(/\s+/g, '')}:${item.startAt}`, item])).values()]
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  return { items, mode: sources.length ? 'live' : 'snapshot', updatedAt: sources.length ? new Date().toISOString() : null,
    refreshMinutes: 15, sources, tourCount: tourItems.length, tourConnected: tour.status === 'fulfilled' && tour.value !== null };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if(url.pathname==='/api/gom-chat')return handleGomChat(request,env);
    if(url.pathname==='/api/benefits')return handleGov24(request,env);
    if(url.pathname==='/api/welfare')return Bokjiro.handle(request,env);
    if(url.pathname==='/api/exams')return Qnet.handle(request,env);
    if(url.pathname==='/api/work24')return handleWork24(request,env);
    if(url.pathname==='/api/scholarship-statistics')return KosafStats.handle(request,env);
    if(url.pathname==='/api/scholarships'||url.pathname==='/api/scholarships/chat')return handleKosaf(request,env);
    if(url.pathname==='/api/startups')return handleStartups(request,env);
    if(url.pathname==='/api/school-attachment' && request.method==='GET') return schoolAttachment(url).catch(()=>new Response('Attachment unavailable',{status:502}));
    const authResponse = await handleAuth(request, env);
    if (authResponse) return authResponse;
    const conditionsResponse = await handleConditions(request, env);
    if (conditionsResponse) return conditionsResponse;
    const profileResponse = await handleProfile(request, env);
    if (profileResponse) return profileResponse;
    if (url.pathname === '/api/notices') {
      const fallback = { items: bundled('/notices.json'), mode: 'snapshot', updatedAt: null };
      return cachedFeed(request, schoolFeed, fallback);
    }
    if (url.pathname === '/api/events') {
      const fallback = { items: bundled('/events.json'), mode: 'snapshot', updatedAt: null };
      return cachedFeed(request, () => tourFeed(env), fallback);
    }
    if (url.pathname === '/download.html') return new Response(STATIC_ASSETS['/index.html'].body, {headers:{'content-type':'text/html; charset=utf-8','content-disposition':"attachment; filename=KNU.html; filename*=UTF-8''"+encodeURIComponent('놓치지마.html'),'cache-control':'no-store'}});
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const asset = STATIC_ASSETS[path];
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(asset.body, { headers: { 'content-type': asset.type, 'cache-control': path.endsWith('.json') ? 'no-store' : 'public, max-age=300' } });
  }
};

const startupEndpoint = 'https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01';
const startupCacheMs = 15 * 60 * 1000;
const startupText = value => String(value ?? '').trim();
const startupFields = {
  region: 'supt_regin', category: 'supt_biz_clsfc', audience: 'aply_trgt', eligibility: 'aply_trgt_ctnt',
  exclusions: 'aply_excl_trgt_ctnt', age: 'biz_trgt_age', stage: 'biz_enyy', preference: 'prfn_matr',
  description: 'pbanc_ctnt', org: 'pbanc_ntrp_nm', department: 'biz_prch_dprt_nm', phone: 'prch_cnpl_no'
};
const startupMethods = {
  '온라인': 'aply_mthd_onli_rcpt_istc', '이메일': 'aply_mthd_eml_rcpt_istc', '방문': 'aply_mthd_vst_rcpt_istc',
  '우편': 'aply_mthd_pssr_rcpt_istc', '팩스': 'aply_mthd_fax_rcpt_istc', '기타': 'aply_mthd_etc_istc'
};
function startupUrl(value) {
  const raw = startupText(value);
  if (!/^(https?:\/\/|(?:[\w-]+\.)+[a-z]{2,}\/)/i.test(raw)) return '';
  try {
    const url = new URL(/^https?:/i.test(raw) ? raw : 'https://' + raw);
    return url.username || url.password ? '' : url.href;
  } catch { return ''; }
}
function startupDate(value) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(startupText(value));
  if (!m) return '';
  const iso = m.slice(1).join('-');
  const date = new Date(iso+'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(iso+'T') ? iso : '';
}
export function mapStartup(row) {
  const serial = startupText(row?.pbanc_sn), title = startupText(row?.biz_pbanc_nm);
  if (!/^\d+$/.test(serial) || !title || row.rcrt_prgs_yn !== 'Y') throw Error('incomplete');
  const notice = {
    id: 'kstartup-' + serial, title, start: startupDate(row.pbanc_rcpt_bgng_dt), deadline: startupDate(row.pbanc_rcpt_end_dt),
    url: startupUrl(row.detl_pg_url) || 'https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn='+serial,
    applicationUrl: startupUrl(row.biz_aply_url), guideUrl: startupUrl(row.biz_gdnc_url)
  };
  for (const [key, field] of Object.entries(startupFields)) notice[key] = startupText(row[field]);
  notice.methods = Object.entries(startupMethods).filter(([,field])=>startupText(row[field]))
    .map(([label,field])=>label+' · '+startupText(row[field])).join('\n');
  return notice;
}
async function startupPage(url, fetcher) {
  for (let attempt=0; attempt<3; attempt++) {
    const response = await fetcher(url.href, {redirect:'manual', signal:AbortSignal.timeout(10000)});
    if ([401,403].includes(response.status)) throw Error('authorization');
    if (response.ok) return response.json();
    if (![429,500,502,503,504].includes(response.status) || attempt===2) throw Error('upstream');
    await response.body?.cancel();
    const retry = response.headers.get('retry-after');
    if (retry && retry!=='0') throw Error('upstream');
    await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)));
  }
}
export async function collectStartups(key, fetcher=fetch) {
  if (!key?.trim()) throw Error('configuration');
  const serviceKey = decodeURIComponent(key.trim());
  const pageSize = 100, notices = new Map();
  let target;
  for (let page=1; target===undefined || notices.size<target; page++) {
    const url = new URL(startupEndpoint);
    url.search = new URLSearchParams({serviceKey, page:String(page), perPage:String(pageSize), returnType:'json','cond[rcrt_prgs_yn::EQ]':'Y'});
    const payload = await startupPage(url,fetcher);
    // matchCount is the open-call count. totalCount also includes the archive.
    const count = payload.matchCount;
    if (!Number.isSafeInteger(count) || count<0 || (target!==undefined && count!==target) ||
        payload.page!==page || !Array.isArray(payload.data) || payload.currentCount!==payload.data.length ||
        payload.data.length!==Math.min(pageSize,count-notices.size)) throw Error('incomplete');
    target = count;
    for (const row of payload.data) {
      const item = mapStartup(row);
      if (notices.has(item.id)) throw Error('incomplete');
      notices.set(item.id,item);
    }
  }
  return [...notices.values()];
}

const startupStore = 'INSERT INTO startup_feed(part,synced_at,payload) VALUES(?,?,?) ON CONFLICT(part) DO UPDATE SET synced_at=excluded.synced_at,payload=excluded.payload WHERE excluded.synced_at>=startup_feed.synced_at';
let startupSync;
let startupRetryAfter=0;
let startupLastError='';
async function readStartupCache(db) {
  const {results} = await db.prepare('SELECT synced_at,payload FROM startup_feed WHERE synced_at=(SELECT synced_at FROM startup_feed WHERE part=0) ORDER BY part').all();
  if (!results.length) return null;
  const count = JSON.parse(results[0].payload);
  const items = results.slice(1).flatMap(row=>JSON.parse(row.payload));
  if (count!==items.length) throw Error('storage');
  return {items, updatedAt:new Date(results[0].synced_at).toISOString()};
}
async function refreshStartups(env) {
  const started = Date.now();
  const items = await collectStartups(env.DATA_GO_KR_SERVICE_KEY);
  const insert = env.DB.prepare(startupStore);
  const writes = [insert.bind(0,started,JSON.stringify(items.length))];
  for (let i=0;i<items.length;i+=20) writes.push(insert.bind(writes.length,started,JSON.stringify(items.slice(i,i+20))));
  writes.push(env.DB.prepare('DELETE FROM startup_feed WHERE synced_at<?').bind(started));
  await env.DB.batch(writes);
  return readStartupCache(env.DB);
}
const startupErrors = {
  configuration:'서버에 공공데이터포털 인증키를 설정해 주세요.',
  authorization:'공공데이터포털에서 K-Startup 활용 승인과 인증키를 확인해 주세요.',
  incomplete:'모집 중인 공고 전체를 확인하지 못했어요.',
  upstream:'창업진흥원 공고 연결이 지연되고 있어요.'
};
export async function handleStartups(request,env) {
  const respond=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','access-control-allow-origin':'*'}});
  if(request.method!=='GET')return respond({message:'GET 요청만 지원합니다.'},405);
  let cache;
  try {
    cache = await readStartupCache(env.DB);
    if (cache && Date.now()-Date.parse(cache.updatedAt)<startupCacheMs) return respond({...cache,mode:'live'});
    if (Date.now()<startupRetryAfter) throw Error(startupLastError);
    if (!startupSync) startupSync=refreshStartups(env).finally(()=>{startupSync=null;});
    const saved=await startupSync;
    return respond({...saved,mode:'live'});
  } catch(err) {
    const code=Object.hasOwn(startupErrors,err.message)?err.message:'upstream';
    if (Date.now()>=startupRetryAfter) {startupRetryAfter=Date.now()+60000;startupLastError=code;}
    const message=startupErrors[code];
    return cache?respond({...cache,mode:'snapshot',warning:message}):respond({code,message},503);
  }
}

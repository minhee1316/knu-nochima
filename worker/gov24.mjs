const gov24Ttl=6*3600000;
const gov24Host='https://api.odcloud.kr/api/gov24/v3/';
const gov24Text=value=>String(value??'').trim();
const gov24Id=/^[A-Za-z0-9_-]{3,40}$/;
let gov24Memo,gov24Pending;

export function gov24Scope(row){
  if(row['소관기관유형']==='중앙행정기관')return '중앙부처';
  const org=gov24Text(row['소관기관명']).replace(/\s+/g,'');
  if(['강원특별자치도','강원특별자치도교육청'].includes(org))return '강원';
  return /^(?:강원특별자치도)?(춘천|삼척)시$/.exec(org)?.[1]||'';
}
function gov24Link(value){
  try{
    const u=new URL(value);
    if(u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='gov.kr'||u.hostname.endsWith('.gov.kr')))return u.href;
  }catch{}
  return '';
}
export function gov24Item(r){
  const scope=gov24Scope(r);
  if(!scope)return null;
  const id=gov24Text(r['서비스ID']),title=gov24Text(r['서비스명']);
  if(!gov24Id.test(id)||!title)throw Error('incomplete');
  return {id,title,scope,org:gov24Text(r['소관기관명']),field:gov24Text(r['서비스분야']),due:gov24Text(r['신청기한']),summary:gov24Text(r['서비스목적요약']).slice(0,300),
    target:gov24Text(r['지원대상']).slice(0,450),format:gov24Text(r['지원유형']),url:gov24Link(r['상세조회URL']),modified:gov24Text(r['수정일시'])};
}
async function gov24Get(path,key,params,fetcher=fetch){
  if(!key?.trim())throw Error('configuration');
  const url=new URL(path,gov24Host);
  url.search=new URLSearchParams({returnType:'JSON',...params});
  for(let attempt=0;attempt<2;attempt++){
    const r=await fetcher(url.href,{headers:{Authorization:'Infuser '+key.trim()},redirect:'manual',signal:AbortSignal.timeout(18000)});
    if(r.ok)return r.json();
    if([401,403].includes(r.status))throw Error('authorization');
    if(attempt||![429,500,502,503,504].includes(r.status)||Number(r.headers.get('retry-after'))>1)throw Error('upstream');
    await r.body?.cancel();await new Promise(resolve=>setTimeout(resolve,1000));
  }
}
export async function collectGov24(key,fetcher=fetch){
  const rows=[],seen=new Set(),size=1000;
  let total;
  for(let page=1;page===1||seen.size<total;page++){
    const data=await gov24Get('serviceList',key,{page:String(page),perPage:String(size)},fetcher);
    if(!Number.isSafeInteger(data.totalCount)||data.totalCount<0||data.totalCount>100000||data.matchCount!==data.totalCount||
      (total!==undefined&&total!==data.totalCount)||data.page!==page||data.perPage!==size||!Array.isArray(data.data)||
      data.currentCount!==data.data.length||data.currentCount!==Math.min(size,data.totalCount-seen.size))throw Error('incomplete');
    total=data.totalCount;
    for(const raw of data.data){
      const id=gov24Text(raw['서비스ID']);
      if(!id||seen.has(id))throw Error('incomplete');seen.add(id);
      const item=gov24Item(raw);if(item)rows.push(item);
    }
  }
  return rows;
}
async function gov24Sync(env){
  const now=Date.now(),gen=crypto.randomUUID(),db=env.DB;
  const lock=await db.prepare('INSERT INTO gov24_state(id,lease,lease_until) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET lease=excluded.lease,lease_until=excluded.lease_until WHERE lease_until<=? AND retry_after<=? AND stamp<=?').bind(gen,now+240000,now,now,now-gov24Ttl).run();
  if(!lock.meta.changes)return;
  try{
    const rows=await collectGov24(env.GOV24_BENEFITS_API_KEY);
    const insert=db.prepare('INSERT INTO gov24_parts(generation,part,payload,created_at) VALUES(?,?,?,?)');
    const ops=[];
    for(let i=0;i<rows.length;i+=30)ops.push(insert.bind(gen,i,JSON.stringify(rows.slice(i,i+30)),now));
    ops.push(db.prepare('UPDATE gov24_state SET generation=?,stamp=?,lease=NULL,lease_until=0,retry_after=0 WHERE id=1 AND lease=?').bind(gen,now,gen));
    ops.push(db.prepare('DELETE FROM gov24_parts WHERE created_at<? AND generation<>(SELECT generation FROM gov24_state WHERE id=1)').bind(now-86400000));
    await db.batch(ops);
  }catch(e){
    await db.prepare('UPDATE gov24_state SET lease=NULL,lease_until=0,retry_after=? WHERE id=1 AND lease=?').bind(Date.now()+60000,gen).run();throw e;
  }
}
async function gov24Catalog(env){
  const state=()=>env.DB.prepare('SELECT * FROM gov24_state WHERE id=1').first();
  let meta=await state(),problem;
  if(!meta||Date.now()-meta.stamp>=gov24Ttl){
    if(!gov24Pending)gov24Pending=gov24Sync(env).finally(()=>{gov24Pending=null;});
    try{await gov24Pending;}catch(e){problem=e;}
    meta=await state();
  }
  if(!meta?.generation)throw problem||Error('syncing');
  if(gov24Memo?.gen!==meta.generation){
    const {results}=await env.DB.prepare('SELECT payload FROM gov24_parts WHERE generation=? ORDER BY part').bind(meta.generation).all();
    const items=results.flatMap(r=>JSON.parse(r.payload));
    gov24Memo={gen:meta.generation,items,byId:new Map(items.map(r=>[r.id,r]))};
  }
  return {...gov24Memo,updatedAt:new Date(meta.stamp).toISOString(),warning:Date.now()-meta.stamp>=gov24Ttl?'마지막으로 확인한 목록이에요.':null};
}
export async function gov24Detail(id,env){
  const catalog=await gov24Catalog(env),item=catalog.byId.get(id);
  if(!item)throw Error('missing');
  const cached=await env.DB.prepare('SELECT stamp,payload FROM gov24_detail WHERE id=?').bind(id).first();
  if(cached&&Date.now()-cached.stamp<gov24Ttl)return JSON.parse(cached.payload);
  try{
    const d=await gov24Get('serviceDetail',env.GOV24_BENEFITS_API_KEY,{page:'1',perPage:'1','cond[서비스ID::EQ]':id});
    const v=d?.data?.[0];if(d.matchCount!==1||gov24Text(v?.['서비스ID'])!==id)throw Error('upstream');
    const fields={purpose:'서비스목적',target:'지원대상',criteria:'선정기준',benefit:'지원내용',due:'신청기한',method:'신청방법',documents:'구비서류',required:'본인확인필요구비서류',office:'접수기관명',contact:'문의처',modified:'수정일시'};
    const record={...item,...Object.fromEntries(Object.entries(fields).map(([k,f])=>[k,gov24Text(v[f])])),checkedAt:new Date().toISOString()};
    await env.DB.prepare('INSERT INTO gov24_detail(id,stamp,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET stamp=excluded.stamp,payload=excluded.payload WHERE gov24_detail.stamp<=excluded.stamp').bind(id,Date.now(),JSON.stringify(record)).run();
    return record;
  }catch(e){
    if(cached)return {...JSON.parse(cached.payload),warning:'마지막으로 확인한 상세 정보예요.'};throw e;
  }
}
export async function handleGov24(request,env){
  const reply=(d,status=200)=>Response.json(d,{status,headers:{'cache-control':'no-store','access-control-allow-origin':'*'}});
  if(request.method!=='GET')return reply({message:'GET 요청만 지원합니다.'},405);
  try{
    const id=new URL(request.url).searchParams.get('id');
    if(id!==null)return gov24Id.test(id)?reply({item:await gov24Detail(id,env)}):reply({message:'서비스 번호를 확인해 주세요.'},400);
    const {items,updatedAt,warning}=await gov24Catalog(env);return reply({items,updatedAt,warning});
  }catch(e){
    const messages={configuration:'공공혜택 인증키 설정이 필요해요.',authorization:'공공혜택 API 인증을 확인해 주세요.',syncing:'공공혜택 목록을 갱신하고 있어요.',missing:'현재 목록에 없는 혜택이에요.'};
    return reply({code:Object.hasOwn(messages,e.message)?e.message:'upstream',message:messages[e.message]||'정부24 혜택 정보를 불러오지 못했어요.'},e.message==='missing'?404:503);
  }
}

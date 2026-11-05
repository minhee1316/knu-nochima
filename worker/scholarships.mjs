// One dated publication is synchronized at a time. Never combine monthly files.
const KOSAF_PATH='/15028252/v1/uddi:146a2f2a-3571-4768-9113-8dd47d67338b';
const KOSAF_SPEC='https://infuser.odcloud.kr/oas/docs?namespace=15028252/v1';
const KOSAF_PATH_RE=/^\/15028252\/v1\/uddi:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const KOSAF_TTL=24*60*60*1000;
const KOSAF_SIZE=500;
const KOSAF_EMPTY='정보 없음';
const kosafFields={
  name:'상품명',org:'운영기관명',orgType:'운영기관구분',product:'상품구분',aidType:'학자금유형구분',
  school:'대학구분',grade:'학년구분',major:'학과구분',gpa:'성적기준 상세내용',income:'소득기준 상세내용',
  benefit:'지원내역 상세내용',specific:'특정자격 상세내용',region:'지역거주여부 상세내용',
  limits:'자격제한 상세내용',selection:'선발방법 상세내용',people:'선발인원 상세내용',
  referral:'추천필요여부 상세내용',docs:'제출서류 상세내용',website:'홈페이지 주소',start:'모집시작일',end:'모집종료일'
};
const kosafMessages={
  configuration:'서버에 DATA_GO_KR_SERVICE_KEY를 설정한 뒤 다시 배포해 주세요.',
  path:'서버에 설정된 장학금 자료 경로를 확인해 주세요.',
  authorization:'공공데이터포털에서 인증키와 이 자료의 활용신청 승인 상태를 확인해 주세요.',
  syncing:'장학금 자료를 처음 동기화하고 있어요.',rate_limit:'공공데이터 API 호출 한도에 도달했어요.',
  upstream:'공공데이터 API에서 자료를 수집할 수 없어요.',incomplete:'전체 자료를 검증하지 못했어요.',
  storage:'장학금 저장소를 읽을 수 없어요.',missing:'목록을 새로 조회한 뒤 장학금을 다시 선택해 주세요.'
};
class KosafError extends Error{constructor(code){super(kosafMessages[code]);this.code=code;}}
function kosafJSON(data,status=200){
  return Response.json(data,{status,headers:{'cache-control':'no-store','access-control-allow-origin':'*'}});
}
export function kosafDate(input){
  const text=String(input??'').trim();
  const m=/^(\d{4})([-./]?)(\d{2})\2(\d{2})$/.exec(text);
  if(!m)return null;
  const iso=m[1]+'-'+m[3]+'-'+m[4];
  const dt=new Date(iso+'T00:00:00Z');
  return Number.isFinite(dt.valueOf())&&dt.toISOString().slice(0,10)===iso?iso:null;
}
export function kosafStatus(row,today){
  const start=kosafDate(row.start),end=kosafDate(row.end);
  if(!start||!end||end<start)return '기간 확인 필요';
  if(today<start)return '모집예정';
  return today>end?'마감':'모집중';
}
const kosafTerm=text=>String(text??'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
export function mapKosaf(raw){
  // Swagger uses 선발인원 상세내용. The published JSON also uses 선발 인원 상세내용.
  const fields=new Map(Object.entries(raw).map(([key,v])=>[kosafTerm(key),v]));
  if(!['상품명','운영기관명','상품구분'].every(key=>fields.has(key)))throw new KosafError('incomplete');
  const item={};
  for(const [key,label] of Object.entries(kosafFields)){
    const value=fields.get(kosafTerm(label));
    item[key]=value==null||String(value).trim()===''?KOSAF_EMPTY:String(value);
  }
  return item;
}
async function kosafUpstream(url,fetcher){
  for(let attempt=0;attempt<3;attempt++){
    let r;
    try{r=await fetcher(url.toString(),{signal:AbortSignal.timeout(12000),redirect:'manual'});}
    catch(err){console.warn('Scholarship provider connection failed',err?.name);throw new KosafError('upstream');}
    if([401,403].includes(r.status))throw new KosafError('authorization');
    if(r.ok){
      let value;try{value=await r.json();}catch{throw new KosafError('incomplete');}
      if(!Array.isArray(value?.data)&&/인증|권한|서비스\s*키|unauthori|forbidden/i.test(value?.msg||value?.message||''))throw new KosafError('authorization');
      return value;
    }
    const transient=[429,500,502,503,504].includes(r.status);
    if(!transient||attempt===2){
      console.warn('Scholarship provider returned HTTP',r.status);
      throw new KosafError(r.status===429?'rate_limit':'upstream');
    }
    await r.body?.cancel();
    const delay=r.headers.get('retry-after');
    const ms=delay&&/^\d+$/.test(delay)?Number(delay)*1000:delay?Date.parse(delay)-Date.now():NaN;
    if(ms>5000)throw new KosafError(r.status===429?'rate_limit':'upstream');
    await new Promise(done=>setTimeout(done,Math.max(150*(2**attempt),Number.isFinite(ms)?ms:0)));
  }
}
export async function collectKosaf(path,key,stage,fetcher=fetch){
  if(!key)throw new KosafError('configuration');
  if(!KOSAF_PATH_RE.test(path))throw new KosafError('path');
  // Accept either representation provided by the portal, then encode once via URLSearchParams.
  let decoded=key.trim();
  if(/%[0-9a-f]{2}/i.test(decoded)){try{decoded=decodeURIComponent(decoded);}catch{throw new KosafError('authorization');}}
  let total=null,seen=0,scholarships=0;
  for(let page=1;total===null||seen<total;page++){
    const url=new URL('/api'+path,'https://api.odcloud.kr');
    url.search=new URLSearchParams({serviceKey:decoded,page:String(page),perPage:String(KOSAF_SIZE),returnType:'JSON'});
    const result=await kosafUpstream(url,fetcher);
    const count=result?.totalCount,rows=result?.data;
    if(!Number.isSafeInteger(count)||count<0||result.page!==page||result.perPage!==KOSAF_SIZE||
      !Array.isArray(rows)||result.currentCount!==rows.length||result.matchCount!==count||
      (total!==null&&count!==total)||rows.length!==Math.min(KOSAF_SIZE,count-seen))throw new KosafError('incomplete');
    total=count;seen+=rows.length;
    const items=rows.map(mapKosaf).filter(row=>row.product.trim()==='장학금');
    scholarships+=items.length;
    await stage(items,page);
  }
  return {total,scholarships};
}
async function kosafSourceDate(path){
  if(path===KOSAF_PATH)return '2026-10-14';
  const r=await fetch(KOSAF_SPEC,{signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new KosafError('upstream');
  const op=(await r.json()).paths?.[path]?.get;
  if(!op)throw new KosafError('path');
  return kosafDate(op.summary?.match(/(\d{8})\s*$/)?.[1]);
}
const kosafMeta=db=>db.prepare('SELECT * FROM scholarship_catalog WHERE id=1').first();
async function syncKosaf(db,env,path){
  const lease=crypto.randomUUID(),now=Date.now();
  const lock=await db.prepare(`INSERT INTO scholarship_catalog(id,lease,lease_until) VALUES (1,?,?)
    ON CONFLICT(id) DO UPDATE SET lease=excluded.lease,lease_until=excluded.lease_until
    WHERE scholarship_catalog.lease_until<=? AND scholarship_catalog.retry_after<=?
    AND (scholarship_catalog.source_path IS NOT ? OR scholarship_catalog.synced_at<=? OR scholarship_catalog.generation IS NULL)`)
    .bind(lease,now+150000,now,now,path,now-KOSAF_TTL).run();
  if(!lock.meta.changes){
    const current=await kosafMeta(db);
    if(current?.generation)return current;
    throw new KosafError(current?.last_error||'syncing');
  }
  let part=0;
  try{
    const sourceDate=await kosafSourceDate(path);
    const insert=db.prepare('INSERT INTO scholarship_chunks(generation,kind,part,payload,created_at) VALUES(?,?,?,?,?)');
    const counts=await collectKosaf(path,env.DATA_GO_KR_SERVICE_KEY,async(rows,page)=>{
      const statements=[],index=[];
      // Bounded D1 rows for full notices, compact index for filtering before pagination.
      for(let i=0;i<rows.length;i+=16){
        const chunk=rows.slice(i,i+16);
        const bucket=part++;
        statements.push(insert.bind(lease,'detail',bucket,JSON.stringify(chunk),now));
        for(const [offset,row] of chunk.entries()){
          const {name,org,school,grade,major,start,end,aidType}=row;
          index.push({id:[lease,bucket,offset].join(':'),name,org,school,grade,major,start,end,aidType});
        }
      }
      statements.push(insert.bind(lease,'index',page,JSON.stringify(index),now));
      await db.batch(statements);
    });
    const published=await db.prepare(`UPDATE scholarship_catalog SET generation=?,source_path=?,source_date=?,synced_at=?,
      source_count=?,scholarship_count=?,lease=NULL,lease_until=0,retry_after=0,last_error=NULL WHERE id=1 AND lease=?`)
      .bind(lease,path,sourceDate,Date.now(),counts.total,counts.scholarships,lease).run();
    if(!published.meta.changes)throw new KosafError('syncing');
  }catch(err){
    const code=err instanceof KosafError?err.code:'storage';
    await db.prepare('DELETE FROM scholarship_chunks WHERE generation=?').bind(lease).run();
    await db.prepare('UPDATE scholarship_catalog SET lease=NULL,lease_until=0,retry_after=?,last_error=? WHERE id=1 AND lease=?')
      .bind(Date.now()+300000,code,lease).run();
    const saved=await kosafMeta(db);
    if(saved?.generation)return saved;
    throw new KosafError(code);
  }
  // Unpublished generations from interrupted workers expire without affecting readers.
  await db.prepare(`DELETE FROM scholarship_chunks WHERE
    created_at<? AND generation<>(SELECT generation FROM scholarship_catalog WHERE id=1)
    AND generation<>COALESCE((SELECT lease FROM scholarship_catalog WHERE id=1),'')`)
    .bind(Date.now()-2*86400000).run();
  return kosafMeta(db);
}
async function ensureKosaf(env){
  if(!env.DB)throw new KosafError('storage');
  const meta=await kosafMeta(env.DB),now=Date.now();
  const path=(env.DATA_GO_KR_SCHOLARSHIP_PATH||KOSAF_PATH).trim();
  const config=!env.DATA_GO_KR_SERVICE_KEY?.trim()?'configuration':!KOSAF_PATH_RE.test(path)?'path':null;
  if(config){if(meta?.generation)return {...meta,last_error:config};throw new KosafError(config);}
  if(meta?.generation&&meta.source_path===path&&now-meta.synced_at<KOSAF_TTL)return meta;
  if(meta?.retry_after>now||meta?.lease_until>now){
    if(meta.generation)return meta;
    throw new KosafError(meta.last_error||'syncing');
  }
  return syncKosaf(env.DB,env,path);
}
let kosafIndex=null;
async function readKosafIndex(db,meta){
  if(kosafIndex?.generation===meta.generation)return kosafIndex.rows;
  const {results}=await db.prepare("SELECT payload FROM scholarship_chunks WHERE generation=? AND kind='index' ORDER BY part").bind(meta.generation).all();
  const rows=results.flatMap(r=>JSON.parse(r.payload));
  if(rows.length!==meta.scholarship_count)throw new KosafError('syncing');
  kosafIndex={generation:meta.generation,rows};return rows;
}
const kosafFacets=['school','grade','major'];
export function searchKosaf(rows,params,today){
  const query=kosafTerm(params.get('q')),status=params.get('status');
  const filters=kosafFacets.map(k=>[k,kosafTerm(params.get(k))]);
  const options=Object.fromEntries(kosafFacets.map(k=>[k,new Set()]));
  const found=[];
  for(const row of rows){
    for(const k of kosafFacets)options[k].add(row[k]);
    if(query&&!kosafTerm(row.name).includes(query)&&!kosafTerm(row.org).includes(query))continue;
    if(filters.some(([k,v])=>v&&!kosafTerm(row[k]).includes(v)))continue;
    const current=kosafStatus(row,today);
    if(params.get('activeOnly')==='1'&&kosafDate(row.end)&&kosafDate(row.end)<today)continue;
    if(!status||status===current)found.push({...row,status:current});
  }
  const priority={'모집중':0,'모집예정':1,'기간 확인 필요':2,'마감':3};
  found.sort((a,b)=>priority[a.status]-priority[b.status]||a.name.localeCompare(b.name,'ko'));
  const size=12,pages=Math.max(1,Math.ceil(found.length/size));
  const page=Math.max(1,Math.min(pages,Math.floor(Number(params.get('page')))||1));
  return {items:found.slice((page-1)*size,page*size),total:found.length,page,pages,
    options:Object.fromEntries(kosafFacets.map(k=>[k,[...options[k]].sort((a,b)=>a.localeCompare(b,'ko'))]))};
}
export async function handleKosaf(request,env){
  if(request.method!=='GET')return kosafJSON({message:'GET 요청만 지원합니다.'},405);
  try{
    const url=new URL(request.url),meta=await ensureKosaf(env);
    const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
    const info={sourceDate:meta.source_date,syncedAt:new Date(meta.synced_at).toISOString(),sourceCount:meta.source_count,
      scholarshipCount:meta.scholarship_count,warning:meta.last_error?kosafMessages[meta.last_error]:null};
    if(url.pathname==='/api/scholarships/chat'){
      const index=await readKosafIndex(env.DB,meta);
      const open=index.filter(row=>kosafStatus(row,today)==='모집중');
      const buckets=[...new Set(open.map(row=>Number(row.id.split(':')[1])))];
      const details=new Map();
      for(let i=0;i<buckets.length;i+=32){
        const batch=buckets.slice(i,i+32);
        const {results}=await env.DB.prepare("SELECT part,payload FROM scholarship_chunks WHERE generation=? AND kind='detail' AND part IN ("+batch.map(()=>'?').join(',')+")")
          .bind(meta.generation,...batch).all();
        for(const chunk of results)details.set(chunk.part,JSON.parse(chunk.payload));
      }
      const items=open.map(row=>{
        const [,part,offset]=row.id.split(':');
        const detail=details.get(Number(part))?.[Number(offset)];
        if(!detail)throw new KosafError('syncing');
        return {id:row.id,...detail};
      });
      return kosafJSON({items,...info});
    }
    if(url.searchParams.has('id')){
      const [generation,part,i,...extra]=url.searchParams.get('id').split(':');
      if(extra.length||generation!==meta.generation||!/^\d{1,7}$/.test(part)||!/^\d{1,2}$/.test(i))throw new KosafError('missing');
      const row=await env.DB.prepare("SELECT payload FROM scholarship_chunks WHERE generation=? AND kind='detail' AND part=?").bind(generation,Number(part)).first();
      const item=row&&JSON.parse(row.payload)[Number(i)];
      if(!item)throw new KosafError('missing');
      return kosafJSON({item:{...item,status:kosafStatus(item,today)},...info});
    }
    return kosafJSON({...searchKosaf(await readKosafIndex(env.DB,meta),url.searchParams,today),...info});
  }catch(err){
    const code=err instanceof KosafError?err.code:'storage';
    return kosafJSON({code,message:kosafMessages[code]},code==='missing'?404:503);
  }
}

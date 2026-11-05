const work24Endpoint='https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo313L01.do';
const work24Day=86400000;
const work24Date=t=>new Date(t+9*3600000).toISOString().slice(0,10);
const work24Ttl=15*60000;
let work24Pending,work24Retry=0;

export function mapWork24(row){
  const clean=v=>String(v??'').trim();
  const title=clean(row.title),course=clean(row.trprId),round=clean(row.trprDegr);
  const start=clean(row.traStartDate),end=clean(row.traEndDate);
  if(!title||!/^\w+$/.test(course)||!/^\d+$/.test(round)||![start,end].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d))||end<start)throw Error('incomplete');
  const link=new URL(row.titleLink);
  if(link.protocol!=='https:'||link.hostname!=='www.work24.go.kr'||link.username||link.password)throw Error('incomplete');
  const address=clean(row.address),code=clean(row.trngAreaCd);
  const region=code==='51110'?'춘천':code==='51230'?'삼척':address.match(/(?:^|\s)(춘천|삼척)시?(?:\s|$)/)?.[1]||address.split(/\s+/).at(-1)||'강원';
  const orgId=clean(row.trainstCstId),seq=link.searchParams.get('prtcmpSeqNo')||'0';
  if(!/^\d*$/.test(orgId)||!/^\d+$/.test(seq))throw Error('incomplete');
  return {id:['work24',course,round,orgId||'0',seq].join('-'),title,org:clean(row.subTitle),region,address,start,end,
    format:clean(row.trainTarget),description:clean(row.contents),phone:clean(row.telNo),url:link.href};
}
export async function collectWork24(key,now=Date.now(),fetcher=fetch){
  if(!key)throw Error('configuration');
  const today=work24Date(now),ranges=[[-365,-1],[0,180]],items=new Map();
  for(const [lo,hi] of ranges){
    let expected;
    for(let page=1;page===1||(page-1)*100<expected;page++){
      const url=new URL(work24Endpoint);
      url.search=new URLSearchParams({authKey:key,returnType:'JSON',outType:'1',pageNum:String(page),pageSize:'100',
        srchTraArea1:'51',srchTraStDt:work24Date(now+lo*work24Day).replaceAll('-',''),srchTraEndDt:work24Date(now+hi*work24Day).replaceAll('-',''),sort:'ASC',sortCol:'2'});
      const res=await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(12000)});
      if(!res.ok)throw Error([401,403].includes(res.status)?'authorization':'upstream');
      const data=await res.json();
      if(data.error||data.errorMsg||data.ERROR)throw Error('provider');
      const count=Number(data.scn_cnt);
      if(data.scn_cnt==null||data.scn_cnt===''||!Number.isSafeInteger(count)||count<0||count>10000||Number(data.pageNum)!==page||
        (expected!==undefined&&expected!==count))throw Error('incomplete');
      const rows=data.srchList??(count===0?[]:null);
      if(!Array.isArray(rows)||rows.length!==Math.min(100,count-(page-1)*100))throw Error('incomplete');
      expected=count;
      for(const raw of rows){const item=mapWork24(raw);if(item.end>=today)items.set(item.id,item);}
    }
  }
  return {items:[...items.values()],from:work24Date(now-365*work24Day),until:work24Date(now+180*work24Day),updatedAt:new Date(now).toISOString()};
}
async function work24Cache(db){
  const row=await db.prepare('SELECT payload FROM work24_feed WHERE id=1').first();
  return row?JSON.parse(row.payload):null;
}
export async function handleWork24(request,env){
  const reply=(d,status=200)=>Response.json(d,{status,headers:{'cache-control':'no-store','access-control-allow-origin':'*'}});
  if(request.method!=='GET')return reply({message:'GET 요청만 지원합니다.'},405);
  let saved;
  try{
    saved=await work24Cache(env.DB);
    if(saved&&Date.now()-Date.parse(saved.updatedAt)<work24Ttl)return reply(saved);
    if(Date.now()<work24Retry)throw Error('upstream');
    if(!work24Pending)work24Pending=(async()=>{
      const data=await collectWork24(env.WORK24_TRAINING_API_KEY);
      await env.DB.prepare('INSERT INTO work24_feed(id,stamp,payload) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET stamp=excluded.stamp,payload=excluded.payload WHERE work24_feed.stamp<=excluded.stamp').bind(data.updatedAt,JSON.stringify(data)).run();
      return data;
    })().finally(()=>{work24Pending=null;});
    return reply(await work24Pending);
  }catch(err){
    work24Retry=Date.now()+30000;
    const message=err.message==='configuration'?'고용24 인증키 설정이 필요해요.':'고용24 훈련과정 조회가 지연되고 있어요.';
    return saved?reply({...saved,warning:message}):reply({message},503);
  }
}

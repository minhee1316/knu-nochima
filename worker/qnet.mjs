import subjects from '../data/qnet-subjects.json' with {type:'json'};

const directory=new Map(subjects.items.map(([code,name,category])=>[code,{code,name,category}]));
const endpoint='https://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList';
const inflight=new Map();
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
const phases=[
  ['docRegStartDt','docRegEndDt','필기 원서접수','원서접수'],
  ['docExamStartDt','docExamEndDt','필기 시험','시험'],
  ['docPassDt',null,'필기 합격 발표','합격 발표'],
  ['pracRegStartDt','pracRegEndDt','실기 원서접수','후속 원서접수'],
  ['pracExamStartDt','pracExamEndDt','실기 시험','후속 시험'],
  ['pracPassDt',null,'최종 합격 발표','후속 합격 발표']
];
function iso(raw){
  const m=/^(\d{4})(\d{2})(\d{2})$/.exec(String(raw??''));
  if(!m)return '';
  const d=m.slice(1).join('-'),time=Date.parse(d+'T00:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().startsWith(d)?d:'';
}
function failure(code){return Object.assign(new Error(code),{code});}
async function getPage(year,subject,key,pageNo,fetcher){
  const url=new URL(endpoint);
  url.search=new URLSearchParams({serviceKey:key,implYy:year,pageNo:String(pageNo),numOfRows:'50',dataFormat:'json',
    ...(subject?{qualgbCd:subject.category,jmCd:subject.code}:{})});
  for(let attempt=0;attempt<3;attempt++){
    const r=await fetcher(url,{signal:AbortSignal.timeout(11000)});
    if((r.status===429||r.status>=500&&r.status<=599)&&attempt<2){
      await r.body?.cancel();await new Promise(done=>setTimeout(done,250*(attempt+1)));continue;
    }
    if([401,403].includes(r.status))throw failure('auth');
    if(!r.ok)throw failure('upstream');
    const raw=await r.text();
    let data;try{data=JSON.parse(raw);}catch{
      if(/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|UNREGISTERED_KEY/i.test(raw))throw failure('auth');
      throw failure('response');
    }
    if(String(data.header?.resultCode)!=='00')throw failure(/인증|승인|등록되지|SERVICE_KEY|ACCESS_DENIED/i.test(data.header?.resultMsg||'')?'auth':'upstream');
    const body=data.body,total=Number(body?.totalCount);
    if(body?.totalCount==null||!Number.isSafeInteger(total)||total<0||Number(body.pageNo)!==pageNo)throw failure('response');
    const rows=body.items||[];
    if(!Array.isArray(rows)||rows.length!==Math.max(0,Math.min(50,total-(pageNo-1)*50)))throw failure('partial');
    return {rows,total};
  }
}
export async function collect(year,subject,key,fetcher=fetch){
  const first=await getPage(year,subject,key,1,fetcher);
  const rows=[...first.rows];
  for(let page=2;rows.length<first.total;page++){
    const next=await getPage(year,subject,key,page,fetcher);
    if(next.total!==first.total)throw failure('partial');
    rows.push(...next.rows);
  }
  const groups=new Map();
  for(const r of rows){
    if(String(r.implYy)!==year||!r.description||!r.qualgbCd||subject&&r.qualgbCd!==subject.category)throw failure('response');
    const periods=phases.flatMap(([a,b,technical,other],order)=>{
      const start=iso(r[a]),end=b?iso(r[b]):'';
      if((!start&&!end)||(start&&end&&start>end))return [];
      const label=r.qualgbCd==='T'?technical:other;
      const text=b?(start===end?start:(start||'시작일 미제공')+' ~ '+(end||'종료일 미제공')):start;
      return [{order,label,start,end,text}];
    });
    const identity=JSON.stringify([r.qualgbCd,r.implSeq,r.description,subject?null:periods]);
    let g=groups.get(identity);
    if(!g){
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
      const suffix=Array.from(new Uint8Array(hash).slice(0,10),v=>v.toString(16).padStart(2,'0')).join('');
      g={id:'qnet-'+year+'-'+(subject?.code||'all')+'-'+suffix,year,code:subject?.code||'',category:r.qualgbCd,
        categoryName:r.qualgbNm,round:String(r.implSeq??''),description:r.description,
        title:subject?subject.name+' · '+r.description:r.description,periods:[],
        url:subject?'https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd='+subject.code+'&tabGbn=1':'https://www.q-net.or.kr/crf021.do?id=crf02101'};
      groups.set(identity,g);
    }
    for(const p of periods)if(!g.periods.some(v=>v.order===p.order&&v.text===p.text))g.periods.push(p);
  }
  for(const g of groups.values())g.periods.sort((a,b)=>a.order-b.order||a.text.localeCompare(b.text));
  return {year,code:subject?.code||'',items:[...groups.values()]};
}
async function pack(value){
  const stream=new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
async function unpack(blob){
  const stream=new Blob([new Uint8Array(blob)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}
export async function catalog(year,code,env){
  const current=Number(today().slice(0,4)),subject=code?directory.get(code):null;
  if(!/^\d{4}$/.test(year)||Math.abs(Number(year)-current)>1||code&&!subject)throw failure('input');
  const id=year+'-'+(code||'all');
  if(inflight.has(id))return inflight.get(id);
  const task=(async()=>{
    const saved=await env.DB.prepare('SELECT stamp,payload FROM qnet_cache WHERE id=?').bind(id).first();
    if(saved&&Date.now()-saved.stamp<21600000)return unpack(saved.payload);
    try{
      if(!env.GOV24_BENEFITS_API_KEY)throw failure('config');
      const data=await collect(year,subject,env.GOV24_BENEFITS_API_KEY);
      const stamp=Date.now();data.syncedAt=new Date(stamp).toISOString();
      await env.DB.prepare('INSERT INTO qnet_cache(id,stamp,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET stamp=excluded.stamp,payload=excluded.payload WHERE excluded.stamp>=qnet_cache.stamp').bind(id,stamp,await pack(data)).run();
      return data;
    }catch(error){if(saved)return {...await unpack(saved.payload),warning:'stale'};throw error;}
  })();
  inflight.set(id,task);
  try{return await task;}finally{inflight.delete(id);}
}
export async function handle(request,env){
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'access-control-allow-origin':'*','cache-control':'no-store'}});
  if(request.method!=='GET')return reply({code:'method'},405);
  const q=new URL(request.url).searchParams;
  try{return reply(await catalog(q.get('year')??today().slice(0,4),q.get('code')||'',env));}
  catch(e){return reply({code:e.code||'upstream'},e.code==='input'?400:503);}
}

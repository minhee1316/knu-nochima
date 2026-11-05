import { XMLParser } from 'fast-xml-parser';

const base='https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/';
const pageSize=500, ttl=6*3600000;
const pending=new Map();
const serviceId=/^WLF\d{8}$/;
const parser=new XMLParser({parseTagValue:false,ignoreAttributes:true});
const clean=value=>typeof value==='string'?value.replace(/&#(x[\da-f]+|\d+);/gi,(token,number)=>{
  const point=number[0].toLowerCase()==='x'?parseInt(number.slice(1),16):Number(number);
  return point>0&&point<=0x10ffff?String.fromCodePoint(point):token;
}).replace(/\r\n?/g,'\n').trim():'';
const array=value=>value==null||value===''?[]:Array.isArray(value)?value:[value];

async function read(operation,params,key,fetcher){
  if(!key)throw Error('configuration');
  const url=new URL(operation,base);
  url.search=new URLSearchParams({serviceKey:key,...params});
  for(let attempt=0;attempt<2;attempt++){
    const res=await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(16000)});
    if(!res.ok){
      if(attempt===0&&[502,503,504].includes(res.status)){await res.body?.cancel();continue;}
      throw Error([401,403].includes(res.status)?'authorization':'upstream');
    }
    const xml=await res.text();
    if(xml.length>5000000||/<!DOCTYPE/i.test(xml))throw Error('incomplete');
    const data=parser.parse(xml);
    const row=params.callTp==='L'?data.wantedList:data.wantedDtl;
    const code=row?.resultCode??data.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode;
    if(code==='0'||code==='00')return row;
    throw Error(['20','30','31'].includes(code)?'authorization':'upstream');
  }
}

function serviceLink(value){
  try{
    const url=new URL(value);
    if(url.protocol==='https:'&&!url.username&&!url.password&&['www.bokjiro.go.kr','bokjiro.go.kr'].includes(url.hostname))return url.href;
  }catch{}
  return '';
}

export async function collect(key,fetcher=fetch){
  const items=new Map();let total;
  for(let page=1;page===1||items.size<total;page++){
    const res=await read('NationalWelfarelistV001',{callTp:'L',srchKeyCode:'003',pageNo:String(page),numOfRows:String(pageSize)},key,fetcher);
    const count=Number(res.totalCount),rows=array(res.servList);
    if(!/^\d+$/.test(res.totalCount)||!Number.isSafeInteger(count)||count>20000||Number(res.pageNo)!==page||
      (total!==undefined&&count!==total)||rows.length!==Math.min(pageSize,count-items.size))throw Error('incomplete');
    total=count;
    for(const r of rows){
      const id=clean(r.servId),title=clean(r.servNm);
      if(!serviceId.test(id)||!title||items.has(id))throw Error('incomplete');
      items.set(id,{id,title,scope:'중앙부처',org:clean(r.jurMnofNm),field:clean(r.intrsThemaArray),summary:clean(r.servDgst),
        life:clean(r.lifeArray),household:clean(r.trgterIndvdlArray),format:clean(r.srvPvsnNm),url:serviceLink(r.servDtlLink)});
    }
  }
  return [...items.values()];
}

export async function readDetail(item,key,fetcher=fetch){
  const r=await read('NationalWelfaredetailedV001',{callTp:'D',servId:item.id},key,fetcher);
  if(r.servId!==item.id)throw Error('incomplete');
  const method=array(r.applmetList).map(x=>clean(x.servSeDetailLink)).filter(Boolean).join('\n');
  const contacts=array(r.inqplCtadrList).map(x=>[clean(x.servSeDetailNm),clean(x.servSeDetailLink)].filter(Boolean).join(' · ')).filter(Boolean);
  return {...item,org:clean(r.jurMnofNm)||item.org,target:clean(r.tgtrDtlCn),criteria:clean(r.slctCritCn),benefit:clean(r.alwServCn),method,
    cycle:clean(r.sprtCycNm),year:clean(r.crtrYr),contact:[...new Set([clean(r.rprsCtadr),...contacts].filter(Boolean))].join('\n')};
}

async function cache(db,id,load){
  const saved=await db.prepare('SELECT stamp,payload FROM bokjiro_cache WHERE id=?').bind(id).first();
  const previous=()=>({data:JSON.parse(saved.payload),updatedAt:new Date(saved.stamp).toISOString()});
  if(saved&&Date.now()-saved.stamp<ttl)return previous();
  if(!pending.has(id)){
    const request=(async()=>{
      const stamp=Date.now(),data=await load();
      await db.prepare('INSERT INTO bokjiro_cache(id,stamp,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET stamp=excluded.stamp,payload=excluded.payload WHERE stamp<=excluded.stamp')
        .bind(id,stamp,JSON.stringify(data)).run();
      return {data,updatedAt:new Date(stamp).toISOString()};
    })().finally(()=>pending.delete(id));
    pending.set(id,request);
  }
  try{return await pending.get(id);}catch(error){if(saved)return {...previous(),warning:'최근 갱신이 지연되어 마지막으로 확인한 자료를 표시해요.'};throw error;}
}
const list=env=>cache(env.DB,'list',()=>collect(env.GOV24_BENEFITS_API_KEY));
export async function detail(id,env){
  const {data}=await list(env),item=data.find(r=>r.id===id);
  if(!item)throw Error('missing');
  const saved=await cache(env.DB,id,()=>readDetail(item,env.GOV24_BENEFITS_API_KEY));
  const fields=Object.fromEntries(Object.entries(saved.data).map(([key,value])=>[key,clean(value)]));
  return {...fields,checkedAt:saved.updatedAt,warning:saved.warning};
}

export async function handle(request,env){
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'access-control-allow-origin':'*','cache-control':'no-store'}});
  if(request.method!=='GET')return reply({message:'GET 요청만 지원합니다.'},405);
  try{
    const id=new URL(request.url).searchParams.get('id');
    if(id!==null)return serviceId.test(id)?reply({item:await detail(id,env)}):reply({message:'서비스 번호를 확인해 주세요.'},400);
    const {data,updatedAt,warning}=await list(env);
    return reply({items:data,updatedAt,warning});
  }catch(error){
    const messages={configuration:'복지로 인증키 설정이 필요해요.',authorization:'복지로 API 인증을 확인해 주세요.',missing:'현재 복지로 목록에 없는 서비스예요.'};
    return reply({message:messages[error.message]||'복지로 서비스 조회가 지연되고 있어요.'},error.message==='missing'?404:503);
  }
}

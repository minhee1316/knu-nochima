const datasets = {
  people: {id:'15114806',path:'/15114806/v1/uddi:7ec9a043-a206-4f74-a127-c9966bbc1940',title:'국가장학금 신청 및 수혜인원'},
  family: {id:'15113367',path:'/15113367/v1/uddi:635815ee-0680-4cc1-9369-a51113a1d940',title:'다자녀 국가장학금 지원금액'}
};
const pending = new Map();
const ttl = 86400000;
export async function collect(type,key,fetcher=fetch) {
  const spec=datasets[type];
  if(!spec||!key)throw Error('configuration');
  const rows=[];
  let total;
  for(let page=1;page===1||rows.length<total;page++){
    const url=new URL(spec.path,'https://api.odcloud.kr/api');
    url.pathname='/api'+spec.path;
    url.search=new URLSearchParams({serviceKey:key,page:String(page),perPage:'500',returnType:'JSON'});
    let response;
    for(let attempt=0;attempt<3;attempt++){
      response=await fetcher(url,{signal:AbortSignal.timeout(12000)});
      if((response.status===429||response.status>=500)&&attempt<2){await response.body?.cancel();await new Promise(r=>setTimeout(r,250*(attempt+1)));continue;}
      break;
    }
    if(!response.ok)throw Error([401,403].includes(response.status)?'authorization':'upstream');
    const body=await response.json();
    if(!Array.isArray(body.data)||!Number.isSafeInteger(body.totalCount)||body.totalCount<0||body.totalCount>50000||body.currentCount!==body.data.length||body.page!==page)throw Error('response');
    if(total!=null&&total!==body.totalCount)throw Error('partial');
    total=body.totalCount;
    if(body.data.length!==Math.min(500,total-rows.length))throw Error('partial');
    rows.push(...body.data);
  }
  const required=type==='people'?['신청인원(명)','수혜인원(명)']:['총수혜금액'];
  if(rows.some(r=>!('기준년도' in r)||!('장학학기 명' in r)||required.some(k=>!(k in r)||(r[k]!=null&&r[k]!==''&&!Number.isFinite(r[k])))))throw Error('schema');
  return {type,title:spec.title,sourceDate:'2025-12-31',url:'https://www.data.go.kr/data/'+spec.id+'/fileData.do',rows,syncedAt:new Date().toISOString()};
}
export async function catalog(type,env){
  if(!datasets[type])throw Error('input');
  if(!env.DB)throw Error('storage');
  if(pending.has(type))return pending.get(type);
  const task=(async()=>{
    const previous=await env.DB.prepare('SELECT stamp,payload FROM scholarship_statistics WHERE id=?').bind(type).first();
    if(previous&&Date.now()-previous.stamp<ttl)return JSON.parse(previous.payload);
    try{
      const data=await collect(type,env.DATA_GO_KR_SERVICE_KEY);
      const stamp=Date.now();
      await env.DB.prepare('INSERT INTO scholarship_statistics(id,stamp,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET stamp=excluded.stamp,payload=excluded.payload WHERE excluded.stamp>=scholarship_statistics.stamp').bind(type,stamp,JSON.stringify(data)).run();
      return data;
    }catch(error){if(previous)return {...JSON.parse(previous.payload),warning:'이전 정상 조회 자료를 표시합니다. 새 자료 확인이 지연되고 있어요.'};throw error;}
  })();
  pending.set(type,task);
  try{return await task;}finally{pending.delete(type);}
}
export function record(data,index){
  const row=data.rows[index];
  if(!row)return null;
  const body=Object.entries(row).map(([key,value])=>key+' · '+(value==null||value===''?'정보 없음':String(value))).join('\n');
  return {id:'kosafstats-'+data.type+'-'+index,kind:'statistics',type:'장학통계',title:data.title+' · '+row['기준년도']+'년 '+row['장학학기 명']+' · '+row['대학구분그룹 명']+' '+row['설립형태 명'],
    body,raw:row,url:data.url,source:'한국장학재단',sourceDate:data.sourceDate,syncedAt:data.syncedAt,cond:{},docs:[]};
}
export async function handle(request,env){
  const type=new URL(request.url).searchParams.get('type')||'people';
  try{return Response.json(await catalog(type,env),{headers:{'access-control-allow-origin':'*','cache-control':'no-store'}});}
  catch(e){
    const errors={configuration:'공공데이터 인증키 설정이 필요합니다.',authorization:'이 통계 API의 활용 승인과 인증키를 확인해 주세요.',input:'통계 종류를 확인해 주세요.'};
    return Response.json({error:errors[e.message]||'장학통계를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.'},{status:e.message==='input'?400:503,headers:{'access-control-allow-origin':'*','cache-control':'no-store'}});
  }
}

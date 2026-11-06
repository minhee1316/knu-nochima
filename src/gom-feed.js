// Both the notice list and each conversation turn read the same NOTICES array.
const feedState={started:0,loading:null,school:'저장본',events:'저장본'};
const feedOrigin=location.protocol==='file:'?'https://knu-esungan-preview-20261105.hydroai4.chatgpt.site':'';
// Accept a whole audience clause so a course title, preference or future grade cannot exclude a student.
function listedGrades(text){
  for(const part of String(text||'').split(/\n|[.;。]/)){
    const m=part.trim().match(/^(?:[-·○•]\s*)?(?:신청\s*대상|지원\s*대상|지원\s*자격|모집\s*대상|참여\s*대상|선발\s*대상|대상)\s*[:：]\s*(?:강원대학교\s*)?(?:학부(?:생)?\s*|대학교?\s*)?([1-5])\s*(?:학년\s*)?(?:([~∼–-])\s*([1-5])\s*)?학년\s*(?:재학생|학부생|학생)?\s*(?:만|대상)?\s*$/);
    if(m&&(!m[3]||+m[3]>=+m[1]))return GRADE.filter(g=>+g>=+m[1]&&+g<=+(m[3]||m[1]));
  }
  return null;
}
function feedSchool(row){
  const match=String(row.url||'').match(/\/bbs\/(\d+)\/detail\.do\?pstSn=(\d+)/);
  if(!match||!row.title)return null;
  const id=match[1]+'-'+match[2];const campuses=(row.campuses||[]).includes('전체')?[]:(row.campuses||[]).filter(c=>CAMPUS.includes(c));
  const type=({'장학공지':'장학금','공모안내':'공모전','행사안내':'비교과'})[row.board]||'공지';
  const text=String(row.body||'');
  const perks=text.split(/(?<=[.!?。])\s+|\n+/).filter(s=>/1365|마일리지|봉사\s*시간|VMS/i.test(s)).slice(0,4).map(s=>({k:'관련 문구',ev:s.slice(0,260)}));
  return {id,type,title:row.title,url:row.url,source:row.board,org:'강원대학교',posted:row.postedAt,
    amount:0,body:text,snippet:text.slice(0,160),cond:{campus:campuses.length?campuses:null,grade:listedGrades(text)},aiPending:true,
    docs:[],files:row.files||[],images:row.images||[],tags:window.GOM?.tagsFor(row.title+' '+text.slice(0,1500))||[],perks,
    rules:readFeedRules(row).map(r=>({...r,field:({year:'grade',status:'academic'})[r.field]||r.field}))};
}
function feedEvent(row){
  if(!row.id||!CAMPUS.includes(row.region)||!row.title||!/^\d{4}-\d{2}-\d{2}$/.test(row.endAt))return null;
  return {id:String(row.id),kind:'event',region:row.region,title:row.title,start:row.startAt,deadline:row.endAt,address:row.address||'',
    type:'지역행사',source:row.source,org:row.source,url:row.url,cond:{},body:row.body||'',snippet:(row.body||'').slice(0,160),amount:0,tags:window.GOM?.tagsFor(row.title+' '+(row.body||''))||[],docs:[],files:[]};
}
function combineSchool(old,n){
  if(!old)return n;
  // List-only responses cannot supersede a previously read full announcement.
  const norm=v=>String(v||'').replace(/\s+/g,'');
  const previous=norm(old.body),next=norm(n.body);
  const changed=next.length>40 && (!previous || (next!==previous&&!previous.includes(next)));
  if(changed || old.title!==n.title){
    window.gomConversation?.state.recommendations.delete(n.id);
    const matches=(old.scan||[]).filter(s=>n.files?.some(f=>f.url===s.url));
    return {...n,scan:matches};
  }
  return {...old,title:n.title,url:n.url,posted:n.posted||old.posted,body:old.body||n.body,files:n.files?.length?n.files:old.files};
}
function loadShared(){
  const external=JSON.parse(document.getElementById('external-notices').textContent);
  const initial=[...(window.EMBED?.notices||[]),...external.map(n=>({...n,cond:{grade:listedGrades(n.body)}}))];
  NOTICES.splice(0,NOTICES.length,...initial);
  refreshFeed();render();
}
async function refreshFeed(force=false){
  if(feedState.loading)return feedState.loading;
  if(!force&&feedState.started&&Date.now()-feedState.started<900000)return;
  feedState.started=Date.now();
  feedState.loading=(async()=>{
    const get=async key=>{const r=await fetch(feedOrigin+'/api/'+key,{cache:'no-store',signal:AbortSignal.timeout(22000)});if(!r.ok)throw Error();const j=await r.json();if(!Array.isArray(j.items))throw Error();return j;};
    const [a,b]=await Promise.allSettled([get('notices'),get('events')]);
    const rows=new Map(NOTICES.map(n=>[String(n.id),n]));
    if(a.status==='fulfilled'){
      const data=a.value;
      for(const raw of data.items){const n=feedSchool(raw);if(n)rows.set(n.id,combineSchool(rows.get(n.id),n));}
    }
    if(b.status==='fulfilled'){
      const data=b.value;
      if(data.mode==='live')for(const [id,n] of rows)if(n.kind==='event')rows.delete(id);
      const seen=new Set([...rows.values()].filter(n=>n.kind==='event').map(n=>n.region+'|'+n.title+'|'+n.start));
      for(const raw of data.items){const n=feedEvent(raw);if(n){const k=n.region+'|'+n.title+'|'+n.start;if(!seen.has(k)){rows.set(n.id,n);seen.add(k);}}}
    }
    NOTICES.splice(0,NOTICES.length,...rows.values());
    window.facultyDesk?.refresh();
    const stamp=(r,last)=>r.status==='fulfilled'&&r.value.mode==='live'&&r.value.updatedAt?'확인 '+new Date(r.value.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):last.replace(' · 연결 지연','')+' · 연결 지연';
    feedState.school=stamp(a,feedState.school);feedState.events=stamp(b,feedState.events);
    $('#sample-note').textContent='학교 공지 '+feedState.school+' / 지역 행사 '+feedState.events;
    render();
  })().finally(()=>{feedState.loading=null;});return feedState.loading;
}
setInterval(()=>{if(!document.hidden)refreshFeed();},900000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFeed();});


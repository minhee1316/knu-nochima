(()=>{
  const $=id=>document.getElementById(id);
  const normalize=text=>String(text).normalize('NFKC').replace(/\s/g,'').toLowerCase();
  const registry=JSON.parse($('qnet-subjects').textContent);
  const directory=registry.items
    .map(([code,name,category])=>({code,name,category,key:normalize(name)})).sort((a,b)=>b.key.length-a.key.length);
  const clock=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  const current=Number(clock().slice(0,4)),yearBox=$('exam-year'),categoryBox=$('exam-category');
  for(const year of [current+1,current,current-1])yearBox.add(new Option(year+'년',String(year),false,year===current));
  const keys=new Map(),byId=new Map();
  const subjectBox=$('exam-subject'),regBox=$('exam-reg-filter');
  function portal(category,code){
    if(['C','W'].includes(category))return 'https://c.q-net.or.kr/';
    if(category==='S'){
      const subject=directory.find(s=>s.code===code);
      const family=Object.keys(registry.applySites).sort((a,b)=>b.length-a.length).find(name=>subject?.key.includes(normalize(name)));
      return registry.applySites[family]||'https://www.q-net.or.kr/man001.do?gSite=Q';
    }
    return 'https://www.q-net.or.kr/rcv202.do?id=rcv20210&gSite=Q&gId=';
  }
  function registrations(n,day=clock()){
    return n.periods.filter(p=>p.order===0||p.order===3).map(p=>({...p,
      state:p.end&&p.end<day?'closed':p.start&&p.start>day?'future':p.start&&p.end?'open':'unknown'
    })).sort((a,b)=>String(a.start||a.end).localeCompare(String(b.start||b.end)));
  }
  function currentWindow(n){
    const windows=registrations(n);
    return windows.find(p=>p.state==='open')||windows.find(p=>p.state==='future')||windows.find(p=>p.state==='unknown')||windows.at(-1);
  }
  const captions={open:'접수 기간 중',future:'접수 예정',closed:'접수 종료',unknown:'접수일 확인'};
  const registrationLabel=n=>captions[currentWindow(n)?.state||'unknown'];
  const isOpen=n=>registrations(n).some(p=>p.state==='open');
  function refreshSubjects(){
    const subjects=directory.filter(s=>!categoryBox.value||categoryBox.value===s.category).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    subjectBox.replaceChildren(new Option(subjects.length?'전체 종목':'구분별 회차 조회',''),...subjects.map(s=>new Option(s.name,s.code)));
    subjectBox.disabled=!subjects.length;
  }
  refreshSubjects();
  let activeKey='',timer;
  function parse(text,defaultYear=current){
    const normalized=normalize(text),subject=directory.find(s=>normalized.includes(s.key)||text.trim()===s.code);
    const year=String(text.match(/(?:19|20)\d{2}(?=\s*년|\b)/)?.[0]||defaultYear);
    const round=text.match(/(?:제\s*)?(\d{1,3})\s*회/)?.[1]||'';
    const category=subject?'':[['국가기술','T'],['국가전문','S'],['과정평가','C'],['일학습병행','W']].find(([name])=>normalized.includes(name))?.[1]||'';
    return {year,subject,round,category,key:year+'-'+(subject?.code||'all')};
  }
  const recognizes=t=>!!parse(t).subject||/큐넷|q[\s-]*net|국가\s*자격|자격(?:증)?\s*시험/i.test(t);
  const heading=n=>n.code?n.title:n.description;
  function next(n){
    const now=clock();
    return n.periods.filter(p=>(p.end||p.start)>=now).sort((a,b)=>
      (a.start||a.end).localeCompare(b.start||b.end))[0];
  }
  function distance(n){
    if(n.registrationSort)return (isOpen(n)?'0':'1')+n.registrationSort;
    const p=next(n);return p?(p.start||p.end):'9999';
  }
  function paper(item){
    const phase=next(item);
    return {...item,title:heading(item),kind:'exam',type:'자격시험',source:'큐넷',org:'한국산업인력공단',
      body:[item.description,item.year+'년',item.categoryName,...item.periods.map(p=>p.label+' '+p.text)].join('\n'),
      snippet:phase?phase.label+' · '+phase.text:'해당 회차의 일정은 상세에서 확인하세요.',
      tags:['취업·진로'],cond:{},docs:[]};
  }
  function read(ctx){
    const previous=keys.get(ctx.key);
    if(previous?.pending)return previous.pending;
    if(previous?.until>Date.now())return Promise.resolve(previous);
    const entry={rows:previous?.rows||[],status:'큐넷 시험일정을 불러오는 중…'};
    keys.set(ctx.key,entry);
    entry.pending=(async()=>{
      try{
        const query=new URLSearchParams({year:ctx.year});
        if(ctx.subject)query.set('code',ctx.subject.code);
        const r=await fetch(feedOrigin+'/api/exams?'+query,{signal:AbortSignal.timeout(65000)});
        const d=await r.json();
        if(!r.ok||!Array.isArray(d.items))throw Error(d.code);
        const rows=d.items.map(paper);
        rows.forEach(n=>byId.set(n.id,n));entry.rows=rows;
        entry.status=(d.warning?'최근 동기화 실패 · 마지막 정상 자료':'한국산업인력공단 · 큐넷')+' · '+new Date(d.syncedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' 기준'+
          (rows.length?'': ' · 이 조건으로 등록된 일정이 없어요.');
        entry.until=Date.now()+(d.warning?60000:900000);
      }catch(e){
        const messages={auth:'공공데이터 인증을 확인해야 해요.',config:'서버의 공공데이터 인증 설정이 필요해요.',input:'조회 가능한 연도와 종목을 확인해 주세요.'};
        entry.status=messages[e.message]||'큐넷 일정을 불러오지 못했어요. 잠시 후 다시 조회하세요.';
        if(entry.rows.length)entry.status+=' 마지막 정상 자료를 표시해요.';
        entry.until=Date.now()+30000;
      }finally{entry.pending=null;if(activeKey===ctx.key)render();}
      return entry;
    })();
    return entry.pending;
  }
  function narrow(rows,ctx,category){
    return rows.filter(n=>(!ctx.round||n.round===ctx.round)&&(!category||n.category===category))
      .sort((a,b)=>distance(a).localeCompare(distance(b))||Number(b.round)-Number(a.round)||a.title.localeCompare(b.title,'ko'));
  }
  function list(text,type){
    const dedicated=type==='자격시험',show=dedicated||type==='전체'&&recognizes(text);
    $('exam-options').hidden=!show;
    if(dedicated)$('ask-q').setAttribute('list','exam-names');else $('ask-q').removeAttribute('list');
    if(!show){activeKey='';clearTimeout(timer);return [];}
    const ctx=parse(text,yearBox.value||current);
    subjectBox.value=ctx.subject?.code||'';
    $('exam-portal').href=portal(categoryBox.value||ctx.subject?.category,ctx.subject?.code);
    if(activeKey!==ctx.key){activeKey=ctx.key;clearTimeout(timer);}
    const e=keys.get(ctx.key);
    if(!e?.pending&&!(e?.until>Date.now())){
      clearTimeout(timer);timer=setTimeout(()=>read(ctx),140);
    }
    $('exam-status').textContent=e?.status||'큐넷 시험일정을 불러오는 중…';
    const pool=narrow(e?.rows||[],ctx,categoryBox.value||ctx.category);
    if(!dedicated)return pool;
    const rows=[];
    for(const n of pool){
      const windows=registrations(n);
      const relevant=windows.filter(p=>regBox.value?p.state===regBox.value:p.state!=='closed');
      if(!relevant.length&&(regBox.value||windows.length))continue;
      const phase=relevant.find(p=>p.state==='open')||relevant[0];
      rows.push({...n,snippet:phase?phase.label+' · '+phase.text:'공개된 접수일이 없어 공식 일정 확인이 필요해요.',registrationSort:phase?.start||phase?.end||'9999'});
    }
    if(e&&!e.pending&&e.rows.length&&!rows.length){
      const closed=pool.flatMap(n=>registrations(n)).filter(p=>p.state==='closed').sort((a,b)=>b.end.localeCompare(a.end))[0];
      $('exam-status').textContent=e.status+' · 선택한 조건에 해당하는 접수 일정이 없어요.'+(ctx.subject&&closed?' 최근 접수 종료: '+closed.label+' '+closed.end:'');
    }
    return rows;
  }
  function searchMatch(n,text){
    const ctx=parse(text);
    if(ctx.round&&n.round!==ctx.round)return false;
    let rest=normalize(text);
    if(ctx.subject)rest=rest.replace(ctx.subject.key,'').replace(ctx.subject.code,'');
    rest=rest.replace(/(?:19|20)\d{2}년?|제?\d+회|큐넷|q-?net|국가자격(?:증)?(?:시험)?|자격(?:증)?시험|시험일정|일정|종목|원서접수|시험|조회|검색/g,'');
    return !rest||normalize(n.title+' '+n.categoryName+' '+n.body).includes(rest);
  }
  async function lookup(text,terms){
    const ctx=parse(text);
    // A named qualification must match the official directory before a group schedule can be attributed to it.
    if(!ctx.subject&&!ctx.category&&terms?.some(w=>w&&!/일정|큐넷|자격|필기|실기|접수|시험|발표|합격|기사|산업기사|기능사|기술사|기능장/.test(w))){
      return [];
    }
    if(!ctx.subject&&!ctx.category&&/(?:[a-z]{2,}|[가-힣]{2,}(?:기사|기능사|시험))\s*(?:자격증|시험|접수|일정)/i.test(text.replace(/국가\s*자격(?:증)?\s*시험|자격(?:증)?\s*시험|큐넷|q-?net/gi,'')))return [];
    const entry=await read(ctx);
    let rows=narrow(entry.rows,ctx,ctx.category);
    const grade=!ctx.subject&&text.match(/산업기사|기능사|기술사|기능장|기사/)?.[0];
    if(grade)rows=rows.filter(n=>n.description.includes(grade));
    return rows.slice(0,5);
  }
  function showDetails(n){
    const dl=document.createElement('dl');dl.className='kv';
    const fields=[['출처','한국산업인력공단 · 큐넷'],['구분',n.categoryName],...n.periods.map(p=>[p.label,p.text])];
    for(const [label,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}
    const note=document.createElement('p');note.className='hint';
    note.textContent=(n.code?'':'종목별 일정은 자격 종목명으로 검색하세요. ')+(n.periods.length?'접수 시각과 시험장은 큐넷 원문에서 확인하세요.':'공개된 날짜가 없어 큐넷 원문 확인이 필요해요.');
    const section=$('dlg-view');
    section.replaceChildren(dl,note);
    if(isOpen(n)){
      const a=document.createElement('a');a.href=portal(n.category,n.code);a.target='_blank';a.rel='noopener';a.className='btn blue sm';a.textContent='공식 사이트에서 원서접수 ↗';section.append(a);
    }
  }
  const dl=$('exam-names');
  for(const s of [...directory].sort((a,b)=>a.name.localeCompare(b.name,'ko')))dl.append(new Option(s.name,s.name));
  yearBox.onchange=regBox.onchange=()=>{view.page=1;render();};
  function selectSubject(name){
    $('ask-q').value=name;view.q=name;view.page=1;render();
  }
  categoryBox.onchange=()=>{refreshSubjects();selectSubject('');};
  subjectBox.onchange=()=>selectSubject(directory.find(s=>s.code===subjectBox.value)?.name||'');
  window.examFeed={list,lookup,recognizes,searchMatch,parse,showDetails,distance,registrationLabel,isOpen,portal,find:id=>byId.get(id),
    fact:n=>n.periods.map(p=>p.label+' '+p.text).join(' · ')||'일정 미제공',
    status:text=>keys.get(parse(text).key)?.status||'큐넷에서 종목명을 확인해 주세요.'};
  function open(){if(location.hash==='#exams'){view.onlyInt=false;openCatalogType('자격시험');}}
  addEventListener('hashchange',open);open();
})();

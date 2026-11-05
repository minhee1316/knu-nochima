(()=>{
  const checkbox=document.getElementById('gom-cloud');
  try{checkbox.checked=localStorage.getItem('gom-cloud-enabled')!=='false';}catch{}
  checkbox.onchange=()=>{try{localStorage.setItem('gom-cloud-enabled',String(checkbox.checked));}catch{}};
  let engine,scholarships=new Map(),loaded=0,request,stale=false;
  const useful=s=>s&&s!=='정보 없음'?s:'';
  const safeLink=s=>{try{const u=new URL(s);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
  const search=()=>engine??=createGomSearch(JSON.parse(document.getElementById('gom-model').textContent));
  async function readScholarships(){
    if(loaded&&Date.now()-loaded<600000)return;
    if(request)return request;
    request=(async()=>{
      try{
        const r=await fetch(feedOrigin+'/api/scholarships/chat',{signal:AbortSignal.timeout(9000)});
        if(!r.ok)throw Error();
        const data=await r.json();if(!Array.isArray(data.items))throw Error();
        const next=new Map();
        for(const raw of data.items){
          const id='kosaf:'+raw.id;
          const facts=[['지원내역',raw.benefit],['지역',raw.region],['성적',raw.gpa],['소득',raw.income],['자격',raw.specific],['서류',raw.docs]].filter(([,v])=>useful(v));
          next.set(id,{id,kind:'kosaf',type:'장학금',source:'한국장학재단',title:raw.name,org:raw.org,start:raw.start,deadline:raw.end,
            snippet:useful(raw.benefit),eligibility:[raw.specific,raw.region,raw.gpa].filter(useful).join(' · '),aidType:useful(raw.aidType),
            body:facts.map(([k,v])=>k+' · '+v).join('\n'),cond:{},tags:[],docs:useful(raw.docs)?[raw.docs]:[],url:safeLink(raw.website),raw});
        }
        scholarships=next;loaded=Date.now();stale=!!data.warning;
      }catch{stale=true;}finally{request=null;}
    })();
    return request;
  }
  async function candidates(t,pool){
    const query=search().analyze(t);
    const foundation=/한국장학재단|재단\s*장학|장학재단/.test(t);
    if(!foundation&&!query.topic)return null;
    let rows=pool;
    if(foundation||['housing','living','tuition'].includes(query.topic?.id)){
      await readScholarships();
      rows=foundation?[...scholarships.values()]:[...pool.filter(n=>n.kind!=='startup'&&n.kind!=='event'),...scholarships.values()];
      if(foundation&&!/주거|월세|생활비|학비|등록금|면접|취업|전공|성적/.test(t))query.topic=null;
    }else if(query.topic.id==='startup'){
      await window.startupFeed?.refresh();
      rows=NOTICES.filter(n=>n.kind==='startup'&&dleft(n.deadline)>=0&&(!/강원|삼척|춘천/.test(t)||window.startupFeed?.inRegion(n.region)));
    }else if(query.topic.id==='culture'){
      const city=t.match(/춘천|삼척/)?.[0];rows=pool.filter(n=>n.kind==='event'&&(!city||n.region===city));
    }else{
      rows=pool.filter(n=>n.kind!=='event'&&n.kind!=='startup');
      if(/공모전|경진대회/.test(t))rows=rows.filter(n=>n.type==='공모전'||/대회|공모/.test(n.title));
    }
    const ranked=search().rank(query,rows);
    if(foundation&&!query.topic&&!ranked.length&&/^(?:한국)?장학재단|재단\s*장학/.test(t)&&/목록|모집\s*중/.test(t)){
      ranked.push(...rows.slice().sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,4));
    }
    return {rows:ranked,topic:query.topic?.id,foundation,stale:(foundation||['housing','living','tuition'].includes(query.topic?.id))&&stale};
  }
  function fact(n){
    if(n.kind==='exam')return window.examFeed.fact(n);
    if(n.source==='복지로')return [n.org,n.summary].filter(Boolean).join(' · ');
    if(n.kind==='benefit')return [n.org,'신청기한 · '+(n.due||'원문 확인 필요'),n.target?.slice(0,130)].filter(Boolean).join(' · ');
    if(n.kind==='training')return [n.org,n.address,n.format,n.start+' ~ '+n.end].filter(Boolean).join(' · ');
    const text=useful(n.eligibility)||useful(n.snippet)||useful(n.body);
    return [n.deadline?'마감 '+n.deadline:'마감일 원문 확인',text&&String(text).replace(/\s+/g,' ').slice(0,145)].filter(Boolean).join(' · ');
  }
  async function consult(question,context){
    if(!checkbox.checked)return null;
    try{
      const response=await fetch(feedOrigin+'/api/gom-chat',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({phase:'consult',question,context}),signal:AbortSignal.timeout(24000)});
      if(response.ok&&checkbox.checked)return (await response.json()).plan;
    }catch{}
    return null;
  }
  async function lookup(plan,pool,question=''){
    if(plan.source==='exams')return window.examFeed.lookup(question,plan.terms);
    let rows=pool;
    if(['benefits','welfare'].includes(plan.source)){
      await window.govBenefits.refresh();
      rows=window.govBenefits.items().filter(n=>(plan.source!=='welfare'||n.source==='복지로')&&(!plan.city||[plan.city,'강원','중앙부처'].includes(n.scope)));
      const normalized=question.replace(/\s+/g,'');
      const named=rows.filter(n=>normalized.includes(n.title.replace(/\s+/g,'')));
      if(named.length)return named.slice(0,5);
    }else if(plan.source==='training'){
      await window.work24Feed.refresh();
      rows=NOTICES.filter(n=>n.kind==='training'&&n.end>=window.work24Feed.today()&&(!plan.city||n.region===plan.city));
    }else if(plan.source==='startup'){
      await window.startupFeed.refresh();
      rows=NOTICES.filter(n=>n.kind==='startup'&&dleft(n.deadline)>=0&&(!plan.city||window.startupFeed.inRegion(n.region,plan.city)));
    }else if(plan.source==='scholarship'){
      await readScholarships();rows=[...rows.filter(n=>n.type==='장학금'),...scholarships.values()];
    }else if(plan.source==='event')rows=rows.filter(n=>n.kind==='event'&&(!plan.city||n.region===plan.city));
    else if(plan.source==='school')rows=rows.filter(n=>!['training','startup','event'].includes(n.kind));
    rows=rows.filter(n=>!plan.city||!Array.isArray(n.cond?.campus)||n.cond.campus.includes(plan.city));
    const words=plan.terms.map(t=>t.toLowerCase().replace(/\s+/g,'')).filter(Boolean);
    return rows.map(n=>{
      const title=(n.title||'').toLowerCase().replace(/\s+/g,'');
      const body=[n.org,n.type,n.snippet,n.body,n.region,n.aidType,...(n.tags||[])].join(' ').toLowerCase().replace(/\s+/g,'');
      const score=words.reduce((v,w)=>v+(title.includes(w)?4:body.includes(w)?1:0),0);
      return {n,score};
    }).filter(x=>!words.length||x.score).sort((a,b)=>b.score-a.score||(plan.source==='benefits'&&plan.city?Number(b.n.scope===plan.city)-Number(a.n.scope===plan.city):0)||Number(b.n.s==='ok')-Number(a.n.s==='ok')||
      (plan.source==='training'?String(b.n.start).localeCompare(String(a.n.start)):String(a.n.deadline||'9999').localeCompare(String(b.n.deadline||'9999')))).slice(0,5).map(x=>x.n);
  }
  async function explain(question,ids,parent,alive,previousAI=''){
    if(!checkbox.checked||!ids.length||!parent)return;
    const status=document.createElement('div');status.className='gom-provider';status.textContent='Gemini가 공고 원문을 확인하고 있어요…';parent.insertBefore(status,parent.querySelector('.gd-item'));
    try{
      const r=await fetch(feedOrigin+'/api/gom-chat',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({question,ids:ids.slice(0,5),context:{previousAI}}),signal:AbortSignal.timeout(26000)});
      const d=await r.json();
      if(!alive()||!checkbox.checked||!parent.isConnected){status.remove();return;}
      if(!r.ok||!d.answer||!d.citations?.length)throw Error(d.code||'unavailable');
      const localText=parent.querySelector('.gom-local-text');
      if(localText&&!parent.querySelector('.gd-acts'))localText.hidden=true;
      status.textContent='Gemini · 공고 원문 근거';
      const answer=document.createElement('div');answer.className='gom-ground';answer.textContent=d.answer;status.after(answer);
      const sources=document.createElement('details'),label=document.createElement('summary');
      label.textContent='답변 근거 '+d.citations.length+'건';sources.append(label);answer.after(sources);
      for(const c of d.citations){
        const entry=document.createElement('small');entry.className='gom-evidence';
        entry.textContent='「'+c.title+'」\n“'+c.quote+'”';sources.append(entry);
      }
    }catch(err){
      if(!alive()||!checkbox.checked){status.remove();return;}
      if(ids.length===1&&ids[0].startsWith('bokjiro-')){
        try{
          const r=await fetch(feedOrigin+'/api/welfare?id='+encodeURIComponent(ids[0].slice(8)),{signal:AbortSignal.timeout(10000)});
          if(r.ok){
            const {item}=await r.json();
            if(!alive()||!parent.isConnected||!checkbox.checked){status.remove();return;}
            const fields=[['지원 대상',item.target],['선정 기준',item.criteria],['신청 방법',item.method]].filter(([,v])=>v);
            if(fields.length){
              status.textContent='복지로 원문 · '+item.title;
              const answer=document.createElement('div');answer.className='gom-ground';
              answer.textContent=fields.map(([label,value])=>label+'\n'+value).join('\n\n');
              status.after(answer);return;
            }
          }
        }catch{}
      }
      status.textContent=err.message==='limit'||err.message==='provider_limit'?'Gemini 사용 한도에 도달해 공고 검색 결과를 표시했어요.':
        err.message==='no_evidence'?'원문 근거를 확인할 수 있는 검색 결과만 표시했어요.':'Gemini 연결이 지연되어 공고 검색 결과를 표시했어요.';
    }
  }
  window.gomAssist={candidates,find:id=>scholarships.get(String(id)),fact,explain,consult,lookup,enabled:()=>checkbox.checked};
  function openChat(){if(location.hash==='#gomduri')gdOpen();}
  addEventListener('hashchange',openChat);openChat();
})();

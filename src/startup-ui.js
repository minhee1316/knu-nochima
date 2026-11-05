(()=>{
  const status=document.getElementById('startup-status');
  const inRegion=(region,city)=>/전국|강원/.test(region||'') || (city?String(region||'').includes(city):/춘천|삼척/.test(region||''));
  let pending, nextRefresh=0, message='창업진흥원 공고를 불러오는 중…';
  const labels={category:'지원 분야',region:'지원지역',audience:'신청 대상',eligibility:'세부 자격',stage:'창업 업력',age:'대상 연령',
    exclusions:'제외 대상',preference:'우대 사항',description:'사업 내용',methods:'신청 방법',org:'공고 기관',department:'담당 부서',phone:'문의'};
  function asNotice(item){
    const body=Object.entries(labels).filter(([key])=>item[key]).map(([key,label])=>label+' · '+item[key]).join('\n');
    return {...item,kind:'startup',type:'창업지원',source:'창업진흥원 K-Startup',tags:['창업'],cond:{},
      body,snippet:(item.eligibility||item.description||'').slice(0,160),amount:0,docs:[],files:[]};
  }
  async function read(){
    status.textContent='창업진흥원 공고를 불러오는 중…';
    try{
      const r=await fetch(feedOrigin+'/api/startups',{cache:'no-store',signal:AbortSignal.timeout(45000)});
      const d=await r.json();
      if(!r.ok || !Array.isArray(d.items))throw Error(d.message||'창업진흥원 공고 연결이 지연되고 있어요.');
      const fresh=d.items.map(asNotice);
      const other=NOTICES.filter(n=>n.kind!=='startup');
      NOTICES.splice(0,NOTICES.length,...other,...fresh);
      const checked=new Date(d.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
      message='K-Startup 모집 중 공고 · '+checked+' 확인'+(d.warning?' · 마지막 정상 자료 표시':'');
      nextRefresh=Date.now()+(d.warning?60000:900000);
      status.textContent=message;
      render();
    }catch(err){
      nextRefresh=Date.now()+60000;
      const hasPrevious=NOTICES.some(n=>n.kind==='startup');
      message=(/공공데이터포털|창업진흥원|인증키|모집 중인 공고/.test(err.message)?err.message:'창업지원 공고를 불러오지 못했어요.')+
        (hasPrevious?' 이전 조회 결과를 표시합니다.':'');
      status.textContent=message+' ';
      const retry=document.createElement('button');retry.type='button';retry.className='chip';retry.textContent='다시 조회';
      retry.onclick=()=>refresh(true);status.append(retry);
    }
  }
  function refresh(force=false){
    if(pending)return pending;
    if(!force&&Date.now()<nextRefresh)return Promise.resolve();
    pending=read().finally(()=>{pending=null;});return pending;
  }
  function showDetails(n){
    const dl=document.createElement('dl');dl.className='kv';
    function field(label,value){
      const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;
      dd.textContent=value||'원문 확인 필요';dd.style.whiteSpace='pre-line';dd.style.overflowWrap='anywhere';dl.append(dt,dd);
    }
    field('출처',n.source);field('접수기간',(n.start||'시작일 확인 필요')+' ~ '+(n.deadline||'종료일 확인 필요'));
    for(const [key,label] of Object.entries(labels))if(n[key]||['region','eligibility'].includes(key))field(label,n[key]);
    const links=document.createElement('div');links.className='qa-chips';
    for(const [label,url] of [['기관 신청 페이지',n.applicationUrl],['사업 안내',n.guideUrl]]){
      if(!url||safeUrl(url)==='#'||url===n.url)continue;
      const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.className='btn line sm';a.textContent=label;links.append(a);
    }
    document.getElementById('dlg-view').replaceChildren(dl,links);
  }
  function openStartup(){
    view.onlyInt=false;openCatalogType('창업지원');refresh();
  }
  window.startupFeed={refresh,inRegion,showDetails,status:()=>message};
  document.getElementById('startup-region').addEventListener('change',()=>render());
  document.querySelectorAll('a[href="#startup"]').forEach(link=>link.addEventListener('click',openStartup));
  window.addEventListener('hashchange',()=>{if(location.hash==='#startup')openStartup();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden)refresh();},900000);
  if(location.hash==='#startup')openStartup();else refresh();
})();

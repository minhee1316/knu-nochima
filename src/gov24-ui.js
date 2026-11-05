(()=>{
  let source='';
  function dueDate(text){
    const date=String.raw`(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})`;
    const m=new RegExp('^(?:'+date+'\\.?\\s*[~〜–]\\s*)?'+date+'\\.?\\s*(?:까지)?$').exec(String(text||'').trim());
    if(!m)return '';
    const iso=m[4]+'-'+m[5].padStart(2,'0')+'-'+m[6].padStart(2,'0');
    const ms=Date.parse(iso+'T00:00:00Z');
    return Number.isFinite(ms)&&new Date(ms).toISOString().startsWith(iso)?iso:'';
  }
  function makeFeed(prefix,label,path){
    const status=document.getElementById(prefix+'-status');
    let records=new Map(),next=0,pending,retryTimer,syncPolls=0;
    async function read(){
      try{
        const r=await fetch(feedOrigin+path,{signal:AbortSignal.timeout(90000)}),d=await r.json();
        if(!r.ok||!Array.isArray(d.items))throw Object.assign(Error(d.message||label+' 목록을 불러오지 못했어요.'),{code:d.code});
        const entries=d.items.map(n=>{
          const item={...n,id:prefix+'-'+n.id,kind:'benefit',deadline:dueDate(n.due),type:'공공혜택',region:n.scope,source:label,cond:{},docs:[],
            tags:GOM.tagsFor(n.title+' '+n.field),snippet:n.summary||n.target,body:[n.field,n.org,n.scope,n.target,n.summary,n.format,n.life,n.household].filter(Boolean).join(' ')};
          return [item.id,item];
        });
        records=new Map(entries);syncPolls=0;
        const stamp=new Date(d.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
        status.textContent=label+' · '+records.size.toLocaleString('ko-KR')+'건 · '+stamp+' 확인'+(d.warning?' · '+d.warning:'');
        next=Date.now()+(d.warning?60000:900000);render();
      }catch(e){
        next=Date.now()+30000;
        status.textContent=label+' · 목록을 불러오지 못했어요.'+(records.size?' 이전 목록을 표시해요. ':' ');
        const retry=document.createElement('button');retry.type='button';retry.className='chip';retry.textContent='다시 조회';
        retry.onclick=()=>{syncPolls=0;refresh(true);};status.append(retry);
        if(e.code==='syncing'&&syncPolls++<10)retryTimer=setTimeout(()=>refresh(true),6500);
      }
    }
    function refresh(force=false){
      if(pending)return pending;
      if(!force&&Date.now()<next)return Promise.resolve();
      clearTimeout(retryTimer);pending=read().finally(()=>{pending=null;});return pending;
    }
    return {prefix,label,path,status,refresh,records:()=>records};
  }
  const gov=makeFeed('gov24','정부24','/api/benefits'),welfare=makeFeed('bokjiro','복지로','/api/welfare');
  const feeds=[gov,welfare];
  const refresh=()=>Promise.all(feeds.map(f=>f.refresh()));
  const items=()=>feeds.flatMap(f=>[...f.records().values()].filter(n=>dleft(n.deadline)>=0));
  function updateFilters(){
    for(const f of feeds)f.status.hidden=!!source&&source!==f.label;
    render();
  }
  async function showDetails(n){
    const feed=feeds.find(f=>f.records().has(n.id));
    const view=document.getElementById('dlg-view');view.textContent='신청 조건을 불러오는 중…';
    try{
      const id=n.id.slice(feed.prefix.length+1);
      const r=await fetch(feedOrigin+feed.path+'?id='+encodeURIComponent(id),{signal:AbortSignal.timeout(24000)}),d=await r.json();
      if(!r.ok||!d.item)throw Error();
      if(!view.isConnected)return;
      const doc=d.item,dl=document.createElement('dl');dl.className='kv';
      const fields=[['제공기관','org'],['지원 대상','target'],['선정 기준','criteria'],['지원 내용','benefit'],['신청 방법','method']];
      if(feed===welfare)fields.push(['지원 주기','cycle'],['지원 유형','format'],['사업 기준 연도','year']);
      else fields.push(['신청기한','due'],['구비서류','documents'],['본인 확인 필요 서류','required'],['접수기관','office'],['원문 수정일','modified']);
      fields.push(['문의처','contact']);
      for(const [label,key] of fields){
        const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=doc[key]||'원문 확인 필요';dd.style.whiteSpace='pre-line';dl.append(dt,dd);
      }
      const attribution=document.createElement('p');attribution.className='hint';
      attribution.textContent='출처 · '+(feed===welfare?'한국사회보장정보원 복지로':'행정안전부 정부24');
      view.replaceChildren(dl,attribution);if(doc.warning)view.prepend(document.createTextNode(doc.warning));
    }catch{
      if(view.isConnected)view.textContent='상세 정보 연결이 지연되고 있어요. '+n.source+' 원문에서 신청 조건을 확인하세요.';
    }
  }
  function open(hash){
    view.onlyInt=false;source=hash==='#welfare'?'복지로':'';openCatalogType('공공혜택');updateFilters();refresh();
  }
  window.govBenefits={refresh,items,find:id=>gov.records().get(id)||welfare.records().get(id),showDetails,status:()=>feeds.map(f=>f.status.textContent).join(' · ')};
  window.govBenefits.visible=n=>!source||n.source===source;
  window.govBenefits.resetSource=()=>{source='';for(const f of feeds)f.status.hidden=false;};
  document.querySelectorAll('a[href="#benefits"],a[href="#welfare"]').forEach(a=>a.onclick=()=>open(a.hash));
  addEventListener('hashchange',()=>{if(['#benefits','#welfare'].includes(location.hash))open(location.hash);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden)refresh();},900000);
  if(['#benefits','#welfare'].includes(location.hash))open(location.hash);else refresh();
})();

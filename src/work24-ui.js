(()=>{
  const status=document.getElementById('work24-status');
  const region=document.getElementById('work24-region');
  const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  let pending,next=0;
  function regionFits(n,area){
    return area==='all'||(area==='local'?['춘천','삼척'].includes(n.region):n.region===area);
  }
  async function read(){
    try{
      const response=await fetch(feedOrigin+'/api/work24',{signal:AbortSignal.timeout(45000)});
      const data=await response.json();
      if(!response.ok||!Array.isArray(data.items))throw Error();
      const fresh=data.items.filter(n=>n.end>=today()).map(n=>({...n,kind:'training',type:'일학습병행',source:'고용24',tags:['취업·진로'],cond:{},docs:[],amount:0,
        snippet:[n.org,n.address,n.format,n.start+' ~ '+n.end].filter(Boolean).join(' · '),body:[n.title,n.org,n.address,n.format,n.description].filter(Boolean).join(' ')}));
      NOTICES.splice(0,NOTICES.length,...NOTICES.filter(n=>n.kind!=='training'),...fresh);
      status.textContent=(data.warning?'마지막 정상 자료 · ':'고용24 · ')+data.from+' ~ '+data.until+' 개강 과정 중 훈련 중·개강 예정 과정. 모집 여부는 기관에서 확인하세요.';
      next=Date.now()+(data.warning?60000:900000);render();
    }catch{
      next=Date.now()+30000;status.textContent='고용24 조회가 지연되고 있어요. ';
      const button=document.createElement('button');button.type='button';button.className='chip';button.textContent='다시 조회';
      button.onclick=()=>refresh(true);status.append(button);
    }
  }
  function refresh(force=false){
    if(pending)return pending;
    if(!force&&Date.now()<next)return Promise.resolve();
    pending=read().finally(()=>{pending=null;});return pending;
  }
  function showDetails(n){
    const dl=document.createElement('dl');dl.className='kv';
    for(const [label,value] of [['훈련기관',n.org],['훈련지역',n.address],['훈련유형',n.format],['훈련기간',n.start+' ~ '+n.end],['모집 여부','고용24 원문 또는 훈련기관에 확인'],['문의',n.phone],['과정 소개',n.description]]){
      if(!value)continue;
      const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);
    }
    document.getElementById('dlg-view').replaceChildren(dl);
  }
  function open(){view.onlyInt=false;openCatalogType('일학습병행');refresh();}
  window.work24Feed={refresh,regionFits,showDetails,today,status:()=>status.textContent};
  region.onchange=()=>render();
  document.querySelectorAll('a[href="#training"]').forEach(link=>link.addEventListener('click',open));
  addEventListener('hashchange',()=>{if(location.hash==='#training')open();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden)refresh();},900000);
  if(location.hash==='#training')open();else refresh();
})();

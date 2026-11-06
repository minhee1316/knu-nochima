(()=>{
  const panel=document.querySelector('#scholarships');
  const form=document.querySelector('#kosaf-form');
  const state=document.querySelector('#kosaf-state'),info=document.querySelector('#kosaf-info');
  const rows=document.querySelector('#kosaf-rows'),pager=document.querySelector('#kosaf-pages');
  const dialog=document.querySelector('#kosaf-dialog'),detail=document.querySelector('#kosaf-detail');
  const origin=location.protocol==='file:'?'https://knu-esungan-preview-20261105.hydroai4.chatgpt.site':location.origin;
  const formKeys=['q','school','grade','major','status'];
  let listRequest,detailRequest,page=1,loaded=false,syncPolls=0,retryTimer;
  function node(tag,text,cls){
    const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;
  }
  function button(text,action,cls){
    const b=node('button',text,cls);b.type='button';b.addEventListener('click',action);return b;
  }
  async function get(params,signal){
    const url=new URL('/api/scholarships',origin);url.search=params.toString();
    const r=await fetch(url,{signal,cache:'no-store'});const data=await r.json();
    if(!r.ok){const error=new Error(data.message||'장학금 서버에 연결할 수 없어요.');error.code=data.code;throw error;}
    return data;
  }
  const syncText=d=>'자료 기준일 '+(d.sourceDate||'정보 없음')+' · 마지막 동기화 '+new Date(d.syncedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' (한국 시간)';
  function homeLink(raw){
    const value=String(raw).trim();
    try{
      const candidate=/^https?:\/\//i.test(value)?value:/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:?#]|$)/i.test(value)?'https://'+value:null;
      if(!candidate)return null;const url=new URL(candidate);return url.username||url.password?null:url.href;
    }catch{return null;}
  }
  async function openDetail(id){
    detailRequest?.abort();const active=detailRequest=new AbortController();
    document.querySelector('#kosaf-title').textContent='장학금 상세';detail.textContent='상세 정보를 불러오는 중…';
    if(!dialog.open)dialog.showModal();
    try{
      const d=await get(new URLSearchParams({id}),active.signal);if(active!==detailRequest)return;
      const r=d.item;document.querySelector('#kosaf-title').textContent=r.name;
      const fields=node('dl',null,'kosaf-fields');
      const labels={org:'운영기관',orgType:'기관 구분',product:'상품구분',aidType:'학자금 유형',benefit:'지원내역',school:'대학구분',grade:'학년구분',
        major:'학과구분',gpa:'성적기준',income:'소득기준',specific:'특정 자격',region:'지역·거주 조건',limits:'자격 제한',selection:'선발 방법',people:'선발 인원',referral:'추천 필요 여부',docs:'제출서류',start:'모집시작일',end:'모집종료일',website:'운영기관 홈페이지'};
      for(const [key,label] of Object.entries(labels)){
        const dd=node('dd',r[key]);const url=key==='website'&&homeLink(r[key]);
        if(url){const a=node('a',r[key]);a.href=url;a.target='_blank';a.rel='noopener noreferrer';dd.replaceChildren(a);}
        fields.append(node('dt',label),dd);
      }
      detail.replaceChildren(node('p',r.status+' · 모집기간의 날짜 비교 결과','kosaf-info'),fields,
        node('p',syncText(d),'kosaf-info'),node('p','출처 · 한국장학재단. 신청 전 운영기관의 최신 공고를 확인하세요.','kosaf-source'));
      const listed=window.gomAssist?.find('kosaf:'+id);
      if(listed){const basis=reviewBlock(listed,judge(listed,listProfile()));if(basis)detail.insertAdjacentHTML('afterbegin',basis);}
      if(d.warning)detail.prepend(node('p','마지막 정상 자료를 표시합니다. '+d.warning,'kosaf-state'));
    }catch(err){if(!active.signal.aborted)detail.textContent=err.code?err.message:'장학금 상세 정보를 불러오지 못했어요. 잠시 뒤 다시 조회해 주세요.';}
  }
  async function search(next=1){
    clearTimeout(retryTimer);listRequest?.abort();const active=listRequest=new AbortController();
    const params=new URLSearchParams({page:String(next),activeOnly:'1'});
    for(const k of formKeys){const value=form.elements.namedItem(k).value.trim();if(value)params.set(k,value);}
    state.textContent='장학금 자료를 불러오는 중…';rows.replaceChildren();pager.replaceChildren();info.textContent='';loaded=false;
    try{
      const d=await get(params,active.signal);if(active!==listRequest)return;
      loaded=true;syncPolls=0;page=d.page;info.textContent=syncText(d);
      state.textContent=d.total?'검색결과 '+d.total.toLocaleString('ko-KR')+'건':d.sourceCount===0?'공식 API가 빈 자료를 반환했어요.':!d.scholarshipCount?'이 자료에는 상품구분이 장학금인 항목이 없어요.':'검색 조건에 맞는 장학금이 없어요.';
      if(d.warning)state.prepend(node('p','마지막 정상 자료를 표시합니다. '+d.warning));
      for(const k of ['school','grade','major']){
        document.querySelector('#kosaf-'+k).replaceChildren(...d.options[k].map(v=>{const o=node('option');o.value=v;return o;}));
      }
      for(const r of d.items){
        const el=button('',()=>openDetail(r.id),'kosaf-row');
        el.append(node('span',r.status,'kosaf-state-label'),node('b',r.name),node('small',r.org),node('small',r.start+' ~ '+r.end));rows.append(el);
      }
      if(d.pages>1){
        const back=button('이전',()=>search(page-1)),forward=button('다음',()=>search(page+1));
        back.disabled=page===1;forward.disabled=page===d.pages;
        pager.append(back,node('span',page+' / '+d.pages),forward);
      }
    }catch(err){
      if(active.signal.aborted)return;
      state.textContent=err.code?err.message:'장학금 서버에 연결할 수 없어요. 잠시 뒤 다시 조회해 주세요.';
      state.append(button('다시 조회',()=>{syncPolls=0;search(next);}));
      if(err.code==='syncing'&&panel.open&&syncPolls++<8)retryTimer=setTimeout(()=>search(next),4000);
    }
  }
  window.addEventListener('catalog-day-change',()=>{loaded=false;if(panel.open)search(1);});
  function openPanel(){
    if(panel.open)return;
    panel.showModal();
    form.elements.namedItem('q').focus({preventScroll:true});
    if(!loaded)search(1);
  }
  window.gomScholarshipDetail=openDetail;
  document.querySelector('#kosaf-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{detailRequest?.abort();});
  document.querySelector('#kosaf-list-close').onclick=()=>panel.close();
  panel.addEventListener('close',()=>{
    clearTimeout(retryTimer);listRequest?.abort();
    if(location.hash==='#scholarships')history.replaceState(history.state,'',location.pathname+location.search+'#results');
  });
  form.onsubmit=e=>{e.preventDefault();search(1);};
  form.elements.namedItem('status').onchange=()=>search(1);
  for(const k of ['school','grade','major'])form.elements.namedItem(k).addEventListener('change',()=>search(1));
  window.addEventListener('hashchange',()=>{
    if(location.hash==='#scholarships')openPanel();
    else if(panel.open){if(dialog.open)dialog.close();panel.close();}
  });
  if(location.hash==='#scholarships')openPanel();
  document.querySelectorAll('a[href="#scholarships"]').forEach(a=>a.addEventListener('click',openPanel));
})();

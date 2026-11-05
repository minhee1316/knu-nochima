(function workbench(){
  const root=$('#workbench');
  const appOrigin='https://knu-esungan-preview-20261105.hydroai4.chatgpt.site';
  const isFile=location.protocol==='file:';
  const presets=[
    ['삼척 2학년 · 공학','삼척 2학년 공학계열 재학생, 파이썬 A+, 데이터 분석 B+. 직전 평점 3.3, 누적 평점 3.4, 직전 이수학점 18, 3구간. AI 프로젝트에 관심이 있어요.'],
    ['춘천 3학년 · 연구','춘천 3학년 자연과학 재학생, 생명과학 A, 통계학 A+. 직전 평점 3.8, 누적 평점 3.9, 직전 이수학점 17, 4구간. 학부 연구와 학술대회를 희망해요.'],
    ['삼척 1학년 · 자취','삼척 1학년 자취하는 학부 재학생, 직전 평점 2.9, 직전 이수학점 15, 2구간. 주거비와 생활비 장학금을 찾고 있어요.'],
    ['춘천 4학년 · 취업','춘천 4학년 공학계열 재학생, 경영전략 B+, 데이터 분석 A. 직전 평점 3.6, 직전 이수학점 16. 취업 프로그램과 직무 실습을 희망해요.']
  ];
  let context=null,city='삼척',pane='counsel',delta=0,readOnce=false;
  function score(p){return NOTICES.map(n=>({...n,...judge(n,p),left:dleft(n.deadline)}));}
  function briefList(rows,empty='조건에 맞는 항목이 없어요.'){
    return rows.length?`<ul class="wb-list">${rows.map(({id,title,sub})=>`<li><div><b>${esc(title)}</b><p>${esc(sub||'')}</p></div><button type="button" class="chip" data-detail="${esc(id)}">자세히 보기 →</button></li>`).join('')}</ul>`:`<p>${esc(empty)}</p>`;
  }
  function studentFrom(text){
    const signals=GOM.extractProfile(text);
    const p={...EMPTY,...GOM.cleanPatch(signals.patch),interests:[...signals.tags]};
    const g=text.match(/(?:직전(?:\s*학기)?\s*(?:평균\s*)?평점|(?:^|[,\s])평점)\s*[:은이]?\s*([0-4](?:\.\d{1,2})?)(?![\d.])/);
    p.gpa=g&&+g[1]<=4.5?g[1]:'';
    const num=(field,regex,max)=>{const m=text.match(regex);if(m && +m[1]<=max)p[field]=m[1];};
    num('cumulativeGpa',/(?:누적|전체)\s*(?:평균)?\s*평점\s*[:은이]?\s*([0-4](?:\.\d{1,2})?)/,4.5);
    num('lastCredits',/직전(?:\s*학기)?\s*(?:이수|취득)?\s*학점\s*[:은이]?\s*(\d{1,2})/,40);
    num('earnedCredits',/(?:총|전체)\s*(?:이수|취득)?\s*학점\s*[:은이]?\s*(\d{1,3})/,400);
    num('currentSemester',/([12])\s*학기(?:\s*재학|에|째|[,\s]|$)/,2);
    if(/휴학/.test(text))p.academic='휴학';else if(/재학/.test(text))p.academic='재학';
    if(/학부/.test(text))p.program='학부';else if(/대학원/.test(text))p.program='대학원';
    const courseMatches=Array.from(text.matchAll(/([가-힣A-Za-z][가-힣A-Za-z0-9·]*(?:\s(?:분석|입문|실습|기초|설계))?)\s+([ABCDF][+-]?)(?=[\s,.;]|$)/g),m=>[m[1],m[2]]);
    const explicit=text.match(/(?:수강(?:과목)?|과목)\s*[:：]\s*([^.;\n]{1,120})/);
    const names=[...new Set([...courseMatches.map(([name])=>name),...(['파이썬','Python','통계학','생명과학','자료구조','데이터 분석','경영전략'].filter(name=>text.toLowerCase().includes(name.toLowerCase())))])];
    p.courses=courseMatches.map(x=>x.join(' ')).join(', ')||explicit?.[1]||names.join(', ');
    const fields=[['공학·IT',/공학(?:과|계열|부)|공대|IT계열/],['자연과학',/자연과학|자연대/],['인문·사회',/인문|사회계열|경영학과/],['보건·의료',/보건|의료계열|간호학과/],['예술·체육',/예술|체육계열|미술학과/]];
    p.college=fields.find(([,pattern])=>pattern.test(text))?.[0]||'';
    if(names.some(x=>/파이썬|python|자료구조|데이터/i.test(x))&&!p.interests.includes('AI·SW'))p.interests.push('AI·SW');
    signals.tags=p.interests;signals.keywords=[...new Set([...names,...signals.keywords])];
    for(const k of ['gpa','income','grade'])if(p[k]!=null)p[k]=String(p[k]);
    return {p,signals};
  }
  function counsel(){
    const memo=$('#wb-memo').value.trim();if(!memo){context=null;$('#wb-cres').textContent='학생 정보를 한 줄 입력해 주세요.';return;}
    const {p,signals}=studentFrom(memo);
    const judged=score(p),pool=GOM.recommend(judged,signals,Math.min(40,judged.length));
    // Weight exact course vocabulary by its rarity across the current collection.
    // A course grade describes the student; it is a formal minimum only if the notice says so.
    const terms=[...new Set(signals.keywords.filter(k=>k.length>1))];
    const texts=new Map(judged.map(n=>[String(n.id),(n.title+' '+(n.summary||'')+' '+(n.body||'')).toLowerCase()]));
    const idf=new Map(terms.map(t=>[t,Math.log((texts.size+1)/(1+[...texts.values()].filter(v=>v.includes(t.toLowerCase())).length))]));
    const items=pool.map((x,rank)=>{
      const body=texts.get(String(x.id))||'';
      const hits=terms.filter(t=>body.includes(t.toLowerCase())).sort((a,b)=>idf.get(b)-idf.get(a));
      const affinity=hits.slice(0,3).reduce((n,t)=>n+idf.get(t),0);
      const why=hits.length?['공지 원문에 ‘'+hits[0]+'’ 관련 내용이 있어요.',...x.why]:x.why;
      return {...x,why,order:rank-affinity*1.8};
    }).sort((a,b)=>a.order-b.order).slice(0,4);
    context={p,items,memo};
    const badges=[p.campus,p.grade&&p.grade+'학년',p.college,p.academic,p.gpa&&'직전 '+p.gpa,p.cumulativeGpa&&'누적 '+p.cumulativeGpa,p.courses,p.lastCredits&&'직전 '+p.lastCredits+'학점',p.residence,p.income!==''&&p.income!=null&&p.income+'구간',...p.interests].filter(Boolean);
    $('#wb-cres').innerHTML=`<div class="wb-badges">${badges.map(x=>`<span>${esc(x)}</span>`).join('')}</div><button type="button" id="wb-apply" class="btn white sm">⚡ 이 학생 조건을 왼쪽 [내 조건]에 적용</button>${briefList(items.map(x=>({...x,sub:[x.verdict,...x.why.filter(y=>y!=='지원 가능 판정').slice(0,2)].join(' · ')})))}`;
    $('#wb-apply').onclick=()=>{profile={...EMPTY,...p,interests:[...p.interests]};save();syncForm();syncInterests();setAud('all');toast('학생 조건으로 공지 목록을 다시 판정했어요.');};
  }
  function showPane(v){
    pane=v;root.querySelectorAll('[data-pane]').forEach(s=>s.hidden=s.dataset.pane!==v);
    root.querySelectorAll('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.panel===v));
    if(v==='local')localEvents();if(v==='benefits')combo();
  }
  $('#wb-presets').innerHTML=presets.map(([label],i)=>`<button type="button" class="chip" data-preset="${i}">${esc(label)}</button>`).join('');
  $('#wb-form').onsubmit=e=>{e.preventDefault();counsel();};
  $('#to-counsel').onclick=()=>{showPane('counsel');root.scrollIntoView({behavior:'smooth'});$('#wb-memo').focus({preventScroll:true});};
  function localEvents(){
    const items=NOTICES.filter(n=>n.kind==='event'&&n.region===city&&dleft(n.deadline)>=0).sort((a,b)=>a.start.localeCompare(b.start));
    $('#wb-cities').querySelectorAll('[data-city]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.city===city));
    $('#wb-events').innerHTML=briefList(items.slice(0,4).map(n=>({...n,sub:`${n.start||'일정 확인'} ~ ${n.deadline||'종료일 확인'} · ${n.source}`})),`${city}에 예정된 행사를 찾지 못했어요.`)+`<button class="chip" type="button" data-allcity="${city}">${city} 행사 전체 ${items.length}건 보기</button>`;
  }
  function goAudience(v){view.type='전체';view.status='all';view.onlyInt=false;view.past=false;view.q='';$('#show-past').checked=$('#only-int').checked=false;$('#ask-q').value='';for(const [selector,value] of [['#type-tabs','전체'],['#status-tabs','all']])$(selector).querySelectorAll('[data-v]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===value));setAud(v);$('#results').scrollIntoView({behavior:'smooth'});}
  $('#wb-public').onclick=()=>goAudience('public');
  // Individually checked, per-person grants. Categories use the kind of benefit, not the identity of the funder.
  const offers={
    '721-2523':[0,'거창 출신·학교 및 학년 요건 확인',false],
    '721-2524':[1,'경제 곤란 사유·면담·심사',false],
    '721-2528':[1,'기부처별 신청자격·푸른등대 중복 제한 확인',true],
    '721-2534':[1,'창업 아이디어 제출·국가장학금과 병행 가능',false],
    '721-2541':[1,'춘천 봉사 등 유형별 실적·선발',false],
    '504-11588':[2,'특성화 분야 재학생·계획서 심사·1인 최대 지원액',false],
    '504-11591':[2,'수료 조건·현금 대신 상품권',false]
  };
  function combo(){
    const stack=$('#wb-stack').checked;const tuition=$('#wb-tuition').value;const hasTuition=tuition.trim()!==''&&Number(tuition)>=0&&Number(tuition)<=30000000;
    const groups=[[],[],[]],labels=['등록금 지원','생활비·주거 장학금','비교과 활동비·상품권'];
    for(const n of NOTICES){const o=offers[n.id];if(!o||!n.amount||!n.deadline||dleft(n.deadline)<0||judge(n,profile).s==='no')continue;
      groups[o[0]].push({n,reason:o[1],sum:o[0]===0?(hasTuition?Math.min(n.amount,Number(tuition)):0):n.amount,stack:o[2]});}
    for(const g of groups)g.sort((a,b)=>b.sum-a.sum);
    const possible=groups.map(g=>g[0]?.sum||0);
    const compatibleLiving=groups[1].filter(x=>x.stack)[0];
    const confirmedPair=possible[0]+(compatibleLiving?.sum||0);
    const combined=stack?possible.reduce((a,b)=>a+b,0):Math.max(confirmedPair,...possible,0);
    $('#wb-combo').innerHTML=`<div class="wb-grid">${groups.map((g,i)=>`<article><h3>${labels[i]}</h3><strong>${g.length?(i===0&&!hasTuition?'잔액 입력':won(g[0].sum)||'0원'):'후보 없음'}</strong>${g.length?`<p>${esc(g[0].n.title)}<br>${esc(g[0].reason)}</p><button class="chip" type="button" data-detail="${esc(g[0].n.id)}">근거 보기</button>`:''}</article>`).join('')}</div><div class="wb-note"><b>${stack?'항목별 1건을 함께 받을 때의 상한':'공고에 병행 근거가 있는 조합의 상한'}</b><div class="wb-total">${won(combined)||'0원'}</div><p>등록금 지원과 타 장학금 병행이 명시된 생활비 장학금을 비교합니다. 푸른등대 내 중복 제한 등은 별도 확인해야 합니다. 선발·증빙 및 개별 지급 조건을 충족한다고 가정합니다. 등록금은 남은 본인 부담액까지 계산합니다.</p></div>`;
    if(!stack && compatibleLiving && confirmedPair>=Math.max(...possible) && possible[0]>0) $('#wb-combo .wb-note').insertAdjacentHTML('beforeend','<p>산정 조합 · '+esc(groups[0][0].n.title)+' + '+esc(compatibleLiving.n.title)+'</p>');
    whatIf();
  }
  function whatIf(){
    const el=$('#wb-wres');if(!delta){el.textContent='왼쪽 내 조건을 기준으로 평점 기준을 새로 충족하는 장학금을 찾습니다.';return;}
    const key=$('#wb-gpa-kind').value,base=profile[key];if(base==null||base===''){el.textContent=`내 조건에 ${key==='gpa'?'직전':'누적'} 평점을 입력해 주세요.`;return;}
    const after=Math.min(4.5,Math.round((Number(base)+delta)*100)/100),p={...profile,[key]:String(after)};
    const gained=NOTICES.filter(n=>n.type==='장학금'&&dleft(n.deadline)>=0&&judge(n,profile).s==='no'&&judge(n,p).s!=='no');
    el.innerHTML=`<p><b>${Number(base).toFixed(2)} → ${after.toFixed(2)}</b> · 새로 검토할 수 있는 장학금 ${gained.length}건</p>${gained.length?briefList(gained.map(n=>({...n,sub:judge(n,p).s==='ok'?'입력 조건 충족':'기타 조건 확인 필요'}))):'<p>현재 공고에서 이 변화로 추가되는 장학금은 없어요.</p>'}`;
    el.querySelectorAll('[data-detail]').forEach(b=>b.onclick=e=>{e.stopPropagation();detail(gdFind(b.dataset.detail),p,['가정한 평점 '+after.toFixed(2)+' 기준']);});
  }
  $('#wb-what').insertAdjacentHTML('afterbegin','<select class="select-box" id="wb-gpa-kind" aria-label="바꿀 평점"><option value="gpa">직전 평점</option><option value="cumulativeGpa">누적 평점</option></select>');
  $('#wb-gpa-kind').onchange=whatIf;$('#wb-stack').onchange=combo;$('#wb-tuition').oninput=combo;
  function batchRead(){
    readOnce=true;const all=NOTICES.filter(n=>n.aiPending||n.imageOnly||window.DOC_SCAN[n.id]);
    const found=all.filter(n=>window.DOC_SCAN[n.id]?.length);
    found.forEach(n=>n.scan=window.DOC_SCAN[n.id]);
    $('#wb-ores').innerHTML=`<p>공고 ${all.length}건 중 문서·포스터에서 읽은 자료 ${found.length}건 · 원문 확인 ${all.length-found.length}건</p><details><summary>공고별 판독 결과</summary>${briefList(all.map(n=>({...n,sub:n.scan?.[0]?.lines[0]||'지원 형식 또는 판독 가능한 자료를 확보하지 못했습니다.'})))}</details>`;
    render();
  }
  $('#wb-read').onclick=batchRead;
  function detail(n,p=profile,why=[]){
    if(!n)return;
    const dlg=$('#dlg');const j=judge(n,p),reason=(why.length?why:j.reasons.map(x=>x[1])).slice(0,4);
    $('#dlg-body').innerHTML=`<div class="wb-detail"><div class="wb-note"><b>AI 상담관 코멘트</b><p>${esc(reason.join(' · ')||'공개된 공지입니다. 원문에서 신청 대상과 절차를 확인하세요.')}</p></div><nav class="wb-tabs" aria-label="상세 정보"><button data-dtab="result" aria-pressed="true">판정 결과 · 추천 설명</button><button data-dtab="draft" aria-pressed="false">지원서 초안 · 서류 발급</button></nav><section data-dpane="result"><div id="dlg-view" class="dlg-view"></div><div id="wb-evidence"></div><div class="wb-block"><h3>이 공고에 질문하기</h3><div class="wb-row">${['중복 수혜','초과학기','최저학점'].map(t=>`<button data-qa="${t}" class="chip">${t}</button>`).join('')}</div><p id="wb-answer" aria-live="polite"></p></div></section><section data-dpane="draft" hidden><label for="wb-experience">추가할 경험·목표</label><textarea id="wb-experience" maxlength="350" placeholder="수업에서 했던 활동이나 관심 분야"></textarea><button id="wb-generate" class="btn blue sm">맞춤 지원동기 생성</button><label for="wb-letter">수정 가능한 초안</label><textarea id="wb-letter"></textarea><div class="wb-row"><a href="https://kcloud.kangwon.ac.kr/" target="_blank" rel="noopener">K-Cloud ↗</a><a href="https://www.kosaf.go.kr/" target="_blank" rel="noopener">한국장학재단 ↗</a><a href="https://www.gov.kr/" target="_blank" rel="noopener">정부24 ↗</a></div><p>${esc(n.docs?.length?'공고상 서류 · '+n.docs.join(', '):'제출할 서류는 공고 원문을 확인하세요.')}</p></section><div class="wb-block"><a class="btn blue sm" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">공식 원문 보기 ↗</a></div></div>`;
    renderView(n,p);
    if(n.scan)$('#wb-evidence').innerHTML='<h3>첨부 판독 근거</h3>'+n.scan.map(d=>`<div class="wb-proof"><a href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener">${esc(d.name)}</a> · ${esc(d.method)}<p>${esc(d.lines.join(' / '))}</p></div>`).join('');
    const questionTerms={'중복 수혜':/중복|이중\s*수혜|타\s*장학금|동일\s*유형/,'초과학기':/초과\s*학기|학기\s*초과|수업\s*연한\s*초과/,'최저학점':/평점|이수\s*학점|학점\s*이상|백분위/};
    function generate(){
      const exp=$('#wb-experience').value.trim();const courses=p.courses?`${p.courses} 수강 경험을 바탕으로 `:'';
      const theme=p.interests?.length?p.interests.slice(0,2).join('·'):'[관심 분야]';
      const intro=[p.campus&&p.campus+'캠퍼스',p.grade&&p.grade+'학년',p.college].filter(Boolean).join(' ');
      $('#wb-letter').value=`${intro?intro+' 학생으로서 ':''}「${n.title}」에 지원합니다. ${courses}${theme} 분야에서 [구체적인 목표]를 이루고 싶습니다.${exp?'\n\n'+exp:''}\n\n기회를 얻게 된다면 [실행할 활동]을 진행하고 [확인할 결과]를 남기겠습니다.`;
    }
    generate();$('#wb-generate').onclick=generate;
    $('#dlg-body').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.dtab){$('#dlg-body').querySelectorAll('[data-dpane]').forEach(x=>x.hidden=x.dataset.dpane!==b.dataset.dtab);$('#dlg-body').querySelectorAll('[data-dtab]').forEach(x=>x.setAttribute('aria-pressed',x===b));}
      if(b.dataset.qa){const lines=[...(n.body||'').split(/\n/),...(n.scan||[]).flatMap(d=>d.lines)].filter(x=>questionTerms[b.dataset.qa].test(x)).slice(0,3);$('#wb-answer').textContent=lines.length?lines.join(' / '):'읽을 수 있는 원문에서 이 조건을 확인하지 못했습니다. 첨부와 담당 부서에 확인하세요.';}};
    if(!dlg.open)dlg.showModal();
  }
  openDetail=(n)=>detail(n);
  root.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.panel)showPane(b.dataset.panel);
    if(b.dataset.preset!=null){$('#wb-memo').value=presets[+b.dataset.preset][1];counsel();}
    if(b.dataset.city){city=b.dataset.city;localEvents();}
    if(b.dataset.allcity)goAudience(b.dataset.allcity);
    if(b.dataset.delta){delta=Number(b.dataset.delta);$('#wb-what').querySelectorAll('[data-delta]').forEach(x=>x.setAttribute('aria-pressed',x===b));whatIf();}
    if(b.dataset.detail){const rec=b.closest('#wb-cres')&&context?.items.find(x=>String(x.id)===b.dataset.detail);detail(gdFind(b.dataset.detail),rec?context.p:profile,rec?.why||[]);}
  };
  const baseRender=render;render=function(){baseRender();if(pane==='benefits')combo();if(pane==='local')localEvents();};
  // Read-only feeds are also accessible when the standalone HTML has been opened from a disk.
  const authHome=isFile?appOrigin:'';
  function mergeFeeds(notices,events,applyEvents){
    const map=new Map(NOTICES.map(n=>[String(n.id),n]));
    for(const r of notices){const m=String(r.url).match(/bbs\/(\d+)\/detail\.do\?pstSn=(\d+)/);const id=m?m[1]+'-'+m[2]:String(r.id);if(map.has(id))continue;
      const type=({'장학공지':'장학금','공모안내':'공모전','행사안내':'비교과'})[r.board]||'공지';const campus=(r.campuses||[]).filter(c=>CAMPUS.includes(c));
      map.set(id,{id,title:r.title,type,source:r.board,org:'강원대학교',posted:r.postedAt,url:r.url,body:r.body||'',snippet:r.body?.slice(0,140)||'',cond:{campus:campus.length?campus:null},aiPending:true,docs:[],files:r.files||[],tags:[],amount:0});}
    if(applyEvents){for(const [k,n] of map)if(n.kind==='event')map.delete(k);}
    for(const r of events){const id=String(r.id);map.set(id,{id,kind:'event',region:r.region,title:r.title,start:r.startAt,deadline:r.endAt,type:'지역행사',source:r.source,org:r.source,url:r.url,cond:{},body:r.body||'',snippet:r.body?.slice(0,180)||'',amount:0,tags:[],docs:[],files:[]});}
    NOTICES.splice(0,NOTICES.length,...map.values());
  }
  let busy=false;
  async function refresh(){
    if(busy)return;busy=true;
    try{
      const get=async slug=>{const r=await fetch(authHome+'/api/'+slug,{signal:AbortSignal.timeout(30000),cache:'no-store'});if(!r.ok)throw Error('feed');const j=await r.json();if(!Array.isArray(j.items))throw Error('items');return j;};
      const [a,b]=await Promise.allSettled([get('notices'),get('events')]);
      const school=a.value,regional=b.value;mergeFeeds(school?.items||[],regional?.items||[],!!regional&&regional.mode==='live');
      const stamp=x=>x?.updatedAt?new Date(x.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'저장본';
      $('#data-src').textContent=`학교 공지 ${stamp(school)} · 지역행사 ${stamp(regional)} · 열려 있는 동안 15분마다 갱신`;
      $('#sample-note').textContent=`수집 출처 · 강원대학교 공개 게시판${regional?.sources?.length?' · '+regional.sources.join(' · '):' · 저장된 지역행사'}`;
      if(readOnce)batchRead();else render();if(context)counsel();
    }finally{busy=false;}
  }
  $('#share').onclick=async()=>{try{await navigator.clipboard.writeText(appOrigin+'/');toast('공개 주소를 복사했어요.');}catch{toast(appOrigin+'/');}};
  refresh();setInterval(()=>{if(!document.hidden)refresh();},900000);
})();

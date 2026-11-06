(()=>{
  const box=document.getElementById('scholarship-statistics'),body=box.querySelector('[data-stat-body]');
  const type=box.querySelector('[data-stat-type]'),year=box.querySelector('[data-stat-year]'),term=box.querySelector('[data-stat-term]');
  const cache=new Map(),records=new Map();let active=null,sequence=0,lastError='';
  const note='학기·대학 유형별 집계 자료입니다. 연간 고유 학생 수나 개인의 지원 가능 여부를 뜻하지 않습니다.';
  const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  function record(data,row,index){return {id:'kosafstats-'+data.type+'-'+index,kind:'statistics',type:'장학통계',title:data.title+' · '+row['기준년도']+'년 '+row['장학학기 명']+' · '+row['대학구분그룹 명']+' '+row['설립형태 명'],raw:row,source:'한국장학재단',sourceDate:data.sourceDate,syncedAt:data.syncedAt,url:data.url,body:Object.entries(row).map(([k,v])=>k+' · '+(v==null||v===''?'정보 없음':v)).join('\n'),cond:{},docs:[]};}
  async function load(kind){
    if(cache.has(kind))return cache.get(kind);
    const r=await fetch(feedOrigin+'/api/scholarship-statistics?type='+encodeURIComponent(kind),{signal:AbortSignal.timeout(55000)});
    const d=await r.json();if(!r.ok)throw Error(d.error||'통계를 불러오지 못했어요.');
    if(!Array.isArray(d.rows))throw Error('통계 응답을 확인해 주세요.');
    cache.set(kind,d);d.rows.forEach((row,i)=>{const n=record(d,row,i);records.set(n.id,n);});return d;
  }
  function options(select,values){select.replaceChildren(...values.map(v=>{const o=el('option',v);o.value=v;return o;}));}
  function paint(){
    if(!active)return;
    const rows=active.rows.filter(r=>String(r['기준년도'])===year.value&&(term.value==='전체 학기'||r['장학학기 명']===term.value));
    body.replaceChildren();
    const meta=el('p','자료 기준일 '+active.sourceDate+' · 마지막 동기화 '+new Date(active.syncedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}));meta.className='stat-note';body.append(meta);
    if(active.warning)body.append(el('p',active.warning));
    body.append(el('p',note+(type.value==='family'?' 총수혜금액은 원문 수치입니다. 제공 명세에서 화폐 단위를 확인할 수 없어 원·만원으로 환산하지 않았습니다.':'')));
    if(!rows.length){body.append(el('p','선택한 기간의 통계가 없습니다.'));return;}
    const cols=['대학구분그룹 명','설립형태 명',...(type.value==='people'?['학적구분 명','신청인원(명)','수혜인원(명)']:['장학상품유형 명','대학소재지 명','총수혜금액'])];
    if(term.value==='전체 학기')cols.unshift('장학학기 명');
    const wrap=el('div','');wrap.className='stat-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','장학통계 표, 가로 스크롤 가능');
    const table=el('table',''),head=el('thead',''),tr=el('tr',''),tbody=el('tbody','');
    table.append(el('caption',year.value+'년 '+active.title+' · '+rows.length+'개 집계 행'));
    for(const k of cols){const th=el('th',k==='총수혜금액'?'총수혜금액 (원문 수치)':k);th.scope='col';tr.append(th);}head.append(tr);
    for(const row of rows){const tr=el('tr','');for(const k of cols)tr.append(el('td',typeof row[k]==='number'?row[k].toLocaleString('ko-KR'):row[k]||'정보 없음'));tbody.append(tr);}
    table.append(head,tbody);wrap.append(table);body.append(wrap);
    const link=el('a','출처: 한국장학재단 · 공공데이터포털');link.href=active.url;link.target='_blank';link.rel='noopener noreferrer';body.append(link);
  }
  async function refresh(){const ticket=++sequence;body.replaceChildren(el('p','공식 장학통계를 불러오는 중이에요…'));year.disabled=term.disabled=true;
    try{const data=await load(type.value);if(ticket!==sequence)return;active=data;lastError='';options(year,[...new Set(data.rows.map(r=>String(r['기준년도'])))].sort().reverse());options(term,['전체 학기',...[...new Set(data.rows.map(r=>r['장학학기 명']))].sort()]);year.disabled=term.disabled=false;paint();}
    catch(e){if(ticket!==sequence)return;active=null;lastError=e.name==='TimeoutError'?'통계 조회가 지연되고 있어요. 다시 시도해 주세요.':e.message;body.replaceChildren(el('p',lastError));const retry=el('button','다시 불러오기');retry.type='button';retry.onclick=refresh;body.append(retry);}
  }
  type.onchange=refresh;year.onchange=term.onchange=paint;box.ontoggle=()=>{if(box.open&&!active)refresh();};
  async function lookup(question){
    const kind=/다자녀/.test(question)?'family':'people';
    try{const data=await load(kind);lastError='';const requested=question.match(/(20\d{2})\s*년/)?.[1];const wanted=requested||String(Math.max(...data.rows.map(r=>Number(r['기준년도']))));
      const semester=question.match(/([12])\s*학기/)?.[1],region=question.match(/강원|서울|경기|부산|충북|충남|전북|전남|경북|경남|제주|인천|대구|대전|광주|울산|세종/)?.[0];
      const school=/전문대/.test(question)?'전문대':/일반대/.test(question)?'일반대':'';
      return [...records.values()].filter(n=>n.id.startsWith('kosafstats-'+kind+'-')&&String(n.raw['기준년도'])===wanted&&(!semester||String(n.raw['장학학기 명']).includes(semester))&&(!school||String(n.raw['대학구분그룹 명']).includes(school))&&(!region||kind==='family'&&String(n.raw['대학소재지 명']).includes(region))).slice(0,5);
    }catch(e){lastError=e.message;return [];}
  }
  async function show(n){box.hidden=false;box.open=true;type.value=n.id.split('-')[1];await refresh();if(active){year.value=String(n.raw['기준년도']);term.value=n.raw['장학학기 명'];paint();}box.scrollIntoView({behavior:'smooth',block:'center'});}
  window.scholarshipStats={lookup,find:id=>records.get(id),show,status:()=>lastError,recognizes:q=>/장학/.test(q)&&/통계|수혜\s*인원|신청\s*인원|지원금액\s*(현황|통계)/.test(q)};
})();

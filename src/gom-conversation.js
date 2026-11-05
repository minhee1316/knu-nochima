(function conversation(){
  const state={student:null,signals:{keywords:[],tags:[]},topic:'',city:'',items:[],focus:null,tuition:null,recommendations:new Map(),previous:null,pending:null};
  // Keep paired messages for this open chat only. Store record IDs so facts
  // such as deadlines and venues can be read again from the latest feed.
  const messages=[];
  const turnLimit=8;
  let menuThisTurn=null;
  let detailThisTurn=null;
  let session=0;
  let lastSearch={source:'all',city:''};
  let previousAI='',roadmapGoal='',roadmapTerms=[];
  function previousMenu(predicate=()=>true){
    return messages.findLast(m=>m.role==='assistant'&&m.menu&&predicate(m.menu))?.menu;
  }
  const current=()=>({...profile,...(state.student||{}),interests:[...new Set([...(profile.interests||[]),...(state.student?.interests||[])])]});
  const schoolOnly=n=>!['event','startup','training'].includes(n.kind);
  const available=p=>NOTICES.map(n=>({...n,...judge(n,p),left:dleft(n.deadline)})).filter(n=>n.left>=0&&n.s!=='no');
  const findById=id=>NOTICES.find(n=>String(n.id)===String(id))||window.gomAssist?.find(id)||window.govBenefits?.find(id)||window.examFeed?.find(id);
  const joined=n=>[n.title,n.summary,n.snippet,n.body,...(n.tags||[])].join(' ').toLowerCase();
  const money=v=>Number(v||0).toLocaleString('ko-KR')+'원';
  const say=t=>gdAdd('bot',t);
  const evidence=n=>[...(n.body||'').split(/\n/),...(n.scan||[]).flatMap(s=>s.lines||[]),...(n.summary||'').split(/\n/)].map(x=>x.trim()).filter(Boolean);
  const reason=(n,p)=>judge(n,p).reasons.map(x=>x[1]).slice(0,2).join(' · ');
  function results(intro,rows,p,explain=()=>'',suffix=''){
    state.items=rows.slice(0,5).map(n=>String(n.id));state.focus=null;state.recommendations=new Map();
    menuThisTurn={ids:[...state.items],types:[...new Set(rows.slice(0,5).map(n=>n.type))],topic:state.topic,city:state.topic==='local'?state.city:''};
    const el=say(intro+(suffix?'\n'+suffix:''));
    const msg=el.querySelector('.gd-msg');
    state.items.forEach((id,i)=>{
      const n=rows[i],why=explain(n)||'';
      state.recommendations.set(id,{p:{...p},why});
      const card=document.createElement('div');card.className='gd-item';const btn=document.createElement('button');btn.className='gom-result';btn.type='button';
      btn.textContent=(i+1)+'. '+n.title;btn.onclick=()=>{const live=findById(id);if(!live)return say('이 항목은 최신 목록에서 빠졌어요. 다시 찾아볼게요.');state.focus=id;showDetail(live,p,why);};
      const info=document.createElement('div');info.className='meta';
      info.textContent=n.kind==='exam'?'한국산업인력공단 · '+n.categoryName:n.kind==='benefit'?[n.org,n.field,n.source].filter(Boolean).join(' · '):n.kind==='training'?[n.format,n.address,n.source].filter(Boolean).join(' · '):n.kind==='event'?[n.region,[n.start,n.deadline].filter(Boolean).join(' ~ '),n.source].filter(Boolean).join(' · '):[n.type,n.deadline?'마감 '+n.deadline:'마감일 확인 필요',judge(n,p).s==='ok'?'입력 조건 충족':'추가 조건 확인',n.source].filter(Boolean).join(' · ');
      card.append(btn,info);
      if(why){const line=document.createElement('p');line.className='gd-why';line.textContent=why;card.append(line);}
      msg.append(card);
    });$('#gd-log').scrollTop=$('#gd-log').scrollHeight;
  }
  function showDetail(n,p,why){
    if(n.kind==='kosaf')return window.gomScholarshipDetail(n.id.slice(6));
    GD.why=why?{who:[p.campus,p.grade&&p.grade+'학년'].filter(Boolean).join(' · ')||'상담 조건',why:[why],ev:'',check:[]}:null;
    try{openDetail(n,p);}finally{GD.why=null;}
  }
  function studentInfo(text){
    const info=GOM.extractProfile(text);
    const p=GOM.cleanPatch(info.patch);
    // A course grade is a search signal. Only a stated GPA is an eligibility value.
    const gpa=text.match(/(?:직전(?:\s*학기)?\s*(?:평균)?\s*평점|(?<!전체\s|누적\s|누적|전체)평점|성적|학점)\s*(?:은|이|이요|:)?\s*([0-4](?:\.\d{1,2})?)(?![\d.])/);
    if(!gpa||/(누적|전체)\s*(학기\s*)?(평균\s*)?평점/.test(text)&&!/직전/.test(text))delete p.gpa;
    else if(+gpa[1]<=4.5)p.gpa=gpa[1];
    if(!info.courses.length&&/파이썬|python/i.test(text))info.courses.push('파이썬');
    if(info.courses.some(c=>/파이썬|python|자료구조|코딩/i.test(c))&&!info.tags.includes('AI·SW'))info.tags.push('AI·SW');
    if(/공학|공대/.test(text))p.college='공학·IT';
    else if(/자연과학/.test(text))p.college='자연과학';
    else if(!/학과|계열|학부|인문|사회과학|예체능|간호|보건/.test(text))delete p.college;
    return {p,info};
  }
  function remember(text,another=false){
    const {p,info}=studentInfo(text);
    if(another){state.student={...EMPTY,interests:[]};state.signals={keywords:[],tags:[]};}
    state.student={...(state.student||{}),...p};
    state.signals={tags:[...new Set([...state.signals.tags,...info.tags])],keywords:[...new Set([...state.signals.keywords,...info.courses,...info.keywords])].slice(-20)};
    if(info.courses.length)state.student.courses=[...new Set([...(state.student.courses||'').split(', ').filter(Boolean),...info.courses])].join(', ');
    state.student.interests=state.signals.tags;
  }
  const requestedType=t=>/장학|생활비|주거비/.test(t)?'장학금':/공모전|해커톤|경진대회/.test(t)?'공모전':/비교과|특강/.test(t)?'비교과':'';
  function recommend(text,options={}){
    const sameStudent=state.topic==='counsel'&&options.refine;
    const kind=requestedType(text)||(sameStudent?previousMenu(m=>m.topic==='counsel')?.requestedType:'')||'';
    state.topic='counsel';const p=current();let list=available(p).filter(schoolOnly);
    if(kind)list=list.filter(n=>n.type===kind);
    const picked=GOM.recommend(list,{...state.signals,tags:p.interests,types:kind?[kind]:[]},5);
    const reasons=new Map(picked.map(x=>[String(x.id),[x.why.filter(y=>!/^지원 가능 판정$|^요청한 종류/.test(y)).slice(0,2).join(' · '),reason(findById(x.id),p)].filter(Boolean).join(' / ')]));
    const rows=picked.map(x=>findById(x.id)).filter(Boolean);
    const who=[p.campus,p.grade&&p.grade+'학년',p.courses,p.gpa&&'직전 평점 '+p.gpa].filter(Boolean).join(' · ');
    results(rows.length?`${who?who+' 기준으로 ':''}${kind||'프로그램'} ${rows.length}건을 골랐어요.`:`현재 조건에 맞는 ${kind||'공지'}를 찾지 못했어요.`,rows,p,n=>reasons.get(String(n.id)),!who&&!options.skipPrompt?'캠퍼스와 학년, 수강한 과목을 알려주면 더 좁혀볼게요.':'');
    menuThisTurn.requestedType=kind;
  }
  function listRegion(text,city){
    state.topic='local';state.city=/두\s*지역|전체|둘\s*다|춘천.*삼척|삼척.*춘천/.test(text)?'':city||state.city||current().campus||'';
    if(!state.city&&!/두\s*지역|전체|둘\s*다/.test(text)){state.pending={intent:'city',text};return say('춘천과 삼척 중 어디에서 열리는 행사를 볼까요?');}
    state.pending=null;const p=current();const region=state.city;
    let list=NOTICES.filter(n=>n.kind==='event'&&dleft(n.deadline)>=0&&(!region||n.region===region));
    const day=new Date().getDay(),weekend=(6-day+7)%7,limit=/이번\s*주말|주말/.test(text)?[day===0?0:weekend,day===0?0:weekend+1]:/오늘/.test(text)?[0,0]:/내일/.test(text)?[1,1]:/이번\s*주/.test(text)?[0,(7-day)%7]:null;
    if(limit)list=list.filter(n=>n.start&&dleft(n.start)<=limit[1]&&dleft(n.deadline)>=limit[0]);
    list.sort((a,b)=>String(a.start||'').localeCompare(String(b.start||'')));
    results(list.length?`${region||'춘천·삼척'}에서 ${limit?'요청한 기간에 참여할 수 있는':'진행 중이거나 예정된'} 행사가 ${list.length}건 있어요.`:`현재 목록에는 ${region||'두 지역'}의 ${limit?'요청 기간에 맞는 ':''}행사가 없어요.`,list,p);
    menuThisTurn.period=text.match(/이번\s*주말|주말|오늘|내일|이번\s*주/)?.[0]||'';
  }
  function perks(text){
    const p=current(),city=text.match(/춘천|삼척/)?.[0];
    const list=available(p).filter(n=>!city||n.region===city||(!n.region&&(!Array.isArray(n.cond?.campus)||n.cond.campus.includes(city))));
    if(/P3L|지역\s*(문제|현안)/i.test(text)){state.topic='local-project';const rows=list.filter(n=>schoolOnly(n)&&/P3L|지역\s*(문제|현안)/i.test(joined(n)));return results(rows.length?'지역문제 탐구와 관련된 학교 공고예요.':'현재 목록에는 접수 가능한 지역문제 공모전을 찾지 못했어요.',rows,p);}
    if(/열린\s*캠퍼스|주민.*(?:학교|캠퍼스)|(?:학교|캠퍼스).*주민/.test(text)){state.topic='public';return results('학교 공지에서 주민·방문객 참여 문구가 있는 프로그램을 찾았어요.',list.filter(n=>schoolOnly(n)&&isPublic(n)),p);}
    state.topic='perks';const volunteer=/1365|봉사/.test(text),pattern=volunteer?/봉사\s*시간|1365|VMS/i:/마일리지/;
    const rows=list.map(n=>({n,e:(n.perks||[]).find(x=>pattern.test(x.k+' '+x.ev))})).filter(x=>x.e);
    const m=new Map(rows.map(x=>[x.n.id,x.e.ev]));
    return results(rows.length?`공고에 ${volunteer?'봉사 실적':'마일리지'} 관련 문구가 있는 항목이에요.`:'현재 수집한 공고에서 해당 인정 문구를 찾지 못했어요.',rows.map(x=>x.n),p,n=>m.get(n.id), '단순 행사 참석만으로 봉사시간이나 장학금이 적립되지는 않아요. 인정 기관과 신청 기준을 원문에서 확인하세요.');
  }
  function benefit(text){
    const p=current(),eligible=available(p).filter(schoolOnly);
    const documented={
      '721-2523':[0,'출신지·학년 조건 확인'],
      '721-2524':[1,'경제 사정·선발 심사 확인'],
      '721-2528':[1,'기부처별 자격과 중복 제한 확인'],
      '721-2534':[1,'창업 아이디어 제출·선발 심사 확인'],
      '721-2541':[1,'유형별 활동 실적과 선발 조건 확인'],
      '504-11588':[2,'계획서 심사·개인별 지원 한도 확인'],
      '504-11591':[2,'수료 조건·상품권 지급']
    };
    const m=text.match(/(?:등록금|잔액|본인\s*부담금?)[^\d]{0,10}([\d,]+(?:\.\d+)?)\s*(만)?\s*원?/);
    if(m){const value=Number(m[1].replaceAll(',',''))*(m[2]?10000:1);if(Number.isFinite(value)&&value>=0&&value<=30000000)state.tuition=value;}
    const groups=[[],[],[]],labels=['등록금 지원','생활비·주거','비교과 활동비·상품권'];
    for(const n of eligible){
      if(!Number(n.amount)||!n.deadline)continue;
      const doc=documented[n.id];const txt=[n.title,n.summary,n.body].filter(Boolean).join(' ');
      const category=doc?doc[0]:/생활비성\s*장학|주거비\s*장학/.test(txt)?1:/등록금성\s*장학|등록금\s*범위\s*(?:내|에서)/.test(txt)?0:-1;
      if(category<0)continue;
      const sum=category===0&&state.tuition!=null?Math.min(state.tuition,n.amount):n.amount;
      groups[category].push({n,sum,reason:doc?.[1]||'개별 공고의 금액·지급 조건 확인'});
    }
    groups.forEach(g=>g.sort((a,b)=>b.sum-a.sum));const chosen=groups.map(g=>g[0]);
    const cap=chosen.reduce((acc,c,i)=>acc+(!c||(i===0&&state.tuition==null)?0:c.sum),0);
    const byId=new Map(chosen.filter(Boolean).map(x=>[x.n.id,x.reason]));
    const missing=chosen[0]&&state.tuition==null;
    const headline=groups.map((g,i)=>labels[i]+' · '+(g.length?(i===0&&missing?'잔액 확인 필요':money(g[0].sum)):'금액 확인된 후보 없음')).join('\n');
    state.topic='benefit';
    results(headline+'\n\n'+(cap?'유형별 1건씩 함께 선정된다고 가정한 '+(missing?'등록금 제외 ':'')+'상한은 '+money(cap)+'이에요.':'제공된 자료에서 합산할 수 있는 금액을 확인하지 못했어요.'),chosen.filter(Boolean).map(x=>x.n),p,n=>byId.get(n.id),
      '중복 수혜는 각 공고에서 따로 확인해야 해요.'+(missing?' “남은 등록금 100만원”처럼 알려 주면 등록금까지 다시 계산해요.':''));
  }

  function simulate(t){
    const p=current(),key=/누적|전체/.test(t)?'cumulativeGpa':'gpa',base=p[key];
    const increase=t.match(/(?:\+|플러스\s*)?\s*(0\.\d+)\s*점?/);const target=t.match(/(?:평점|학점|성적)(?:이|을|은|가)?\s*([0-4](?:\.\d{1,2})?)/);
    const down=/내리|낮|떨어|줄/.test(t);
    if(base==null||base===''){state.pending={intent:'gpa',text:t,key};return say('비교할 기준이 필요해요. 현재 '+(key==='gpa'?'직전':'누적')+' 평점이 몇 점인가요?');}
    const next=increase?+base+(down?-1:1)*Number(increase[1]):target?+target[1]:NaN;
    if(!Number.isFinite(next))return say('얼마로 바꿔 볼까요? 예를 들어 “직전 평점이 0.2점 오르면?”이라고 적어 주세요.');
    const val=Math.max(0,Math.min(4.5,Math.round(next*100)/100)),alt={...p,[key]:String(val)};
    const all=NOTICES.filter(n=>n.type==='장학금'&&dleft(n.deadline)>=0),rank={no:0,warn:1,ok:2};
    const gains=all.filter(n=>rank[judge(n,alt).s]>rank[judge(n,p).s]),loss=all.filter(n=>rank[judge(n,alt).s]<rank[judge(n,p).s]);
    state.topic='whatif';results(`${key==='gpa'?'직전':'누적'} 평점 ${Number(base).toFixed(2)} → ${val.toFixed(2)}로 가정했어요. 새로 검토할 수 있는 장학금 ${gains.length}건, 판정이 낮아진 장학금 ${loss.length}건이에요.`,gains.length?gains:loss,alt,n=>reason(n,alt),'이 계산은 저장된 평점을 바꾸지 않아요.');
  }
  function reportPlans(){
    const rows=GD.plans;if(!rows.length)return say('저장된 할 일이 아직 없어요. 관심 있는 공지를 고른 다음 “1번 할 일 만들어줘”라고 해 주세요.');
    const el=say('저장된 지원 준비 목록이에요. 완료한 항목을 체크하세요.').querySelector('.gd-msg');
    for(const plan of rows){const box=document.createElement('div');box.className='gd-item';const title=document.createElement('b');title.textContent=plan.title;box.append(title);
      for(const step of plan.steps){const lab=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.checked=step.done;c.onchange=()=>{step.done=c.checked;gdSavePlans();};lab.style.display='block';lab.append(c,' '+step.t);box.append(lab);}el.append(box);}
  }
  function follow(n,t){
    detailThisTurn=String(n.id);
    if(n.kind==='exam'){
      if(/자세히|상세|원문.*열/.test(t))return showDetail(n,current());
      return say(n.title+'\n'+window.examFeed.fact(n));
    }
    if(n.kind==='benefit'){
      if(/자세히|상세|원문.*열/.test(t))return showDetail(n,current());
      return say(n.title+'\n'+window.gomAssist.fact(n)+'\n'+(n.url?'['+n.source+' 원문]('+n.url+')':''));
    }
    if(n.kind==='training'){
      if(/자세히|상세|원문.*열/.test(t))return showDetail(n,current());
      return say([n.title,window.gomAssist.fact(n),n.phone&&'문의 '+n.phone,'모집 여부는 훈련기관에 확인하세요.'].filter(Boolean).join('\n'));
    }
    if(n.kind==='kosaf'){
      if(/자세히|상세|열어|원문/.test(t))return showDetail(n,current());
      const fields=/서류|준비물/.test(t)?['docs']:/언제|마감|기간/.test(t)?['start','end']:/성적|평점|학점/.test(t)?['gpa']:
        /지역|거주/.test(t)?['region']:/소득|구간/.test(t)?['income']:/금액|얼마|지원금/.test(t)?['benefit']:['specific','region','gpa','limits'];
      const values=fields.map(k=>n.raw[k]).filter(v=>v&&v!=='정보 없음');
      return say(n.title+'\n'+(values.join('\n')||'재단 자료에 이 조건이 기재되지 않았어요.')+(n.url?'\n[운영기관 원문]('+n.url+')':''));
    }
    const p=state.recommendations.get(String(n.id))?.p||current();
    const why=state.recommendations.get(String(n.id))?.why||reason(n,p);
    if(/왜|이유|근거가\s*뭐/.test(t))return say(n.title+'\n'+(why||'요청한 주제와 공고의 공개 정보가 일치해요.')+'\n'+(n.url?'[원문 보기]('+safeUrl(n.url)+')':''));
    if(/첨부|포스터|판독/.test(t)){const doc=n.scan?.[0];return say(doc?n.title+'\n'+doc.name+'에서 판독한 내용이에요.\n'+doc.lines.slice(0,4).join('\n')+'\n[첨부 원문]('+safeUrl(doc.url)+')':n.title+'\n현재 읽을 수 있는 첨부 판독 근거가 없어요. [원문 보기]('+safeUrl(n.url)+')');}
    if(/할\s*일|체크리스트/.test(t)){gdTool('create_plan',{id:n.id});return reportPlans();}
    if(/자소서|지원서|지원\s*동기|활동계획서|자기소개/.test(t)){const r=GOM.applicationOutline(n,p.courses?'수강한 과목: '+p.courses:'',p);return gdAdd('bot','이 공고용 초안이에요. 대괄호 부분에 본인의 경험을 넣어 주세요.',[{name:'draft_application',res:r}]);}
    if(/문의.*(?:메일|초안)|메일/.test(t)){const r=gdTool('draft_inquiry',{id:n.id,question:t});return gdAdd('bot','담당 부서에 보낼 문의 초안을 작성했어요.',[{name:'draft_inquiry',res:r}]);}
    if(/자세히|상세|열어|원문\s*(보|열)/.test(t))return showDetail(n,p,why);
    const source=n.url?'\n[원문 보기]('+safeUrl(n.url)+')':'';
    if(n.kind==='startup'){
      const keys=/제외|제한/.test(t)?['exclusions']:/업력|창업\s*기간/.test(t)?['stage','eligibility']:/나이|연령/.test(t)?['age','eligibility']:
        /자격|대상|누가|누구|조건/.test(t)?['audience','eligibility','exclusions']:/지역/.test(t)?['region']:
        /신청\s*방법|어떻게\s*(?:신청|지원)/.test(t)?['methods','applicationUrl']:[];
      if(keys.length)return say(n.title+'\n'+(keys.map(k=>n[k]).filter(Boolean).join('\n')||'공고 원문에서 확인해 주세요.')+source);
    }
    if(/장소|위치|주소|어디(?:에)?서\s*(?:열|하|해|진행|개최)|어디(?:야|예요|인가요)/.test(t)){
      const location=n.address||evidence(n).find(s=>/^\s*(?:행사\s*|교육\s*|운영\s*|개최\s*)?(?:장소|주소|위치)\s*[:：]/.test(s));
      return say(n.title+'\n'+(location?'장소 · '+location.replace(/^(?:(?:행사|교육|운영|개최)\s*)?(?:장소|주소|위치)\s*[:：]\s*/,''):'수집한 공지에서 장소를 확인할 수 없어요.')+source);
    }
    if(/언제|마감|기간|며칠|몇\s*일/.test(t)){
      const event=n.kind==='event',registration=/접수|신청|지원|마감/.test(t);
      if(!event||!registration){
        const date=n.deadline?(event?(n.start?'행사 기간 '+n.start+' ~ '+n.deadline:'행사 종료일 '+n.deadline):'신청 마감 '+n.deadline):'수집한 공지에서 날짜를 확인할 수 없어요.';
        return say(n.title+'\n'+date+source);
      }
      const term=evidence(n).find(s=>/(?:접수|신청)\s*(?:기간|마감|기한)\s*[:：]/.test(s));
      return say(n.title+'\n'+(term||'행사 신청 마감은 원문에서 확인해 주세요.')+source);
    }
    const specific=/중복|중첩|같이\s*받/.test(t)?/중복|이중\s*지원|타\s*장학금|동일\s*유형/:/초과|휴학/.test(t)?/초과|휴학|수업\s*연한/:/학점|평점/.test(t)?/평점|이수\s*학점|학점\s*이상/:null;
    const r=GOM.noticeQA(n,t);if(specific){r.evidence=evidence(n).filter(l=>specific.test(l)).slice(0,3).map(x=>x.slice(0,250));r.note='현재 본문·첨부에서 해당 기준을 확인하지 못했어요.';}
    return gdAdd('bot',r.evidence.length?'이 공지에서 질문과 관련된 문장을 찾았어요.':r.note||'첨부와 원문에서 확인해 주세요.',[{name:'ask_notice',res:r}]);
  }
  function catalogSearch(t){
    const tokens=t.toLowerCase().replace(/[?!.,“”"']/g,' ').split(/\s+/).map(w=>w.replace(/(?:으로|에서|인지는|인가요|있을까|인데|이에요|하고|하는|있는|관련된|관련|으로|[은는을를이가로도요])$/,'')).filter(w=>w.length>=2&&!/^(공지|공고|추천|이번|지금|찾아|있어|뭐야|어떤|신청|참여|장학금|공모전|알려|마감|모집|관련|프로그램|있나요|있을까|궁금|대해서|가능)/.test(w));
    if(!tokens.length)return false;
    const kind=requestedType(t),p=current();const hits=available(p).filter(n=>!kind||n.type===kind).map(n=>({n,score:tokens.reduce((v,k)=>v+(n.title.toLowerCase().includes(k)?5:joined(n).includes(k)?1:0),0)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.n.left-b.n.left);
    if(!hits.length)return false;
    state.topic='search';results('질문에 포함된 단어를 현재 공지 원문에서 찾아봤어요.',hits.map(r=>r.n),p);return true;
  }
  function itemQuestion(t){
    const ordinal=t.match(/(\d{1,2})\s*번(?:째)?|(첫|두|세|네|다섯)\s*번째/);
    const number=ordinal?Number(ordinal[1]||({첫:1,두:2,세:3,네:4,다섯:5})[ordinal[2]]):null;
    const detail=/왜|이유|서류|지원\s*동기|자소서|지원서|계획서|연락|문의|메일|대상이|중복|언제|마감일?|기간은|어디(?:에)?서|어디야|장소|주소|위치|할\s*일\s*(?:만들|추가)|어떻게\s*신청|자세히|상세|조건이|첨부|원문|준비물|휴학생|초과학기|거기|이거|그거|그\s*공지|제출|쉽게|풀어서|요약|설명해/.test(t);
    const pending=state.pending?.intent==='notice'?state.pending:null;
    const plainNumber=t.match(/^\s*(\d{1,2})\s*[.!?]?\s*$/);
    const selection=number??(pending&&plainNumber?Number(plainNumber[1]):null);
    if(selection===null&&(!detail||/새로운|다른\s*공지|찾아|추천해|모아|이번\s*주.*(?:정리|마감)|^\s*(?:최대|총액|받을 수 있는 금액)/.test(t)))return false;
    const historical=/아까|이전|앞서|처음에|전에\s*(?:본|보여|추천)/.test(t);
    const kind=requestedType(t)||(/행사|축제|공연/.test(t)?'지역행사':'');
    const city=t.match(/춘천|삼척/)?.[0];
    let ids=state.items,focus=state.focus,question=t;
    if(historical||kind&&(selection!==null||/그중|중에|목록/.test(t))){
      const menu=previousMenu(m=>(!kind||m.types.includes(kind))&&(!city||m.city===city||m.ids.some(id=>findById(id)?.cond?.campus?.includes?.(city))));
      if(!menu){say('이 대화에서 그 목록을 찾지 못했어요. 공지 제목이나 분야를 알려 주세요.');return true;}
      menuThisTurn=menu;ids=menu.ids;focus=ids.includes(focus)?focus:null;
    }else if(pending&&selection!==null){
      ids=pending.ids;focus=null;
      if(!detail)question=pending.question;
    }
    if(!ids.length&&!focus&&selection===null)return false;
    if(selection===null&&!focus&&ids.length>1){
      state.pending={intent:'notice',ids:[...ids],question};
      const choices=ids.map((id,i)=>(i+1)+'. '+(findById(id)?.title||'목록에서 내려간 공지'));
      say('어느 항목을 볼까요? 번호만 알려 주세요.\n'+choices.join('\n'));return true;
    }
    const id=selection!==null?ids[selection-1]:(focus||ids[0]);
    if(!id){say(ids.length?'목록에는 '+ids.length+'개가 있어요. 표시된 번호를 골라 주세요.':'먼저 찾고 싶은 공지나 행사를 알려 주세요.');return true;}
    state.pending=null;
    const n=findById(id);
    if(!n){if(state.focus===id)state.focus=null;say('그 항목은 최신 목록에서 빠졌어요. 다른 공지를 골라 주세요.');return true;}
    state.items=[...ids];state.focus=String(id);
    follow(n,detail||question!==t?question:'자세히');return true;
  }
  async function route(t,activeSession){
    const again=/갱신|새로\s*(?:고침|불러|확인)|업데이트/.test(t);
    if(again)await refreshFeed(true);
    else if(feedState.loading||Date.now()-feedState.started>=900000){
      const refresh=refreshFeed();
      if(NOTICES.length)await Promise.race([refresh,new Promise(done=>setTimeout(done,1200))]);else await refresh;
    }
    if(activeSession!==session)return;
    const p=current();
    if(/(?:데이터|자료|공지).*(?:언제\s*(?:갱신|수집)|실시간|최신이야)|마지막.*(?:갱신|수집)/.test(t)||again&&!/추천|행사|찾아/.test(t))return say(`학교 공지 ${feedState.school}, 지역 행사 ${feedState.events} 기준이에요. 지금 목록에는 학교 공지 ${NOTICES.filter(schoolOnly).length}건과 지역 행사 ${NOTICES.filter(n=>n.kind==='event').length}건이 있어요.`);
    if(/다른\s*학생|새\s*학생|상담.*초기화|새\s*상담/.test(t)){
      clearContext();
      const log=$('#gd-log'),currentMessage=[...log.querySelectorAll('.me')].at(-1);
      if(currentMessage){while(log.firstChild&&log.firstChild!==currentMessage)log.firstChild.remove();}
      if(!/\d\s*학년/.test(t))return say('새 상담을 시작할게요. 학생의 캠퍼스와 학년, 관심 분야를 알려 주세요.');
    }
    if(/되돌리|원래.*조건/.test(t)&&state.previous){profile=state.previous;state.previous=null;state.student=null;syncForm();syncInterests();save();render();return say('왼쪽 내 조건을 상담 전 상태로 되돌렸어요.');}
    if(/(?:내\s*조건|프로필|왼쪽).*(?:적용|저장|반영)|(?:이대로|이\s*조건).*(?:적용|저장)/.test(t)){
      const info=studentInfo(t);if(Object.keys(info.p).length||info.info.courses.length)remember(t);
      if(!state.student)return say('저장할 학생 조건을 먼저 말해 주세요.');state.previous={...profile,interests:[...profile.interests]};profile={...current()};save();syncForm();syncInterests();render();return say('상담에서 알려 준 정보를 왼쪽 내 조건에 적용했어요. 공지 목록도 다시 판정했어요.');
    }
    if(/도움말|뭐\s*할\s*수|할\s*수\s*있는\s*일|사용법/.test(t))return say('캠퍼스·학년·수강과목으로 장학금이나 공모전을 찾고, 평점 변화와 지원금을 비교할 수 있어요. 지역 행사와 봉사도 찾아봐요. 추천을 받은 뒤에는 “1번 서류가 뭐야?” 또는 “1번 지원서 초안 써 줘”처럼 이어서 물어보세요.');
    if(/K[-\s]?Cloud|케이클라우드|학교\s*시스템/.test(t)&&/연계|연동|로드맵|계획/.test(t))return say('K-Cloud 연계는 향후 계획이에요. 학교 승인과 학생 동의 → 학적·수강 정보 불러오기 → 비교과·봉사 실적 확인 순서로 구상했어요. 지금 상담에는 직접 입력한 정보와 공개 공지를 사용해요.');
    if(/일괄|미확인|새\s*(?:첨부|포스터)|내\s*(?:파일|포스터)|업로드|올리|올릴|직접\s*판독/.test(t)&&/첨부|포스터|판독|PDF|파일/i.test(t))return gomReadAttachments(t);
    if(state.topic==='benefit'&&/등록금|잔액/.test(t)&&/\d/.test(t))return benefit(t);
    if(/^(?:안녕(?:하세요)?|반가워|곰두리야)[!.?~\s]*$/.test(t))return say('반가워요! 어떤 공지나 행사를 찾고 있나요?');
    if(/판독한|읽어\s*둔/.test(t)&&/첨부|포스터/.test(t))return results('첨부에서 조건을 읽어 둔 공고예요.',available(p).filter(n=>n.scan?.length),p,n=>n.scan[0].name);
    if(/(?:방금|직전|마지막|이전)\s*(?:네\s*)?(?:답변|대답).*(?:다시|뭐)|(?:네가|곰두리가)\s*(?:방금\s*)?뭐라/.test(t)){
      const last=messages.findLast(m=>m.role==='assistant'&&m.content);
      return say(last?'직전 답변이에요.\n'+last.content:'이번 상담에는 아직 앞선 답변이 없어요.');
    }
    if(/(?:내가|아까|방금|직전).*(?:뭐(?:라고|라)|무슨 질문)|마지막\s*질문.*(?:뭐|다시)/.test(t)){
      const last=messages.findLast(m=>m.role==='user');
      return say(last?'직전 질문은 “'+last.content+'”였어요.':'이번 상담에서는 아직 앞선 질문이 없어요.');
    }
    const city=t.match(/춘천|삼척/)?.[0];
    const period=t.match(/이번\s*주말|주말|내일|오늘|이번\s*주/)?.[0];
    if(state.topic==='local'&&state.pending?.intent!=='city'&&/^(?:(?:그럼|그러면|그중|거기서|대신)\s*)?(?:춘천|삼척|두\s*지역|둘\s*다|주말|오늘|내일|이번\s*주)(?:에는|에서는|은|는|도|만|엔|에|이요|요|쪽|지역|이번|주말|오늘|내일|\s|[?!.])*$/u.test(t)){
      const previous=previousMenu(m=>m.topic==='local');
      return listRegion((period||previous?.period||'')+' '+t,city||previous?.city);
    }
    const compare=/비교|차이|다른\s*점|(?:뭐가|어떻게|어디가)\s*달라|어느\s*(?:쪽|것|게)|뭐가\s*더|뭘\s*먼저|그\s*중.*(?:신청|지원|가능|맞는)|둘\s*중/.test(t);
    if(compare&&state.items.length&&!/수혜\s*조합|총액|합계/.test(t)){
      const nums=[...t.matchAll(/(\d+)\s*번/g)].map(m=>Number(m[1])-1);
      const ids=nums.length?[...new Set(nums)].map(i=>state.items[i]):state.items.slice(0,3);
      const rows=ids.map(findById).filter(Boolean);
      if(rows.length!==ids.length||!rows.length)return say('현재 목록에 있는 번호를 골라 주세요.');
      state.topic='compare';
      return results('방금 본 공고의 마감과 신청 조건이에요.',rows,p,n=>[window.gomAssist?.fact(n),reason(n,p)].filter(Boolean).join(' · '));
    }
    if(isExamQuestion(t)){
      const rows=await window.examFeed.lookup(t,[]);
      if(activeSession!==session)return;
      state.topic='exams';return results(rows.length?'큐넷에 등록된 시험일정이에요.':'이 조건으로 확인할 수 있는 일정이 없어요. '+window.examFeed.status(t),rows,p,window.gomAssist.fact);
    }
    if(itemQuestion(t))return;
    if(/복지로|중앙부처.*복지|정부\s*24|보조금\s*24|공공\s*혜택|주민.*혜택|복지\s*(?:혜택|지원)|이사비/.test(t)&&window.govBenefits){
      const terms=(t.match(/이사비|청년|월세|주거|출산|돌봄|장애인|저소득|문화|교육|장학|어르신/g)||[]);
      const rows=await window.gomAssist.lookup({source:/복지로|중앙부처.*복지/.test(t)?'welfare':'benefits',city:city||'',terms},[],t);
      if(activeSession!==session)return;
      state.topic='benefits';return results(rows.length?'공공혜택 검색 결과예요.':window.govBenefits.status()+' 조건에 맞는 혜택을 찾지 못했어요.',rows,p,window.gomAssist.fact);
    }
    if(/일\s*학습\s*병행|고용24|훈련\s*과정|일하면서\s*(?:배우|배울)|\bIPP\b/i.test(t)&&window.work24Feed){
      const list=await window.gomAssist.lookup({source:'training',city:city||'',terms:[]},[]);
      if(activeSession!==session)return;
      state.topic='training';
      return results(list.length?'고용24 일학습병행 훈련과정이에요.':window.work24Feed.status()+' 조건에 맞는 과정이 없어요.',list,p,window.gomAssist.fact);
    }
    if(/(?:k[\s-]*startup|케이\s*스타트업|창업\s*(?:지원|공고|사업|모집))/i.test(t)&&window.startupFeed){
      await window.startupFeed.refresh();
      if(activeSession!==session)return;
      const local=/삼척|춘천|강원/.test(t);
      const rows=available(p).filter(n=>n.kind==='startup'&&(!local||window.startupFeed.inRegion(n.region,city)))
        .sort((a,b)=>a.left-b.left);
      state.topic='startup';
      if(!rows.length)return say(window.startupFeed.status()+'\n조건에 맞는 창업지원 공고를 찾지 못했어요.');
      return results(local?'강원·전국 대상 창업지원 공고예요.':'K-Startup 모집 공고예요.',rows,p,n=>[n.region,n.category,n.stage].filter(Boolean).join(' · '));
    }
    if(/할\s*일\s*(?:목록|보여|뭐|확인)|체크리스트\s*보여|진행\s*상황/.test(t))return reportPlans();
    if(/판독|포스터|첨부.*(?:조건|읽어|확인)/.test(t))return results('읽어 둔 첨부 근거가 있는 공고예요. 번호와 함께 “1번 첨부 읽어줘”라고 물어보세요.',available(p).filter(n=>n.scan?.length),p,n=>n.scan[0].name);
    if(state.pending?.intent==='city'&&(city||/둘\s*다|전체/.test(t))){const q=state.pending.text;state.city=city||'';return listRegion(q+' '+t,city);}
    if(state.pending?.intent==='gpa'&&/^\D*([0-4](?:\.\d{1,2})?)\s*(?:점|이야|이에요|입니다|야|예요|요|이에요|[.!\s])*$/i.test(t)){
      const last=state.pending;state.pending=null;state.student={...(state.student||{}),[last.key]:t.match(/[0-4](?:\.\d{1,2})?/)[0]};return simulate(last.text);}
    state.pending=null;
    if(/(?:평점|학점|성적|\+|0\.\d).*(오르|오른|올리|올라|오르면|높이|낮|내리|떨어|바뀌|이라면|이면|라면|되면|가정)|what[\s-]*if|만약.*평점/i.test(t)||state.topic==='whatif'&&/0\.\d+\s*점?/.test(t))return simulate(t);
    if(/수혜\s*조합|최대.*(?:얼마|수혜|금액|장학)|총액|지원금.*(?:비교|합계)|장학금.*(?:얼마|합계|비교)|얼마.*받|같이\s*받|수혜.*시뮬|얼마나.*(?:지원|장학)|둘\s*다.*받|지원금.*얼마/.test(t))return benefit(t);
    if(/마일리지|봉사|1365|P3L|지역\s*(?:문제|현안)|열린\s*캠퍼스|주민.*(?:학교|캠퍼스)/i.test(t))return perks(t);
    if(/지역\s*행사|축제|공연|지역\s*주민|행사/.test(t)&&!/학교\s*행사|교내\s*행사/.test(t)||state.topic==='local'&&city&&t.length<11)return listRegion(t,city);
    if(/최신|새\s*(?:공지|공고)|새로\s*(?:뜬|온|올라|등록)|최근\s*(?:공지|공고)/.test(t)){
      state.topic='recent';const kind=requestedType(t);const notices=NOTICES.filter(n=>schoolOnly(n)&&(!kind||n.type===kind)&&dleft(n.deadline)>=0).sort((a,b)=>String(b.posted||'').localeCompare(String(a.posted||'')));
      return results('현재 목록에서 게시일이 최근인 공지부터 골랐어요.',notices,p,n=>n.posted?'게시 '+n.posted:'');}
    if(window.gomAssist&&!/[1-6]\s*학년|내\s*조건.*적용|(?:평점|학점)\s*\d|학식|도서관|학사\s*일정/.test(t)&&
      (/장학재단|재단\s*장학|부담|방값|집세|월세|일자리|포트폴리오|면접|회사를|만들어\s*보고|경험해\s*보고/.test(t)||!state.pending&&t.length>=10&&!/취업\s*준비|수강|상담\s*기록|한\s*달.*계획/.test(t))){
      const hit=await window.gomAssist.candidates(t,available(p));
      if(activeSession!==session)return;
      if(hit&&(hit.rows.length||hit.foundation||hit.topic==='housing'||hit.topic==='living')){
        state.topic='semantic';
        if(!hit.rows.length)return say(hit.stale?'재단 자료 연결이 지연됐어요. 지금 읽을 수 있는 공고에서는 질문에 맞는 항목을 확인하지 못했어요.':'현재 모집 목록에서 질문과 근거가 일치하는 공고를 찾지 못했어요.');
        return results('질문과 관련된 공고를 찾았어요.',hit.rows,p,n=>window.gomAssist.fact(n),hit.stale?'재단 자료 갱신이 지연되어 확인 가능한 공고를 사용했어요.':'');
      }
    }
    const profileText=/[1-6]\s*학년|(?:직전|누적|전체)\s*(?:평균|학기|평점)|(?:평점|학점)\s*[은이가:]?\s*\d|자취|기숙사|수강|배웠|들었|[A-F][+-](?:\s|,|$)|[0-9]\s*구간|희망|전공|관심|취업\s*준비/.test(t);
    if(profileText || (city&&t.length<9&&state.topic!=='local')){
      const newStudent=/이\s*학생|다른\s*학생|새\s*학생/.test(t);
      const correction=t.match(/(?:말고|아니라)\s*(.+)/);
      remember(correction?correction[1]:t,newStudent);
      return recommend(t,{refine:!newStudent});}
    if(/상담\s*기록/.test(t)){
      if(!state.items.length)return say('먼저 학생 정보를 알려 주세요.');
      const rows=state.items.map(findById).filter(Boolean);return say([['상담 조건',p.campus,p.grade&&p.grade+'학년',p.gpa&&'평점 '+p.gpa,p.courses].filter(Boolean).join(' · '),...rows.map((n,i)=>(i+1)+'. '+n.title+' — '+(state.recommendations.get(String(n.id))?.why||reason(n,p)))].join('\n'));}
    if(/학식|도서관|학사\s*일정|이번\s*주.*(?:정리|마감)|한\s*달.*계획/.test(t)){
      const calls=GOM.parseLocal(t,state.items).filter(c=>['campus_link','weekly_digest','make_roadmap'].includes(c.name));
      if(calls.length){const acts=calls.map(c=>({name:c.name,res:gdTool(c.name,c.args)}));state.items=GD.lastIds.slice();return gdAdd('bot',GOM.replyLocal(acts.map(c=>({name:c.name,result:c.res}))),acts);}
    }
    if(catalogSearch(t))return;
    if(/추천|상담|장학|공모|맞는|진로/.test(t))return recommend(t);
    return say('어떤 기회를 찾고 있나요? 학교 공지라면 과목이나 관심 분야를, 지역 행사라면 춘천 또는 삼척을 알려 주세요.');
  }
  function clearContext(){
    previousAI='';roadmapGoal='';roadmapTerms=[];
    lastSearch={source:'all',city:''};
    Object.assign(state,{student:null,signals:{keywords:[],tags:[]},topic:'',city:'',items:[],focus:null,tuition:null,recommendations:new Map(),previous:null,pending:null});
    messages.length=0;menuThisTurn=null;GD.draft=null;GD.lastIds=[];GD.why=null;
  }
  function isExamQuestion(t){
    return window.examFeed?.recognizes(t)&&!/장학|비교과|훈련과정|교내|응시료\s*지원/.test(t);
  }
  async function consultFirst(text,activeSession){
    const ai=window.gomAssist;
    if(!ai?.enabled?.()||state.pending||/초기화|되돌리|내\s*조건.*(?:저장|적용)|직전\s*(?:답변|질문).*다시/.test(text))return false;
    const context={...lastSearch,previousAI,focus:state.items.indexOf(state.focus)+1,titles:state.items.map(id=>findById(id)?.title||'')};
    const welfareQuestion=/복지로|중앙부처\s*복지/.test(text);
    let named=false;
    if(welfareQuestion&&window.govBenefits){
      await window.govBenefits.refresh();
      const phrase=text.replace(/\s+/g,'');
      named=window.govBenefits.items().some(n=>n.source==='복지로'&&phrase.includes(n.title.replace(/\s+/g,'')));
    }
    let plan=isExamQuestion(text)?{mode:'search',source:'exams',terms:[],city:''}:named?{mode:'search',source:'welfare',city:'',terms:[]}:await ai.consult(text,context);
    if(session!==activeSession)return true;
    if(welfareQuestion&&(!plan||plan.mode==='reply'))return false;
    if(welfareQuestion&&plan.mode==='search')plan={...plan,source:'welfare'};
    if(!plan){say('지금 AI 상담에 연결할 수 없어요. 잠시 뒤 질문을 다시 보내 주세요.');return true;}
    if(!ai.enabled()||plan.mode==='tool')return false;
    if(plan.mode==='roadmap'){
      const options=available(current()).filter(n=>!String(n.title).includes('[샘플]')&&(!plan.city||n.kind!=='event'||n.region===plan.city));
      const continuing=lastSearch.source==='roadmap';
      const terms=[...new Set([...(continuing?roadmapTerms:[]),...plan.terms])];
      const rows=terms.length?await ai.lookup({...plan,source:'all',terms},options,text):[];
      if(activeSession!==session)return true;
      try{
        const r=await fetch(feedOrigin+'/api/gom-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phase:'roadmap',question:text,ids:rows.map(n=>String(n.id)),context:{previousAI,goal:lastSearch.source==='roadmap'?roadmapGoal:''}}),signal:AbortSignal.timeout(27000)});
        const d=await r.json();
        if(activeSession!==session)return true;
        if(!r.ok||d.steps?.length!==3)throw Error();
        const msg=say('').querySelector('.gd-msg');
        const titles=['이번 달','다음 단계','활동 후'];
        const ids=[];
        for(const [i,step] of d.steps.entries()){
          const block=document.createElement('p'),label=document.createElement('strong');
          label.textContent=titles[i];block.append(label,document.createElement('br'),document.createTextNode(step.advice));msg.append(block);
          const n=rows.find(n=>String(n.id)===step.id);
          if(n){const b=document.createElement('button');b.className='gom-result';b.textContent=n.title;b.onclick=()=>showDetail(n,current());msg.append(b);ids.push(String(n.id));}
        }
        if(!ids.length){const note=document.createElement('small');note.textContent='연결할 공고를 찾지 못해 직접 해볼 활동을 제안했어요.';msg.append(note);}
        state.items=[...new Set(ids)];state.focus=null;state.pending=null;state.topic='roadmap';
        if(!continuing){roadmapGoal=text.slice(0,400);roadmapTerms=plan.terms;}
        lastSearch={source:'roadmap',city:plan.city};previousAI=d.steps.map(s=>s.advice).join(' ').slice(0,450);
      }catch{if(activeSession===session)say('지금 목표별 로드맵을 생성하지 못했어요. 잠시 뒤 다시 물어봐 주세요.');}
      return true;
    }
    if(plan.mode==='reply'){
      lastSearch={source:plan.source,city:plan.city};previousAI=plan.reply.slice(0,450);say(plan.reply);return true;
    }
    let rows;
    if(plan.mode==='follow'){
      const positions=[...new Set(plan.positions)];
      if(!positions.length)return false;
      rows=positions.map(i=>findById(state.items[i-1])).filter(Boolean);
      if(rows.length!==positions.length)return false;
      if(rows.length===1){
        state.focus=String(rows[0].id);detailThisTurn=state.focus;
        say(rows[0].title+'\n'+ai.fact(rows[0]));return true;
      }
    }else{
      lastSearch={source:plan.source,city:plan.city};
      rows=await ai.lookup(plan,available(current()),text);
    }
    if(session!==activeSession)return true;
    if(!rows.length){
      state.items=[];state.focus=null;
      const query=[plan.city,...plan.terms].filter(Boolean).join(' · ');
      say((query?'“'+query+'” 조건으로 ':'')+'현재 읽을 수 있는 목록에서 일치하는 항목을 찾지 못했어요.'+(plan.source==='exams'?' '+window.examFeed.status(text):plan.source==='training'?' '+window.work24Feed.status():['benefits','welfare'].includes(plan.source)?' '+window.govBenefits.status():''));
      return true;
    }
    state.topic=plan.mode==='follow'?'compare':plan.source;
    results('질문과 관련된 원문을 찾았어요.',rows,current(),ai.fact);
    return true;
  }
  async function respond(text){
    const activeSession=session,log=$('#gd-log'),before=log.lastElementChild;
    menuThisTurn=null;detailThisTurn=null;
    if(!window.gomAssist?.enabled()&&(/로드맵|경험.*쌓|활동.*계획/.test(text)||state.topic==='roadmap'))say('목표에 맞춘 로드맵을 만들려면 곰두리의 AI 모드를 켜 주세요.');
    else if(!await consultFirst(text,activeSession))await route(text,activeSession);
    if(session!==activeSession)return;
    const after=log.lastElementChild;
    const msg=after&&after!==before?after.querySelector('.gd-msg.bot'):null;
    const selected=detailThisTurn?[detailThisTurn]:menuThisTurn?.ids||[];
    if(msg&&selected.length&&window.gomAssist){
      await window.gomAssist.explain(text,selected,msg,()=>session===activeSession,previousAI);
      if(session===activeSession)previousAI=msg.querySelector('.gom-ground')?.textContent?.slice(0,450)||'';
    }
    if(session!==activeSession)return;
    const reply=after&&after!==before?after.querySelector('.gd-msg.bot')?.textContent:'';
    const opened=state.focus&&$('#dlg').open?findById(state.focus)?.title:'';
    messages.push({role:'user',content:text.slice(0,600)},
      {role:'assistant',content:(reply||opened||'').trim().slice(0,1400),menu:menuThisTurn});
    if(messages.length>turnLimit*2)messages.splice(0,2);
    menuThisTurn=null;
  }
  function reset(){
    session++;clearContext();$('#gd-log').replaceChildren();
  }
  window.gomConversation={state,route:respond,reportPlans,follow,showDetail,reset};
})();

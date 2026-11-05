// A compact Unigram tokenizer and quantized Model2Vec encoder for Korean notice retrieval.
globalThis.createGomSearch = function createGomSearch(model) {
  const {dim,tokens,scores} = model;
  const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const vectors = new Int8Array(bytes(model.vectors).buffer);
  const scales = new Float32Array(bytes(model.scales).buffer);
  const ids = new Map(tokens.map((token,id)=>[token,id]));
  const maxToken = Math.max(...tokens.map(t=>t.length));
  const cache = new Map();
  function encode(text) {
    const key = String(text||'').normalize('NFKC').toLowerCase().slice(0,650);
    if (cache.has(key)) return cache.get(key);
    const out = new Float32Array(dim);
    for (const word of key.match(/[가-힣a-z0-9]+/g)||[]) {
      const str='▁'+word, len=str.length;
      const best = new Float64Array(len+1).fill(-Infinity);best[0]=0;
      const from = new Int32Array(len+1), row = new Int32Array(len+1).fill(-1);
      for(let i=0;i<len;i++){
        if(best[i]-22>best[i+1]){best[i+1]=best[i]-22;from[i+1]=i;row[i+1]=-1;}
        for(let j=i+1;j<=Math.min(len,i+maxToken);j++){
          const id=ids.get(str.slice(i,j));
          if(id===undefined)continue;
          const score=best[i]+scores[id];
          if(score>best[j]){best[j]=score;from[j]=i;row[j]=id;}
        }
      }
      for(let j=len;j>0;j=from[j]){
        const id=row[j];if(id<0||tokens[id]==='▁')continue;
        const base=id*dim, scale=scales[id];
        for(let k=0;k<dim;k++)out[k]+=vectors[base+k]*scale;
      }
    }
    const length=Math.hypot(...out);
    if(length)for(let i=0;i<dim;i++)out[i]/=length;
    if(cache.size>=2048)cache.delete(cache.keys().next().value);
    cache.set(key,out);return out;
  }
  function cosine(a,b){let n=0;for(let k=0;k<dim;k++)n+=a[k]*b[k];return n;}
  const topics = [
    ['housing','주거비 월세 기숙사비 주택 임대료 자취방 방값 집세 주거 장학금','주거|월세|집세|기숙사비|임차료|방값|임대료'],
    ['living','생활비 생활비성 식비 교재비 경제적 부담 생계비 생활 지원 장학금','생활비|생활비성|생활지원|식비|생계비|교재비'],
    ['tuition','등록금 학비 수업료 학자금 장학금 대학 학비 부담','등록금|학비|수업료|학자금'],
    ['work','취업 구직 채용 이력서 면접 인턴 일자리 직장 경력 포트폴리오','취업|구직|채용|면접|이력서|인턴|일자리|직무|포트폴리오'],
    ['startup','창업 사업 아이디어 회사 설립 사업자 예비 창업가 창업 교육 사업화','창업|사업화|스타트업|사업자등록'],
    ['coding','프로그래밍 파이썬 소프트웨어 앱 개발 코딩 프로그래머 해커톤 인공지능','프로그래밍|파이썬|소프트웨어|코딩|해커톤|인공지능|데이터 분석|python|앱 개발'],
    ['global','교환학생 해외 연수 외국 유학 국제 교류 외국어 어학','교환학생|해외|유학|국제교류|어학|외국어'],
    ['culture','공연 축제 전시 음악 미술 문화 나들이 가족과 주말에 놀러 갈 곳','공연|축제|전시|연주|음악회|박물관|문화행사']
  ].map(([id,words,pattern])=>({id,words,pattern:new RegExp(pattern,'i'),vec:encode(words)}));
  function analyze(question){
    const text=String(question).replace(/(찾아|알려|보여|추천)(?:해|줄|주|줘|주세요|줘요)*|(?:혹시|어디|있을까|있어|있나요|할 수 있는|받을 수 있는|같은 거)/g,' ').trim();
    const vec=encode(text);
    const suggested=topics.map(topic=>({topic,score:cosine(vec,topic.vec)+(topic.pattern.test(text)?0.34:0)})).sort((a,b)=>b.score-a.score);
    return {text,vec,topic:suggested[0].score>=0.44?suggested[0].topic:null,confidence:suggested[0].score};
  }
  function rank(query,rows,limit=4){
    const words=(query.text.toLowerCase().match(/[가-힣a-z0-9]{2,}/g)||[]).map(w=>w.replace(/(?:에서|으로|하고|에는|이나|까지|적인|에게|하는|이랑|은|는|을|를|에|가|이)$/,'')).filter(w=>w.length>1);
    const hits=[];
    for(const row of rows){
      const facts=[row.title,row.category,row.summary,row.snippet,row.aidType,row.eligibility].filter(Boolean).join(' ').slice(0,480);
      const full=facts+' '+String(row.body||'').slice(0,1600);
      const matched=words.filter(w=>facts.toLowerCase().includes(w)).length;
      const anchor=query.topic?.pattern.test(full);
      const semantic=cosine(query.vec,encode(facts));
      if(query.topic&&!anchor)continue;
      if(!anchor&&!matched&&semantic<0.58)continue;
      const score=semantic+Math.min(0.36,matched*0.12)+(anchor?0.20:0)+(query.topic?.pattern.test(row.title)?0.12:0);
      hits.push({row,score});
    }
    return hits.sort((a,b)=>b.score-a.score||String(a.row.deadline||'9999').localeCompare(String(b.row.deadline||'9999'))).slice(0,limit).map(h=>h.row);
  }
  return {analyze,rank,encode,cosine};
};

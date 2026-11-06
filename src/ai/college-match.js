// Topic relevance is independent of the eligibility rules in judge().
globalThis.createCollegeMatcher=function createCollegeMatcher(encoder){
  const topics={
    '인문·사회':['사회조사 주민 인터뷰 지역사회 정책 제안 사회문제 해결','글쓰기 문학 역사 철학 번역 언어 인문학','경영 경제학 행정학 사회복지 외교 법률 언론 미디어리터러시 기자단 취재 글쓰기 인권 교육정책'],
    '자연과학':['기초과학 수학 수리모형 물리학 화학 실험 천문학','생물학 생태계 생명과학 환경과학 지구과학 기후변화 생물다양성'],
    '공학·IT':['인공지능 소프트웨어 프로그래밍 코딩 정보보안 데이터 분석 알고리즘 해커톤','기계설계 전기전자 로봇 반도체 스마트도시 건축공학 에너지공학 디지털 기술개발'],
    '보건·의료':['보건의료 간호 임상 환자 건강증진 공중보건 감염병 예방','의학 약학 재활 치료 응급처치 헬스케어 정신건강 의약품 보건교육 건강관리 환자교육'],
    '예술·체육':['미술 디자인 웹툰 사진 촬영 영상 제작 애니메이션 포스터 일러스트 캐릭터','음악 공연 무용 연극 예술 문예창작 체육 스포츠 걷기대회 육상 운동 경기']
  };
  const stop=/^(?:사업|개요|수상|시상|모집|참가|접수|공고|공모전|안내|활동|교육|프로젝트|아이디어|신청|대학생|대학|분야|전국|지역문제|해결|문제|제작|온라인|주민|제안|분석|데이터|디지털|실험|예방|경기|운동|제작|창작|대상|202\d년?)$/;
  const norm=s=>s.toLowerCase().replace(/\s/g,'');
  const specs=Object.entries(topics).map(([name,groups])=>({name,
    vecs:groups.map(g=>encoder.encode(g)),
    terms:[...new Set(groups.flatMap(g=>g.split(' ').filter(t=>t.length>=2&&!stop.test(t))))]}));
  const cache=new Map();
  const universal=['공모전','참가자 모집','대상자 모집','학부생','대학생','신청 안내','프로젝트 아이디어','활동 안내'].map(t=>encoder.encode(t));
  function classify(n){
    const text=[n.title,n.body||n.snippet,n.description,...(n.scan||[]).flatMap(x=>x.lines||[])].filter(Boolean).join('\n').slice(0,4400);
    const prior=cache.get(n.id);
    if(prior?.text===text)return prior.matches;
    const matches={};
    const seen=new Set();
    for(const line of text.split(/[\n。!?]+|(?<=다)\.\s+|[;|]/)){
      // Work with short original excerpts so the displayed evidence can be checked.
      const words=line.trim().split(/\s+/);
      for(let i=0;i<words.length;i+=13){
        const quote=words.slice(i,i+15).join(' ').slice(0,115);
        if(quote.length<3||seen.has(quote)||/문의처|담당자|이메일|URL|https?:|개인정보|유의사항|제출처|파일명|제출서류|붙임\s*\d|포스터\s*(참조|참고|확인)|첨부.{0,6}포스터/i.test(quote))continue;
        seen.add(quote);
        const content=quote.replace(/[가-힣]*(?:진흥원|개발원|위원회|재단|진흥공단|관광부|안전부|복지부|협회|공사|연구원)(?=\s|[은는이가의,·\]])/g,' ').replace(/교수학습|특수학급|이수학점/g,' ');
        if(/(?:홈페이지|로그인|메뉴)\s*→/.test(content))continue;
        const phrase=norm(content);
        const vec=encoder.encode(content);
        const baseline=Math.max(...universal.map(v=>encoder.cosine(vec,v)));
        const scores=specs.map(s=>{
          const direct=s.terms.filter(t=>phrase.includes(t)).length;
          const similarity=Math.max(...s.vecs.map(v=>encoder.cosine(vec,v)));
          return {name:s.name,direct,similarity};
        });
        for(const s of scores){
          const rival=Math.max(...scores.filter(x=>x!==s).map(x=>x.similarity));
          if(!s.direct&&(s.similarity<0.72||s.similarity-rival<0.13||s.similarity-baseline<0.16))continue;
          const score=Math.min(3,s.direct)*0.26+s.similarity+(i===0&&line===n.title?0.16:0);
          if(!matches[s.name]||score>matches[s.name].score)matches[s.name]={score,quote};
        }
      }
    }
    if(cache.size>=6000)cache.delete(cache.keys().next().value);
    cache.set(n.id,{text,matches});
    return matches;
  }
  return classify;
};

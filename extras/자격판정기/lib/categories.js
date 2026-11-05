// 종류 분류 기준 (화면·빌드 공통). 사람이 검토한 data/categories.json이 먼저이고, 검토 전 새 글은 이 규칙으로 나눈다.
// 종류: 장학금(장학·지원금) / 공모전 / 대외활동(서포터즈·기자단·인턴·참가팀·채용) / 봉사 / 비교과(교육·행사) / 공지(학사·생활) / 지역행사
export const LABELS = { 장학금: '장학·지원금', 공모전: '공모전', 대외활동: '대외활동·인턴', 봉사: '봉사', 비교과: '교육·행사', 공지: '학사·생활', 지역행사: '지역 행사' };

const RULES = [
  // 모집이 아닌 안내(결과·일정 변경·행정 서류)는 학사·생활
  ['공지', /결과\s*발표|일정\s*변경|시상식|서약서|지급\s*요청서|지급\s*일정|제출\s*안내|계절\s*수업|학점\s*교류|수강\s*신청|전과|복수\s*전공|부전공|졸업|휴학|복학|예비군|학위|안전\s*수칙|리모델링|운영\s*시간|후원의\s*집/],
  ['봉사', /자원\s*봉사|봉사\s*활동|봉사단|봉사자|나눔\s*행사/],
  ['대외활동', /서포터즈|기자단|홍보\s*대사|인턴|참가\s*팀\s*모집|입주\s*(작가|기업)|채용|장교\s*모집|양성\s*과정\s*\d*기?\s*모집/],
  ['공모전', /공모전|경진\s*대회|해커톤|아이디어\s*공모|디자인\s*공모|공모$|(?<!학술\s?)대회|챌린지|콘테스트|백일장|문학상|문예\s*대전|작품\s*공모|원고\s*모집|드래프톤/],
  ['장학금', /장학|등록금\s*(지원|반값)|학업\s*지원금|생활비\s*지원|월세\s*지원|교육비\s*지원|근로\s*(장학)?/],
  ['비교과', /특강|교육|캠프|세미나|포럼|심포지엄|학술\s*대회|아카데미|프로그램|행사|축제|체험|워크숍|연수|강연|부트캠프|박람회|관람/]
];
// 제목으로 종류를 정한다. 아무 규칙에도 안 맞으면 원래 종류 유지.
export function classify(n) {
  if (n.kind === 'event') return '지역행사';
  const t = String(n.title || '');
  for (const [type, re] of RULES) if (re.test(t)) return type;
  return n.type || '공지';
}
// 검토 파일을 먼저, 없으면 규칙. hide(중복·광고)는 목록에서 뺀다.
export function applyCategories(list, reviewed = {}) {
  const out = [];
  let byReview = 0, byRule = 0, hidden = 0;
  for (const n of list) {
    const r = reviewed[n.id];
    if (r?.hide) { hidden++; continue; }
    if (r) { n.type = r.type; n.tags = r.tags; if (r.why) n.categoryWhy = r.why; byReview++; }
    // 외부 사이트 글은 그 사이트의 목록 구분(공모전/대외활동)을 믿고, 공모전 목록에 섞인 대외활동·봉사·교육만 규칙으로 옮긴다
    else if (n.kind !== 'event') { const t = classify(n); if (t !== n.type && (n.kind !== 'contest' || (n.type === '공모전' && ['대외활동', '봉사', '비교과'].includes(t)))) { n.type = t; byRule++; } }
    out.push(n);
  }
  return { list: out, byReview, byRule, hidden };
}

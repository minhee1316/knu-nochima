// 곰두리 규칙 해석·도구 함수 확인
import assert from 'node:assert/strict';
import { parseLocal, cleanPatch, searchNotices, makePlan, draftInquiry, digest, replyLocal } from './gomduri.js';
import { cleanContents } from '../api/chat.js';

// 1) 자기소개 → 내 조건 저장 (허용값만)
assert.deepEqual(parseLocal('저는 삼척 3학년이고 자취해요'), [{ name: 'update_profile', args: { campus: '삼척', grade: '3', residence: '자취' } }]);
assert.deepEqual(cleanPatch({ campus: '원주', grade: '5', gpa: 9, income: 3, interests: ['창업', '해킹'] }), { income: '3', interests: ['창업'] });
// 2) 찾기: 종류·기간·지원 가능만
assert.deepEqual(parseLocal('이번 주 내가 받을 수 있는 장학금 찾아줘'), [{ name: 'search_notices', args: { type: '장학금', days: 7, eligible_only: true } }]);
assert.deepEqual(parseLocal('주민인데 볼 만한 축제 있어?'), [{ name: 'search_notices', args: { type: '지역행사', public_only: true } }]);
// 3) 직전 목록의 n번 → 할 일 / 문의
assert.deepEqual(parseLocal('2번 할 일 만들어줘', ['a', 'b']), [{ name: 'create_plan', args: { id: 'b' } }]);
assert.deepEqual(parseLocal('이거 담당자한테 문의 메일 써줘', ['a']), [{ name: 'draft_inquiry', args: { id: 'a' } }]);
assert.deepEqual(parseLocal('할 일 목록 보여줘'), [{ name: 'get_plans', args: {} }]);
assert.deepEqual(parseLocal('이번 주 정리해줘'), [{ name: 'weekly_digest', args: { days: 7 } }]);
assert.deepEqual(parseLocal('ㅁㄴㅇㄹ'), []);

// 4) 검색은 판정이 끝난 목록에서: 해당 없음·마감 지난 것 제외, 마감 빠른 순
const L = [
  { id: 1, title: 'A 장학금', type: '장학금', left: 5, s: 'warn', reasons: [['unknown', '학년: 원문 확인 필요']] },
  { id: 2, title: 'B 장학금', type: '장학금', left: 2, s: 'ok', reasons: [] },
  { id: 3, title: 'C 장학금', type: '장학금', left: 1, s: 'no', reasons: [] },
  { id: 4, title: 'D 장학금', type: '장학금', left: -1, s: 'ok', reasons: [] },
  { id: 5, title: '축제', type: '지역행사', kind: 'event', left: 3, s: 'ok', reasons: [], publicOk: true }
];
assert.deepEqual(searchNotices(L, { type: '장학금' }).items.map(n => n.id), ['2', '1']);
assert.deepEqual(searchNotices(L, { eligible_only: true }).items.map(n => n.id), ['2', '5']);
assert.deepEqual(searchNotices(L, { public_only: true }).items.map(n => n.id), ['5']);
assert.equal(searchNotices(L, { type: '장학금' }).items[1].why[0], '학년: 원문 확인 필요');

// 5) 할 일: 불명확 조건 → 서류 → 신청 → 마감 2일 전 → 접수 확인
const n = { id: 9, title: 'X 장학', deadline: '2026-11-20', docs: ['신청서'], reasons: [['unknown', '학년: 원문 확인 필요']], org: '학생과', phone: '033-1' };
assert.deepEqual(makePlan(n, '학과 사무실 제출').steps.map(s => s.t), ['자격 확인: 학년: 원문 확인 필요', '서류 준비: 신청서', '신청: 학과 사무실 제출', '늦어도 2026-11-18까지 준비 끝내기 (마감 2026-11-20)', '제출 후 접수 확인하기 (학생과 033-1)']);
// 6) 문의 초안: 이름·학번은 넣지 않음, 불명확 조건으로 질문
const d = draftInquiry(n, '', { campus: '삼척', grade: '3' });
assert.match(d.body, /학년 기준/); assert.match(d.body, /이름·학번은 직접/); assert.match(d.body, /삼척캠퍼스 3학년/);
assert.equal(digest(L, 7).ok, 1);
assert.match(replyLocal([]), /곰두리/);

// 7) 서버 입력 검증: 모르는 도구·역할·첫 턴이 model이면 거절
assert.ok(cleanContents([{ role: 'user', parts: [{ text: '안녕' }] }]));
assert.equal(cleanContents([{ role: 'model', parts: [{ text: 'x' }] }]), null);
assert.equal(cleanContents([{ role: 'user', parts: [{ text: 'a' }] }, { role: 'model', parts: [{ functionCall: { name: 'rm_rf', args: {} } }] }]), null);
assert.equal(cleanContents([{ role: 'system', parts: [{ text: 'a' }] }]), null);
console.log('gomduri ok');

// 8) 공식 페이지 바로가기
import { campusLink } from './gomduri.js';
assert.deepEqual(parseLocal('삼척 학식 메뉴 보여줘'), [{ name: 'campus_link', args: { topic: '식단', campus: '삼척' } }]);
assert.match(campusLink({ topic: '식단' }, { campus: '삼척' }).url, /extn\/337/);
assert.deepEqual(campusLink({ topic: '맞춤장학' }, { campus: '춘천', grade: '2', income: '3', gpa: '' }).fill, ['캠퍼스 춘천', '학년 2', '학자금 지원구간 3구간']);
assert.ok(campusLink({ topic: '주차' }).error);
console.log('gomduri links ok');

// 9) 모델이 준 "3학년"·"삼척캠퍼스"도 허용값으로, 결과 없으면 넓혀 찾기
import { searchSmart } from './gomduri.js';
assert.deepEqual(cleanPatch({ campus: '삼척캠퍼스', grade: '3학년', residence: '원룸' }), { campus: '삼척', grade: '3' });
const sm = searchSmart(L, { type: '장학금', days: 1, eligible_only: true });
assert.deepEqual([sm.items.map(n => n.id), sm.relaxed], [['2', '1'], ['확인 필요까지 포함', '기간을 30일로 넓힘']]);
console.log('gomduri smart ok');
assert.deepEqual(parseLocal('나 삼척 3학년이고 자취해')[0].args, { campus: '삼척', grade: '3', residence: '자취' });
assert.deepEqual(parseLocal('삼척 학식 어디서 봐?'), [{ name: 'campus_link', args: { topic: '식단', campus: '삼척' } }]);
console.log('gomduri intro ok');

// 10) 공지 Q&A·자소서·만약에·로드맵
import { noticeQA, applicationOutline, compareWhatIf, roadmap } from './gomduri.js';
assert.deepEqual(parseLocal('1번 휴학생도 돼?', ['a']), [{ name: 'ask_notice', args: { id: 'a', question: '1번 휴학생도 돼?' } }]);
assert.deepEqual(parseLocal('1번 자소서 도와줘', ['a']), [{ name: 'draft_application', args: { id: 'a', about: '' } }]);
assert.deepEqual(parseLocal('평점 3.8이면?'), [{ name: 'what_if', args: { gpa: '3.8' } }]);
assert.deepEqual(parseLocal('한 달 계획 세워줘'), [{ name: 'make_roadmap', args: { weeks: 4 } }]);
const qa = noticeQA({ id: 1, title: 'T', body: '1. 지원대상: 재학생 및 휴학생(2026-2학기 기준)\n2. 제출서류: 신청서, 성적증명서\n3. 문의: 학생과' }, '휴학생도 돼?');
assert.deepEqual(qa.evidence, ['1. 지원대상: 재학생 및 휴학생(2026-2학기 기준)']);
assert.equal(noticeQA({ id: 2, title: 'T', body: '', imageOnly: true }, '서류?').evidence.length, 0);
const ao = applicationOutline({ id: 3, title: '희망 장학금', type: '장학금' }, '', { campus: '삼척', grade: '3' });
assert.match(ao.text, /삼척캠퍼스 3학년/); assert.match(ao.text, /\[학업·활동에서 노력한 경험\]/); assert.equal(ao.kind, '자기소개서');
const B = [{ id: 1, title: 'a', s: 'warn', left: 3 }, { id: 2, title: 'b', s: 'ok', left: 4 }], A = [{ id: 1, title: 'a', s: 'ok', left: 3 }, { id: 2, title: 'b', s: 'ok', left: 4 }];
assert.deepEqual([compareWhatIf(B, A, ['평점 3.8']).okBefore, compareWhatIf(B, A, ['평점 3.8']).okAfter, compareWhatIf(B, A, []).gainedTotal], [1, 2, 1]);
assert.deepEqual(roadmap([{ id: 1, title: 'x', s: 'ok', left: 2 }, { id: 2, title: 'y', s: 'warn', left: 9 }, { id: 3, title: 'z', s: 'no', left: 1 }], 2).plan.map(w => [w.label, w.items.length]), [['이번 주', 1], ['2주 뒤', 1]]);
console.log('gomduri extra ok');

// 11) 상담관 모드
import { extractProfile, recommend, counselReport } from './gomduri.js';
const ex = extractProfile('삼척 3학년 경영학과, 평점 3.6, 자취. 창업 동아리 활동했고 데이터 분석 진로 희망');
assert.deepEqual(ex.patch, { campus: '삼척', grade: '3', residence: '자취', gpa: 3.6, college: '인문·사회' });
assert.ok(ex.tags.includes('창업') && ex.tags.includes('AI·SW'));
assert.ok(ex.keywords.includes('경영학') && ex.keywords.includes('데이터') && !ex.keywords.includes('활동'));
assert.deepEqual(parseLocal('이 학생 상담 중인데 삼척 3학년 경영학과야'), [{ name: 'counsel_student', args: { memo: '이 학생 상담 중인데 삼척 3학년 경영학과야' } }]);
const J = [
  { id: 1, title: '창업 경진대회', type: '공모전', tags: ['창업'], left: 10, s: 'warn', reasons: [['unknown', '학년: 원문 확인 필요']], body: '참가 대상: 창업에 관심 있는 재학생' },
  { id: 2, title: '일반 장학금', type: '장학금', tags: [], left: 3, s: 'ok', reasons: [], amount: 1000000 },
  { id: 3, title: '간호 실습', type: '비교과', tags: [], left: 2, s: 'no', reasons: [] },
  { id: 4, title: '축제', kind: 'event', type: '지역행사', left: 1, s: 'ok', reasons: [] }
];
const rec = recommend(J, { tags: ['창업'], keywords: ['경진대회'] });
assert.deepEqual(rec.map(x => x.id), ['1', '2']);
assert.match(rec[0].why.join(), /관심 분야 창업 일치/); assert.equal(rec[0].evidence, '참가 대상: 창업에 관심 있는 재학생'); assert.deepEqual(rec[0].check, ['학년: 원문 확인 필요']);
const rep = counselReport({ campus: '삼척', grade: '3', interests: ['창업'] }, rec, '2026-11-05', { checked: 3 });
assert.match(rep, /상담 기록지/); assert.match(rep, /삼척캠퍼스 · 3학년/); assert.match(rep, /공지 근거: "참가 대상/); assert.doesNotMatch(rep, /학번:/);
console.log('gomduri counsel ok');

// 12) 혜택 태그(글에 적힌 것만)·상담 종류 가산
import { perksOf } from './gomduri.js';
assert.deepEqual(perksOf({ title: '독서후기 대회', body: '참여자에게 비교과 마일리지 10점을 부여합니다.' }), [{ k: '마일리지', ev: '참여자에게 비교과 마일리지 10점을 부여합니다.' }]);
assert.deepEqual(perksOf({ title: '춘천 축제', body: '누구나 즐기는 축제' }), []);
assert.deepEqual(parseLocal('마일리지 받을 수 있는 활동 찾아줘'), [{ name: 'search_notices', args: { eligible_only: true, perk: '마일리지' } }]);
assert.deepEqual(searchNotices([{ id: 1, title: 'a', left: 1, s: 'warn', perks: [{ k: '마일리지' }] }, { id: 2, title: 'b', left: 1, s: 'warn' }], { perk: '마일리지' }).items.map(n => n.id), ['1']);
assert.deepEqual(extractProfile('공모전이나 비교과 위주 추천').types, ['공모전', '비교과']);
const rt = recommend([{ id: 1, title: 'x 장학', type: '장학금', left: 3, s: 'ok', reasons: [] }, { id: 2, title: 'y 대회', type: '공모전', left: 5, s: 'warn', reasons: [] }], { types: ['공모전'] });
assert.equal(rt[0].id, '2'); assert.match(rt[0].why.join(), /요청한 종류\(공모전\)/);
console.log('gomduri perks ok');

// 13) 리뷰에서 찾은 오작동 회귀 방지
assert.deepEqual(parseLocal('1번 평점 3.5면 돼?', ['a']).map(c => c.name), ['ask_notice']); // 가정은 저장하지 않음
assert.ok(!parseLocal('심리 상담 프로그램 찾아줘').some(c => c.name === 'counsel_student'));
assert.deepEqual(parseLocal('13번 공지 열어줘', ['a', 'b', 'c']), []);
assert.equal(parseLocal('나 4.2학점이야')[0].args.gpa, '4.2');
assert.ok(!parseLocal('라면 축제 있어?').some(c => c.name === 'what_if'));
assert.deepEqual(makePlan({ id: 1, title: 't', deadline: '11월 20일', reasons: [] }).steps.length, 3);
console.log('gomduri regressions ok');

// 14) 학사 정보·수강 과목 읽기, 첨부 판독 근거
const ex2 = extractProfile('삼척 2학년 공학계열 재학생, 파이썬 A+, 통계학 B+. 직전 평점 3.3, 누적 평점 3.4, 직전 이수학점 18');
assert.equal(ex2.patch.cumulativeGpa, 3.4); assert.equal(ex2.patch.lastCredits, 18); assert.equal(ex2.patch.academic, '재학');
assert.ok(ex2.keywords.includes('파이썬') && ex2.tags.includes('AI·SW'));
assert.deepEqual(cleanPatch({ lastCredits: 18, cumulativeGpa: 9, academic: '재학', program: '박사' }), { lastCredits: '18', academic: '재학' });
const qa2 = noticeQA({ id: 7, title: 'T', body: '안내합니다', scan: [{ method: '문서 텍스트', lines: ['신청자격: 직전학기 이수학점 12학점 이상 재학생'] }] }, '이수학점 몇 학점이야?');
assert.match(qa2.evidence[0], /^\[첨부 문서 텍스트\] 신청자격/);
console.log('gomduri port ok');

// 멘토 피드백: '대학원 진학 희망' 학부생을 대학원생으로 보지 않고, 연구·학술 관심으로 추천
{
  const { extractProfile: ep } = await import('./gomduri.js');
  const a = ep('춘천 3학년 생명과학과, 평점 4.0, 대학원 진학 희망');
  if (a.patch.program === '대학원') throw new Error('대학원 진학 희망 → program 대학원 오판');
  if (!a.tags.includes('연구·학술') || !a.keywords.includes('대학원')) throw new Error('대학원 진학 → 연구·학술/키워드 누락');
  if (ep('대학원생 석사과정 2학기').patch.program !== '대학원') throw new Error('대학원생 인식 실패');
  console.log('gomduri grad ok');
}

// 멘토 피드백: '봉사활동 찾아줘'가 봉사 공지를 찾아야 함 (엉뚱한 공지로 넘어가지 않게)
{
  const { searchSmart, parseLocal } = await import('./gomduri.js');
  const L = [{ id: 'a', title: '자원봉사자 모집', type: '공지', tags: ['봉사'], s: 'warn', left: 3 }, { id: 'b', title: 'AI 서비스 개발 교육', type: '비교과', tags: ['AI·SW'], s: 'ok', left: 0 }];
  const c = parseLocal('삼척인데 봉사활동 찾아줘', []).find(x => x.name === 'search_notices');
  const r = searchSmart(L, c.args);
  if (r.items[0]?.id !== 'a' || r.applied.type !== '봉사' || r.items.some(x => x.id === 'b')) throw new Error('봉사 검색 실패: ' + JSON.stringify(r));
  console.log('gomduri volunteer ok');
}

// OpenAI(ChatGPT) 변환: 도구 스키마 소문자, 호출 id 짝, 답장 되돌리기
{
  const { toOpenAITools, toOpenAIMessages, fromOpenAIMessage, TOOL_DECLS: TD } = await import('./gomduri.js');
  const tools = toOpenAITools(TD);
  if (tools.length !== TD.length || JSON.stringify(tools).match(/"type":"(OBJECT|STRING|ARRAY|NUMBER|INTEGER|BOOLEAN)"/)) throw new Error('도구 스키마 변환 실패');
  if (tools[0].function.parameters.type !== 'object') throw new Error('parameters는 object여야 함');
  const msgs = toOpenAIMessages('SYS', [
    { role: 'user', parts: [{ text: '나 삼척 3학년' }, { text: '(화면 상태)' }] },
    { role: 'model', parts: [{ functionCall: { name: 'update_profile', args: { campus: '삼척' } } }] },
    { role: 'user', parts: [{ functionResponse: { name: 'update_profile', response: { ok: 1 } } }] },
    { role: 'model', parts: [{ text: '저장했어요' }] }]);
  const call = msgs[2].tool_calls[0];
  if (msgs[0].role !== 'system' || msgs[1].content !== '나 삼척 3학년\n(화면 상태)' || msgs[3].role !== 'tool' || msgs[3].tool_call_id !== call.id || msgs[4].content !== '저장했어요') throw new Error('대화 변환 실패: ' + JSON.stringify(msgs));
  const names = new Set(TD.map(x => x.name));
  const parts = fromOpenAIMessage({ content: null, tool_calls: [{ id: 'call_x', type: 'function', function: { name: 'search_notices', arguments: '{"query":"봉사"}' } }, { id: 'bad', type: 'function', function: { name: 'rm_rf', arguments: '{}' } }] }, names);
  if (parts.length !== 1 || parts[0].functionCall.args.query !== '봉사' || parts[0].functionCall.id !== 'call_x') throw new Error('답장 변환 실패');
  console.log('gomduri openai ok');
}

// 취업 상담: 직무 말 → 태그·키워드, 학교 프로그램/인턴/대외활동/공모전 묶음, 학년 체크리스트, 규칙 모드 연결
{
  const { careerPlan, parseLocal, CAREER_LINKS } = await import('./gomduri.js');
  const J = [
    { id: 's1', title: '2026학년도 학생주도형 취업 역량 강화 프로그램 모집', type: '비교과', tags: ['취업·진로'], s: 'ok', left: 5 },
    { id: 'i1', kind: 'contest', title: '[아토머스] 기획팀 콘텐츠 마케팅 인턴', type: '대외활동', tags: ['취업·진로'], s: 'warn', left: 30 },
    { id: 'i2', kind: 'contest', title: '[세방] 채용연계형 인턴 채용', type: '대외활동', tags: ['취업·진로'], s: 'warn', left: 9 },
    { id: 'a1', kind: 'contest', title: '브랜드 마케팅 서포터즈 모집', type: '대외활동', tags: [], s: 'warn', left: 10 },
    { id: 'a2', kind: 'contest', title: '청소년센터 운영 모니터링단', type: '대외활동', tags: [], s: 'warn', left: 10 },
    { id: 'c1', kind: 'contest', title: 'AI 광고 마케팅 공모전', type: '공모전', tags: ['문화·예술'], s: 'warn', left: 20 },
    { id: 'c2', kind: 'contest', title: '수목원 숏폼 공모전', type: '공모전', tags: [], s: 'warn', left: 20 },
    { id: 'x', title: '지난 취업 특강', type: '비교과', tags: ['취업·진로'], s: 'ok', left: -1 }];
  const r = careerPlan(J, { grade: '3', job: '마케팅' });
  const g = Object.fromEntries(r.groups.map(x => [x.key, x.items.map(i => i.id)]));
  if (g.school[0] !== 's1' || g.school.includes('x')) throw new Error('학교 프로그램 ' + JSON.stringify(g));
  if (g.intern[0] !== 'i1' || !g.intern.includes('i2')) throw new Error('인턴: 직무 일치 먼저 ' + JSON.stringify(g));
  if (g.activity.join() !== 'a1' || g.contest.join() !== 'c1') throw new Error('직무와 무관한 대외활동·공모전은 빼야 함 ' + JSON.stringify(g));
  if (r.steps[0] !== '직무 경험 만들기(인턴·현장실습·프로젝트)' || !r.note.includes('일반적인') || r.links !== CAREER_LINKS) throw new Error('체크리스트·링크');
  const c = parseLocal('나 3학년인데 마케팅 직무 취업 준비 뭐부터 해?')[0];
  if (c.name !== 'career_counsel' || c.args.grade !== '3' || c.args.job !== '마케팅') throw new Error('규칙 모드 연결 ' + JSON.stringify(c));
  console.log('gomduri career ok');
}

// 첫 인사 예시 문장: 파이썬 → AI로 찾고, '배웠어'는 검색어에서 뺌
{
  const { parseLocal } = await import('./gomduri.js');
  const c = parseLocal('삼척 2학년이고 파이썬을 배웠어. 나에게 맞는 공모전 있어?', []).find(x => x.name === 'search_notices');
  if (c.args.type !== '공모전' || c.args.query !== 'AI') throw new Error('예시 문장 검색 ' + JSON.stringify(c));
  console.log('gomduri greeting ok');
}


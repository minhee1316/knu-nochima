// 정부·기관 API 정규화 테스트 (필드명: 한국장학재단은 공식 swagger, 나머지는 연동 가이드 기준)
import assert from 'node:assert/strict';
import { fromKosaf, fromGov24, fromKstartup, fromYouth, fromFestival, rows, fileDate } from './gov.mjs';
const T = '2026-11-06';

const k = fromKosaf({ 번호: 7, 운영기관명: '강원인재육성재단', 운영기관구분: '지자체', 상품명: '강원 인재 장학금', 학년구분: '대학2학년,대학3학년', '성적기준 상세내용': '직전학기 평점평균 3.0점 이상',
  '소득기준 상세내용': '학자금 지원구간 8구간 이하', '지역거주여부 상세내용': '강원특별자치도 거주', '지원내역 상세내용': '200만원', '제출서류 상세내용': '재학증명서, 성적증명서', 모집시작일: '2026-11-01', 모집종료일: '2026-11-20', '홈페이지 주소': 'https://example.or.kr' }, T);
assert.equal(k.kind, 'gov'); assert.equal(k.type, '장학금'); assert.equal(k.region, '강원'); assert.equal(k.deadline, '2026-11-20');
assert.deepEqual(k.cond.grade, ['2', '3']); assert.match(k.body, /평점평균 3\.0점 이상/); assert.deepEqual(k.docs, ['재학증명서', '성적증명서']);
assert.equal(fromKosaf({ 운영기관구분: '대학교', 운영기관명: '○○대학교', 상품명: 'x', 모집종료일: '2026-12-01' }, T), null, '다른 대학 자체 장학 제외');
assert.equal(fromKosaf({ 상품명: 'x', '지역거주여부 상세내용': '서울특별시 거주자', 모집종료일: '2026-12-01' }, T), null, '다른 지역 거주자 전용 제외');
assert.equal(fromKosaf({ 상품명: 'x', 모집종료일: '2026-10-01' }, T), null, '모집 끝남 제외');

const g = fromGov24({ 서비스ID: 'A1', 서비스명: '삼척시 대학생 생활비 지원', 소관기관명: '강원특별자치도 삼척시', 지원대상: '삼척시 거주 대학생', 지원내용: '학기당 50만원', 신청기한: '2026.11.01 ~ 2026.11.30', 서비스분야: '교육', 상세조회URL: 'https://www.gov.kr/x' });
assert.equal(g.region, '삼척'); assert.equal(g.deadline, '2026-11-30'); assert.equal(g.type, '장학금');
assert.equal(fromGov24({ 서비스ID: 'A2', 서비스명: '청년 월세', 소관기관명: '서울특별시 강남구', 지원대상: '청년' }), null, '다른 시·도 제외');
assert.equal(fromGov24({ 서비스ID: 'A3', 서비스명: '청년 월세', 소관기관명: '경상남도 김해시', 지원대상: '청년' }), null);
assert.equal(fromGov24({ 서비스ID: 'A4', 서비스명: '노인 돌봄', 소관기관명: '보건복지부', 지원대상: '65세 이상' }), null, '학생·청년 대상 아님');
assert.equal(fromGov24({ 서비스ID: 'A5', 서비스명: '청년 월세 한시 특별지원', 소관기관명: '국토교통부', 지원대상: '19~34세 청년', 서비스분야: '주거·자립' }).region, '전국');

assert.equal(fromKstartup({ biz_pbanc_nm: '2026 대학생 창업 경진대회', pbanc_rcpt_end_dt: '20261130', supt_regin: '전국', rcrt_prgs_yn: 'Y', detl_pg_url: 'https://k' }, T).type, '공모전');
assert.equal(fromKstartup({ biz_pbanc_nm: '초기창업패키지 지원사업', pbanc_rcpt_end_dt: '20261130' }, T), null, '경진·공모 아님');
assert.equal(fromKstartup({ biz_pbanc_nm: '창업 경진대회', pbanc_rcpt_end_dt: '20261130', supt_regin: '부산' }, T), null);

const y = fromYouth({ plcyNo: 'P1', plcyNm: '춘천시 청년 월세 지원', lclsfNm: '주거', sprvsnInstCdNm: '강원특별자치도 춘천시', aplyYmd: '20261101 ~ 20261215', aplyPrdSeCd: '0057001', plcySprtCn: '월 20만원',
  sprtTrgtAgeLmtYn: 'Y', sprtTrgtMinAge: '19', sprtTrgtMaxAge: '34', sbmsnDcmntCn: '임대차계약서, 주민등록등본', plcyAplyMthdCn: '온라인 신청' }, T);
assert.equal(y.region, '춘천'); assert.equal(y.deadline, '2026-12-15'); assert.equal(y.type, '장학금', '주거 지원 → 장학·지원금');
assert.match(y.summary, /만 19~34세/); assert.match(y.summary, /온라인 신청/); assert.deepEqual(y.docs, ['임대차계약서', '주민등록등본']);
assert.equal(fromYouth({ plcyNo: 'P3', plcyNm: '청년 일경험 지원', lclsfNm: '일자리' }, T).type, '대외활동');
assert.equal(fromYouth({ plcyNo: 'P2', plcyNm: 'x', aplyPrdSeCd: '0057003' }, T), null, '마감 정책 제외');

assert.equal(fromFestival({ fstvlNm: '삼척 해맞이 축제', rdnmadr: '강원특별자치도 삼척시 ...', fstvlStartDate: '2026-12-31', fstvlEndDate: '2027-01-01' }, T).region, '삼척');
assert.equal(fromFestival({ fstvlNm: '강릉 축제', rdnmadr: '강원특별자치도 강릉시', fstvlEndDate: '2026-12-01' }, T), null);

assert.equal(rows({ response: { body: { items: [{ a: 1 }] } } }).length, 1);
assert.equal(rows({ currentCount: 1, data: [{ a: 1 }, { a: 2 }] }).length, 2);
// 예시 원본도 실제 변환기를 그대로 통과해야 함 (승인 전 시연용)
import { SAMPLE_RAW } from './gov-samples.mjs';
const S = SAMPLE_RAW(T);
const sk = S.한국장학재단.map(r => fromKosaf(r, T)), sg = S.보조금24.map(fromGov24), ss = S['K-Startup'].map(r => fromKstartup(r, T)), sf = S.전국문화축제.map(r => fromFestival(r, T));
for (const x of [...sk, ...sg, ...ss, ...sf]) { assert.ok(x, '예시가 변환기에서 빠짐'); assert.match(x.title, /^\[예시\]/); assert.match(x.url, /data\.go\.kr/); }
assert.equal(sk[1].region, '강원'); assert.equal(sg[0].region, '삼척'); assert.equal(sf[0].region, '춘천');
// 최신 파일 고르기: 날짜 형식이 섞여 있어도 2026-10-14가 2021-10-12보다 뒤
assert.equal(fileDate('한국장학재단_학자금지원정보(대학생)_20261014'), '2026-10-14'); assert.equal(fileDate('한국장학재단_학자금지원정보_10/12/2021'), '2021-10-12');
// 보조금24: 초·중·고·청소년 대상은 제외, 대학생·청년만
assert.equal(fromGov24({ 서비스ID: 'Y1', 서비스명: '청소년 방과후 지원', 소관기관명: '교육부', 지원대상: '초·중·고 학생' }), null);
assert.ok(fromGov24({ 서비스ID: 'Y2', 서비스명: '국가장학금', 소관기관명: '교육부', 지원대상: '대학생' }));
// 다른 시·군 주민 전용 장학은 제외, 삼척(석탄산업전환지역)은 유지
assert.equal(fromKosaf({ 상품명: '대학생장학금', 운영기관명: '(재)인제군장학회', '지역거주여부 상세내용': '○ 신청일 현재 관내에 주소를 두고 1년 이상 거주', 모집종료일: '2026-12-04' }, T), null);
assert.ok(fromKosaf({ 상품명: '저소득층 대학생 학자금', 운영기관명: '강원도 삼척시청', '지역거주여부 상세내용': '○ 학생 본인 또는 부모가 석탄산업전환지역에 거주', 모집종료일: '2026-11-30' }, T));
// 서비스ID로 다른 지역·관계없는 사업 거르기
assert.equal(fromGov24({ 서비스ID: '419100000010', 서비스명: '원주시 주소 이전 대학생 학자금 지원', 소관기관명: '강원특별자치도 원주시', 지원대상: '대학생' }), null, '원주시');
assert.equal(fromGov24({ 서비스ID: 'O00096800002', 서비스명: '희망장학금 대학생 지원', 소관기관명: '재단법인목포인재육성재단', 지원대상: '대학생' }), null, '목포 출연기관');
assert.ok(fromGov24({ 서비스ID: '424000000149', 서비스명: '삼척향토장학재단 향토 장학금', 소관기관명: '강원특별자치도 삼척시', 지원대상: '대학생' }), '삼척');
assert.ok(fromGov24({ 서비스ID: 'O00388400004', 서비스명: '강원특별자치도 청년·대학생 학자금대출 이자지원', 소관기관명: '재단법인강원인재원', 지원대상: '대학생' }), '강원인재원');
assert.ok(fromGov24({ 서비스ID: '161300000099', 서비스명: '청년월세 지원', 소관기관명: '국토교통부', 지원대상: '청년' }), '중앙부처');
assert.equal(fromGov24({ 서비스ID: 'B50000400011', 서비스명: '고속도로 졸음쉼터 푸드트럭 창업 지원', 소관기관명: '한국도로공사', 지원대상: '청년' }), null);
console.log('gov api tests ok');

// 2026-11-06 추가: 국가자격 시험일정 · 복지로 · 고용24 일학습병행 · 국가장학금 수혜 통계
import { fromQual, fromWelfare, fromWork24, kosafRate } from './gov.mjs';
const q = fromQual({ implYy: '2026', implSeq: 4, qualgbCd: 'T', description: '국가기술자격 기능사 (2026년도 제4회)', docRegStartDt: '20260824', docRegEndDt: '20260827', docExamStartDt: '20260916', pracRegStartDt: '20261012', pracRegEndDt: '20261109', pracExamStartDt: '20261114', pracPassDt: '20261211' }, T);
assert.equal(q.deadline, '2026-11-09', '필기 접수가 끝났으면 실기 접수 마감'); assert.match(q.title, /기능사 2026년 제4회 실기시험/); assert.ok(q.tags.includes('취업·진로'));
assert.equal(fromQual({ qualgbCd: 'T', description: '국가기술자격 기능사 (2026년도 제36회)', docRegEndDt: '20261111' }, T), null, '매주 열리는 상시 회차 제외');
assert.equal(fromQual({ qualgbCd: 'S', description: '전문자격 (2026년도 26회 필기)', docRegEndDt: '20261130' }, T), null, '이름 없는 전문자격 회차 제외');
assert.equal(fromQual({ qualgbCd: 'T', description: '국가기술자격 기사 (2026년도 제3회)', docRegEndDt: '20260802', pracRegEndDt: '20261019' }, T), null, '접수가 다 끝난 회차 제외');
const w = fromWelfare('<servId>WLF1</servId><servNm>청년월세 지원사업</servNm><servDgst>무주택 청년 월세 지원</servDgst><jurMnofNm>국토교통부</jurMnofNm><servDtlLink>https://www.bokjiro.go.kr/x?a=1&amp;b=2</servDtlLink><onapPsbltYn>Y</onapPsbltYn>');
assert.equal(w.type, '장학금'); assert.equal(w.region, '전국'); assert.equal(w.url, 'https://www.bokjiro.go.kr/x?a=1&b=2');
assert.equal(fromWelfare('<servNm>한국형 상병수당 시범사업</servNm><servDgst>청년 포함</servDgst>'), null, '이름에 학생·청년 대상이 드러나지 않으면 제외');
assert.equal(fromWelfare('<servNm>자립준비청년 자립수당 지급</servNm>'), null, '특정 대상 전용 제외');
const wk = fromWork24({ title: '2026년_공동훈련센터형_SW개발_L3_25V3_한국폴리텍대학 춘천캠퍼스_(주)씨디에스', subTitle: '한국폴리텍대학 춘천캠퍼스', address: '강원 춘천시', traStartDate: '2026-11-01', traEndDate: '2027-10-31', trprId: 'A1', trprDegr: '1', titleLink: 'https://www.work24.go.kr/x' }, T);
assert.equal(wk.title, '[일학습병행] SW개발 · (주)씨디에스 (한국폴리텍대학 춘천캠퍼스)'); assert.equal(wk.region, '춘천'); assert.equal(wk.deadline, ''); assert.match(wk.summary, /이미 시작된 과정/);
assert.equal(fromWork24({ title: 'x', subTitle: '폴리텍 원주', address: '강원 원주시', traStartDate: '2026-11-01' }, T), null, '춘천·삼척·강원대 외 제외');
assert.deepEqual(kosafRate([{ 기준년도: 2025, '대학구분그룹 명': '일반대', '설립형태 명': '국공립', '학적구분 명': '재학생군', '장학학기 명': '1학기', '신청인원(명)': 100, '수혜인원(명)': 50 },
  { 기준년도: 2025, '대학구분그룹 명': '일반대', '설립형태 명': '국공립', '학적구분 명': '재학생군', '장학학기 명': '2학기', '신청인원(명)': 200, '수혜인원(명)': 150 },
  { 기준년도: 2025, '대학구분그룹 명': '일반대', '설립형태 명': '사립', '학적구분 명': '재학생군', '장학학기 명': '2학기', '신청인원(명)': 9, '수혜인원(명)': 9 }]),
  { year: 2025, semester: '2학기', applied: 200, received: 150, rate: 75 });
console.log('gov new sources ok');

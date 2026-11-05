// node scripts/knu.test.mjs — 강원대 게시판 파서 (실제 페이지 구조를 줄인 조각으로 확인)
import assert from 'node:assert/strict';
import { parseList, parseDetail, guessDeadline, toText, toNotice, BOARDS } from './knu.mjs';

// 마감일
assert.equal(guessDeadline('ㅇ 신청기간: 2026. 10. 30.(금) 9시 ~ 11. 12.(목) 18시', '2026-10-30'), '2026-11-12');
assert.equal(guessDeadline('장학생 모집(~11/13)', '2026-10-27'), '2026-11-13');
assert.equal(guessDeadline('접수 기간 : 12월 28일 ~ 1월 5일', '2026-12-20'), '2027-01-05'); // 해 넘김
assert.equal(guessDeadline('문의: 1599-2290\n행사일: 11. 20.', '2026-11-01'), '');              // 기간 줄 없음
assert.equal(guessDeadline('제출기한: 2026-13-40', '2026-11-01'), '');                          // 잘못된 날짜
assert.equal(guessDeadline('지급요청서를 2026. 11. 16.(월)까지 제출', '2026-10-30'), '2026-11-16'); // ~까지
assert.equal(guessDeadline('’26. 10. 22.(목) 9시 ∼ 11. 12.(목) 18시', '2026-10-20'), '2026-11-12'); // ’26, ∼
assert.equal(guessDeadline('지원서 제출일: 2026.10.21.(수)까지', '2026-10-06'), '2026-10-21');
assert.equal(guessDeadline('1차 신청기간: 9. 9.까지\n2차 신청기간: ~ 11. 3.', '2026-10-02'), '2026-11-03'); // 지난 기간 건너뜀
assert.equal(guessDeadline('산학연협력 선도대학육성(LINC 3.0)사업단', '2026-10-06'), '');           // 3.0은 날짜 아님

assert.equal(toText('a&nbsp;&amp;<br>b<script>x</script>'), 'a &\nb');

// 목록: 캠퍼스 칸을 부서로 오인하지 않음, 고정 공지 표시
const list = parseList(`<table><tbody>
<tr><td><span class="noti">공지</span></td><td><span class="label-status campus" aria-label="춘천">춘천</span><span class="label-status campus" aria-label="삼척">삼척</span></td>
<td class="title"><a href="/ko/bbs/720/detail.do?pstSn=2616" class="link" data-sn="2616"> 겨울계절수업 안내</a></td><td>2026.10.29</td><td>1,021</td></tr>
<tr><td>3</td><td><span class="photo-chip">ALL</span></td><td><a data-sn="2537">[국가근로] 신청 안내</a></td><td>강릉학생지원과</td><td>2026.10.30</td><td>1,866</td></tr>
</tbody></table>`);
assert.equal(list.length, 2);
assert.deepEqual(list[0], { sn: '2616', title: '겨울계절수업 안내', posted: '2026-10-29', dept: '', campus: ['춘천', '삼척'], pinned: true });
assert.equal(list[1].dept, '강릉학생지원과');
assert.deepEqual(list[1].campus, []);

// 상세
const det = parseDetail(`<table><tr><th scope="row">캠퍼스</th><td colspan="3"><span class="photo-chip">삼척</span></td></tr>
<tr><th scope="row"><span>작성자</span></th><td colspan="3"><span>삼척학생지원과</span></td></tr></table>
<div class="editor-wrap"><p>ㅇ 신청기간: ~ 11. 20.</p></div>
<ul class="view-file-list"><li><a href="/ko/cmmn/download.do?dn=1.pdf&amp;fn=a.pdf"><span class="view-file-name">a.pdf</span></a></li></ul>`);
assert.deepEqual(det.campus, ['삼척']);
assert.equal(det.dept, '삼척학생지원과');
assert.equal(det.body, 'ㅇ 신청기간: ~ 11. 20.');
assert.equal(det.files[0].name, 'a.pdf');
assert.match(det.files[0].url, /^https:\/\/www\.kangwon\.ac\.kr\/ko\/cmmn\/download\.do\?dn=1\.pdf&fn=a\.pdf$/);

// 첨부가 없으면 버튼 영역에서 끊고 푸터(학교 주소 등)를 본문에 넣지 않음
assert.equal(parseDetail('<div class="editor-wrap"><p>본문</p></div><div class="btn-area"><a>목록</a></div><footer id="footer">강원대학교 춘천캠퍼스 주소</footer>').body, '본문');

const n = toNotice(BOARDS[0], list[1], det);
assert.equal(n.id, '721-2537');
assert.equal(n.type, '장학금');
assert.deepEqual(n.cond.campus, ['삼척']);
assert.equal(n.deadline, `${new Date().getFullYear()}-11-20`.replace(/^\d+/, '2026'));
assert.equal(n.aiPending, true);
// 원문에 언급이 없는 unknown만 풀고, 언급이 있으면 그대로
import { tightenCond } from './knu.mjs';
const tc = tightenCond({ campus: 'unknown', grade: 'unknown', residence: 'unknown', status: null, college: null, minGpa: 'unknown', maxIncome: null }, '춘천캠퍼스 재학생 대상 특강. 성적 우수자 우대');
assert.deepEqual([tc.cond.campus, tc.cond.grade, tc.cond.residence, tc.cond.minGpa], ['unknown', null, null, 'unknown']);
assert.deepEqual(tightenCond({ residence: 'unknown' }, '').cond.residence, 'unknown');
// 학사 기준 추출: 근거 문장과 함께, 재학생 단어만으로는 조건을 만들지 않음
import { extractRules } from './knu.mjs';
const rr = extractRules('1. 지원자격: 직전학기 평점평균 3.0점 이상, 직전 학기 이수학점 12학점 이상\n2. 신청대상: 학부생만\n3. 강원대학교 재학생 여러분 많은 참여 바랍니다');
assert.deepEqual(rr.map(r => [r.field, r.min ?? r.expected]), [['lastGpa', 3], ['lastCredits', 12], ['program', '학부']]);
assert.match(rr[0].evidence, /직전학기 평점평균 3.0점 이상/);
console.log('knu parser tests ok');

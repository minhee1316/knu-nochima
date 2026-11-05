import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRules, evaluateNotice } from '../dist/match.mjs';

const profile = {
  campus: '춘천', status: '재학', program: '학부', year: '3', currentSemester: '1',
  lastGpa: '3.8', cumulativeGpa: '3.6', gpaScale: '4.5',
  lastCredits: '15', earnedCredits: '72', completedSemesters: '4', incomeBracket: '4'
};

test('직전 학기 평점·이수학점을 비교하고 근거를 보존한다', () => {
  const notice = { board: '장학공지', campuses: ['춘천'], body: '가. 신청대상: 직전학기 이수학점 12학점 이상 및 직전학기 평점평균 3.0 이상인 자' };
  const result = evaluateNotice(notice, profile);
  assert.equal(result.category, 'candidate');
  assert.deepEqual(result.rules.map((rule) => rule.field), ['lastGpa', 'lastCredits']);
  assert.match(result.rules[0].evidence, /직전학기/);
});

test('이수 학기 수 범위가 맞지 않으면 조건 불일치로 표시한다', () => {
  const notice = { board: '장학공지', campuses: ['춘천'], body: '학부 1~3학기 총평균평점 4.0이상인 자' };
  const result = evaluateNotice(notice, profile);
  assert.equal(result.category, 'mismatch');
  assert.ok(result.failed.some((text) => text.includes('이수 학기 수')));
});

test('백분율 성적 85점을 평균평점 5점으로 오인하지 않는다', () => {
  const notice = { board: '장학공지', campuses: ['춘천'], body: '전체학기 백분율 성적이 85점 이상인 자' };
  assert.equal(extractRules(notice).some((rule) => rule.field === 'cumulativeGpa'), false);
});

test('조건을 추출할 수 없으면 참여 가능으로 단정하지 않는다', () => {
  const notice = { board: '공모안내', campuses: ['전체'], body: '자세한 신청 자격은 첨부파일을 확인하세요.' };
  assert.equal(evaluateNotice(notice, profile).category, 'check');
});

test('학자금 지원구간을 입력하지 않으면 추가 확인으로 둔다', () => {
  const notice = { board: '장학공지', campuses: ['전체'], body: '전체 학기 성적 평점 평균이 3.5점(4.5만점 기준) 이상인 학생\n소득분위 0구간~4구간' };
  const result = evaluateNotice(notice, { ...profile, incomeBracket: '' });
  assert.equal(result.category, 'check');
  assert.ok(result.missing.some((text) => text.includes('학자금 지원구간')));
});

test('현재 학년과 학기를 함께 비교한다', () => {
  const notice = { board: '장학공지', campuses: ['춘천'], body: '신청 대상: 3학년 1학기 재학생' };
  assert.equal(evaluateNotice(notice, profile).category, 'candidate');
  const wrongSemester = evaluateNotice(notice, { ...profile, currentSemester: '2' });
  assert.equal(wrongSemester.category, 'mismatch');
  assert.ok(wrongSemester.failed.some((text) => text.includes('현재 학기')));
});

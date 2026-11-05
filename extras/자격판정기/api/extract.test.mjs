// node api/extract.test.mjs — 모델 출력 정규화가 엉뚱한 값을 걸러내는지 확인
import assert from 'node:assert/strict';
import { normalize, extract } from './extract.js';

const n = normalize({
  type: '장학금', title: '  ○○장학 ', org: '학생과', amount: '1500000', deadline: '2026-12-01',
  campus: ['삼척', '서울', '삼척'], grade: [], college: [], residence: ['자취'], status: [],
  minGpa: 9, maxIncome: 8, unclear: ['college', 'hack'], docs: ['신청서', ''], summary: 's'
});
assert.deepEqual(n.cond.campus, ['삼척']);          // 허용값만, 중복 제거
assert.equal(n.cond.grade, null);                   // 빈 배열 = 제한 없음
assert.equal(n.cond.college, 'unknown');            // 애매한 조건
assert.equal(n.cond.minGpa, null);                  // 4.5 초과 버림
assert.equal(n.cond.maxIncome, 8);
assert.equal(n.amount, 1500000);
assert.equal(n.title, '○○장학');
assert.deepEqual(n.docs, ['신청서']);

const bad = normalize({ type: 'x', deadline: '12월 1일', amount: -5 });
assert.equal(bad.type, '공지');
assert.equal(bad.deadline, '');
assert.equal(bad.amount, 0);

assert.equal((await extract({ text: 'a' }, {})).status, 500);                 // 키 없음
assert.equal((await extract({}, { GEMINI_API_KEY: 'k' })).status, 400);       // 빈 입력
console.log('extract tests ok');

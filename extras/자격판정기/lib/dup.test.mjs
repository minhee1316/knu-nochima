// node lib/dup.test.mjs
import assert from 'node:assert/strict';
import { normTitle, similarity, isSame, findDup } from './dup.js';

assert.equal(normTitle('[장학] 2026 OO 장학생 선발 (재공고)!'), '2026oo장학생선발');
const d = '2026-12-01';
// 말머리·공백만 다르면 같은 공지
assert.ok(isSame({ title: '[장학] 지역인재 장학금 선발', deadline: d }, { title: '지역인재장학금 선발', deadline: d }));
// 마감일이 다르면 같은 공지 아님(다음 학기 공고)
assert.ok(!isSame({ title: '지역인재 장학금', deadline: d }, { title: '지역인재 장학금', deadline: '2027-06-01' }));
// 이름만 다른 장학금은 '같음'이 아니라 '비슷함'(경고만)
const r = findDup({ id: 'new', title: '삼척 지역인재 장학금 선발 안내', deadline: d },
  [{ id: 1, title: '도계 지역인재 장학금 선발 안내', deadline: d }]);
assert.ok(r && r.same === false);
// 전혀 다르면 null
assert.equal(findDup({ id: 'n', title: '복수전공 신청', deadline: d }, [{ id: 1, title: '취업 캠프 모집', deadline: d }]), null);
assert.equal(similarity('', 'a'), 0);
console.log('dup tests ok');

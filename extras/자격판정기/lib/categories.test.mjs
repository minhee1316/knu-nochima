// 분류 규칙 검증: 사람이 검토한 198건과 규칙의 결과를 비교해 크게 어긋나지 않는지 본다
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classify, applyCategories } from './categories.js';
const C = n => classify({ title: n, type: '공지' });
assert.equal(C('[춘천] 2026년 강원대학교 사랑의 연탄 나눔 봉사활동 참가자 모집'), '봉사');
assert.equal(C('문화체육관광부 대학생기자단 울림 22기 모집안내'), '대외활동');
assert.equal(C('2027 KF 글로벌 챌린저 해외 인턴십 프로그램'), '대외활동');
assert.equal(C('2026년 재난안전 AI 데이터 활용 해커톤'), '공모전');
assert.equal(C('「강원대학교 개교 80주년 기념 디자인 공모전」 결과 발표 일정 변경 안내'), '공지');
assert.equal(C("'2026.2학기 주거안정장학금' 서약서 제출 안내"), '공지');
assert.equal(C('2026년 2학기 거창군 지역출신 대학생 등록금 지원사업 안내'), '장학금');
assert.equal(C('2026학년도 겨울 계절수업 전북대학교 학점교류 수학 안내(춘천/삼척)'), '공지');
assert.equal(C('2026년 산업입지학회 창립 학술대회 안내'), '비교과');
assert.equal(classify({ title: '아무 말', type: '공모전' }), '공모전', '맞는 규칙이 없으면 원래 종류');
const r = applyCategories([{ id: 'a', title: 'x', type: '공지' }, { id: 'b', title: '연탄 봉사활동', type: '공모전' }, { id: 'c', title: 'y', type: '공지' }], { a: { type: '장학금', tags: ['봉사'] }, c: { type: '공지', tags: [], hide: '중복' } });
assert.deepEqual(r.list.map(n => [n.id, n.type]), [['a', '장학금'], ['b', '봉사']]); assert.equal(r.hidden, 1);
// 검토본과 규칙의 일치율 (새 글에 규칙을 써도 되는지)
try {
  const rev = JSON.parse(readFileSync(new URL('../data/categories.json', import.meta.url), 'utf8')).items;
  const all = Object.values(rev).filter(e => !e.hide), same = all.filter(e => classify({ title: e.title, type: e.type }) === e.type).length;
  console.log(`  규칙 일치율: ${same}/${all.length} (${Math.round(same / all.length * 100)}%)`);
  assert.ok(same / all.length >= 0.85, '규칙과 사람 검토가 85% 이상 같아야 함');
} catch (e) { if (e.code !== 'ENOENT') throw e; }
console.log('categories tests ok');

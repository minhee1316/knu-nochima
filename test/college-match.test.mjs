import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../src/ai/gom-semantic.js';
import '../src/ai/college-match.js';
const model=JSON.parse(readFileSync(new URL('../src/ai/gom-ko.json',import.meta.url)));
const classify=createCollegeMatcher(createGomSearch(model));
test('계열별 주제 근거를 보존하고 같은 공고의 내용 변경을 반영한다',()=>{
  for(const [college,title] of Object.entries({'인문·사회':'청년 주거정책 제안과 주민 인터뷰','자연과학':'생태계 생물다양성 현장 조사','공학·IT':'소프트웨어 해커톤','보건·의료':'간호 실습과 환자교육','예술·체육':'창작 웹툰 일러스트 공모전'})){
    const result=classify({id:'same',title});assert.equal(result[college]?.quote,title);
  }
  assert.deepEqual(classify({id:'same',title:'강원대학교 재학생 대상 공모전'}),{});
});
test('기관명과 안내 경로에 포함된 단어를 전공으로 해석하지 않는다',()=>{
  const row={id:'neutral',title:'지역문제 기반 프로젝트 공모전 안내',body:'교수학습개발원 홈페이지 → 로그인 → 프로그램 신청'};
  assert.equal(classify(row)['자연과학'],undefined);
  assert.equal(classify({id:'issuer',title:'문화체육관광부 대학생기자단 모집안내'})['예술·체육'],undefined);
});

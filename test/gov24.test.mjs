import test from 'node:test';
import assert from 'node:assert/strict';
import {collectGov24, gov24Item, gov24Scope} from '../worker/gov24.mjs';

const benefit = (id, org='강원특별자치도 삼척시') => ({
  서비스ID: String(id), 서비스명:'테스트 사업', 소관기관명:org, 지원대상:'춘천에서 전입한 주민'
});

test('혜택 목록은 소관기관으로 분류하고 신청기한과 지원대상은 원문을 따른다', () => {
  assert.equal(gov24Scope(benefit(101,'강원특별자치도 원주시')), '');
  assert.equal(gov24Scope(benefit(102,'강원특별자치도교육청')), '강원');
  assert.equal(gov24Scope({...benefit(103,'교육부'),소관기관유형:'중앙행정기관'}),'중앙부처');
  const row=gov24Item({...benefit(104),상세조회URL:'https://gov.kr.example.org/'});
  assert.equal(row.scope,'삼척');
  assert.equal(row.target,'춘천에서 전입한 주민');
  assert.equal(row.due,'');
  assert.equal(row.url,'');
});

test('정부24는 인증 헤더로 순차 조회하며 중복 페이지나 인증 실패를 정상 결과로 처리하지 않는다', async () => {
  const first=Array.from({length:1000},(_,i)=>benefit(i+100));
  function source(secondId){
    return async (address,options)=>{
      const url=new URL(address);
      assert.equal(url.hostname,'api.odcloud.kr');
      assert.equal(url.searchParams.has('serviceKey'),false);
      assert.equal(options.headers.Authorization,'Infuser test');
      const page=Number(url.searchParams.get('page'));
      const data=page===1?first:[benefit(secondId)];
      return Response.json({page,perPage:1000,totalCount:1001,matchCount:1001,currentCount:data.length,data});
    };
  }
  assert.equal((await collectGov24('test',source(2100))).length,1001);
  await assert.rejects(collectGov24('test',source(101)),/incomplete/);
  await assert.rejects(collectGov24('test',async()=>new Response(null,{status:403})),/authorization/);
});

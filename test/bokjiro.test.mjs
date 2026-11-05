import test from 'node:test';
import assert from 'node:assert/strict';
import {collect,readDetail} from '../worker/bokjiro.mjs';

const sample='<servList><servId>WLF00000001</servId><servNm>주거 &amp; 생활</servNm><lifeArray>청년</lifeArray><servDtlLink>https://www.bokjiro.go.kr/example</servDtlLink></servList>';
const page=(rows,total=1)=>'<wantedList><resultCode>0</resultCode><pageNo>1</pageNo><totalCount>'+total+'</totalCount>'+rows+'</wantedList>';
test('중앙부처 목록은 검색 구분을 포함하고 생애주기와 실제 지원 대상을 구분한다',async()=>{
  const [item]=await collect('mock',async address=>{
    const url=new URL(address);
    assert.equal(url.searchParams.get('srchKeyCode'),'003');
    assert.equal(url.searchParams.get('callTp'),'L');
    return new Response(page(sample));
  });
  assert.equal(item.title,'주거 & 생활');
  assert.equal(item.life,'청년');
  assert.equal(item.target,undefined);
  assert.equal(item.scope,'중앙부처');
});
test('반복된 신청 절차와 원문 기준을 상세에 보존하고 다른 복지사업의 상세는 거부한다',async()=>{
  const item={id:'WLF00000001'};
  const detail='<wantedDtl><resultCode>0</resultCode><servId>'+item.id+'</servId><tgtrDtlCn>원문 대상</tgtrDtlCn><slctCritCn>원문 기준</slctCritCn><applmetList><servSeDetailLink>신청</servSeDetailLink></applmetList><applmetList><servSeDetailLink>심사</servSeDetailLink></applmetList></wantedDtl>';
  const record=await readDetail(item,'mock',async()=>new Response(detail));
  assert.deepEqual([record.target,record.criteria,record.method],['원문 대상','원문 기준','신청\n심사']);
  await assert.rejects(readDetail({id:'WLF00000002'},'mock',async()=>new Response(detail)),/incomplete/);
});
test('인증 오류와 일부 수집, 중복 ID를 정상 스냅샷으로 사용하지 않는다',async()=>{
  await assert.rejects(collect('mock',async()=>new Response('<wantedList><resultCode>30</resultCode></wantedList>')),/authorization/);
  await assert.rejects(collect('mock',async()=>new Response(page(sample,2))),/incomplete/);
  await assert.rejects(collect('mock',async()=>new Response(page(sample+sample,2))),/incomplete/);
});

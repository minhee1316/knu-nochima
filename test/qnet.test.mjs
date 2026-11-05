import test from 'node:test';
import assert from 'node:assert/strict';
import {collect,handle} from '../worker/qnet.mjs';

const row={implYy:'2026',implSeq:3,qualgbCd:'T',qualgbNm:'국가기술자격',description:'기사 제3회',
  docRegStartDt:'20260720',docRegEndDt:'20260723',pracExamStartDt:'20261024',pracExamEndDt:'20261113',pracPassDt:'20261211'};
const subject={code:'1320',category:'T',name:'정보처리기사'};
const page=(rows,total=rows.length,no=1)=>Response.json({header:{resultCode:'00'},body:{pageNo:no,totalCount:total,items:rows}});
test('종목별로 회차를 묶고 서로 다른 접수창과 실기·발표 날짜를 모두 보존한다',async()=>{
  const result=await collect('2026',subject,'test',async u=>{
    assert.equal(u.searchParams.get('jmCd'),'1320');assert.equal(u.searchParams.get('numOfRows'),'50');
    return page([row,{...row,docRegStartDt:'20260801',docRegEndDt:'20260802'}]);
  });
  assert.equal(result.items.length,1);
  assert.deepEqual(result.items[0].periods.map(p=>[p.label,p.text]),[
    ['필기 원서접수','2026-07-20 ~ 2026-07-23'],['필기 원서접수','2026-08-01 ~ 2026-08-02'],
    ['실기 시험','2026-10-24 ~ 2026-11-13'],['최종 합격 발표','2026-12-11']]);
});
test('종목 미지정 자료를 서로 합치지 않고 전문자격 날짜에 필기·실기를 단정하지 않는다',async()=>{
  const professional={...row,qualgbCd:'S',docRegStartDt:'20260230',docRegEndDt:'20260301'};
  const r=await collect('2026',null,'test',()=>page([professional,{...professional,docRegEndDt:'20260302'}]));
  assert.equal(r.items.length,2);assert.equal(r.items[0].periods[0].text,'시작일 미제공 ~ 2026-03-01');
  assert.equal(r.items[0].periods[0].label,'원서접수');
});
test('페이지 누락, 인증 실패, 정상 빈 결과 및 잘못된 종목을 구분한다',async()=>{
  let calls=0;
  await assert.rejects(collect('2026',null,'test',()=>++calls===1?page(Array(50).fill(row),52):page([row],52,2)),{code:'partial'});
  assert.equal(calls,2);
  await assert.rejects(collect('2026',null,'test',()=>new Response(null,{status:403})),{code:'auth'});
  assert.deepEqual((await collect('2026',null,'test',()=>page([]))).items,[]);
  assert.equal((await handle(new Request('https://internal/api/exams?code=xyz'),{})).status,400);
});

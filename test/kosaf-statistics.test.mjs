import test from 'node:test';
import assert from 'node:assert/strict';
import {collect,catalog,record} from '../worker/kosaf-statistics.mjs';

const row={'기준년도':2025,'장학학기 명':'1학기','대학구분그룹 명':'일반대','설립형태 명':'국립','학적구분 명':'재학','신청인원(명)':12,'수혜인원(명)':8};
test('statistics sequential full pagination, original fields and encoding',async()=>{
  const pages=[];
  const data=await collect('people','a+/=',async url=>{
    assert.equal(url.searchParams.get('serviceKey'),'a+/=');
    const page=+url.searchParams.get('page');pages.push(page);
    const rows=Array.from({length:page===1?500:1},()=>row);
    return Response.json({page,totalCount:501,currentCount:rows.length,data:rows});
  });
  assert.deepEqual(pages,[1,2]);assert.equal(data.rows.length,501);
  assert.deepEqual(record(data,0).raw,row);assert.equal(record(data,501),null);
});
test('statistics reject partial and unauthorized results; empty is valid',async()=>{
  let count=0;
  await assert.rejects(collect('people','key',async()=>{count++;return new Response('',{status:403});}),/authorization/);
  assert.equal(count,1);
  await assert.rejects(collect('people','key',async()=>Response.json({page:1,totalCount:2,currentCount:1,data:[row]})),/partial/);
  const empty=await collect('family','key',async()=>Response.json({page:1,totalCount:0,currentCount:0,data:[]}));
  assert.deepEqual(empty.rows,[]);
  const missing={...row,'수혜인원(명)':null};
  const nullable=await collect('people','key',async()=>Response.json({page:1,totalCount:1,currentCount:1,data:[missing]}));
  assert.equal(nullable.rows[0]['수혜인원(명)'],null);
  assert.match(record(nullable,0).body,/수혜인원\(명\) · 정보 없음/);
});
test('statistics sync failure keeps the last good database snapshot',async()=>{
  const previous={rows:[row],sourceDate:'2025-12-31',syncedAt:'2026-11-05T00:00:00Z'};
  let writes=0;
  const env={DB:{prepare(){return {bind(){return this;},async first(){return {stamp:0,payload:JSON.stringify(previous)};},async run(){writes++;}};}}};
  const actual=await catalog('people',env);
  assert.deepEqual(actual.rows,previous.rows);assert.equal(actual.syncedAt,previous.syncedAt);assert.ok(actual.warning);assert.equal(writes,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {collectStartups,mapStartup,handleStartups} from '../worker/startups.mjs';

const row=i=>({pbanc_sn:i,biz_pbanc_nm:'테스트 공고 '+i,rcrt_prgs_yn:'Y',pbanc_rcpt_end_dt:'20261130',supt_regin:'전국'});
function page(page,matchCount,data){
  return Response.json({page,matchCount,totalCount:30000,perPage:100,currentCount:data.length,data});
}
test('K-Startup 모집 중 일련번호, 종료일, 원문 링크와 제외 조건을 보존한다',()=>{
  const r=mapStartup({...row(7),detl_pg_url:'javascript:bad',biz_aply_url:'https://example.org/apply',aply_excl_trgt_ctnt:'사업 참여 제한 기업',pbanc_rcpt_bgng_dt:'20260230'});
  assert.equal(r.id,'kstartup-7');assert.equal(r.start,'');assert.equal(r.deadline,'2026-11-30');
  assert.equal(r.applicationUrl,'https://example.org/apply');assert.equal(new URL(r.url).searchParams.get('pbancSn'),'7');
  assert.equal(r.exclusions,'사업 참여 제한 기업');assert.throws(()=>mapStartup({...row(1),rcrt_prgs_yn:'N'}));
});
test('모집 중 matchCount만큼 순차 수집하고 중복되거나 불완전한 자료는 거부한다',async()=>{
  const first=Array.from({length:100},(_,i)=>row(i+1)), calls=[];
  let repeat=false;
  const fetcher=async url=>{
    const params=new URL(url).searchParams,n=+params.get('page');
    assert.equal(params.get('cond[rcrt_prgs_yn::EQ]'),'Y');assert.equal(params.get('serviceKey'),'unit/+');
    calls.push(n);return page(n,101,n===1?first:[row(repeat?5:101)]);
  };
  assert.equal((await collectStartups('unit%2F%2B',fetcher)).length,101);assert.deepEqual(calls,[1,2]);
  repeat=true;await assert.rejects(collectStartups('unit%2F%2B',fetcher),/incomplete/);
  await assert.rejects(collectStartups('unit',async()=>page(1,5,[])),/incomplete/);
  assert.deepEqual(await collectStartups('unit',async()=>page(1,0,[])),[]);
});
test('K-Startup 인증 누락과 서비스 미승인을 빈 목록과 구분한다',async()=>{
  await assert.rejects(collectStartups(''),/configuration/);
  let calls=0;
  await assert.rejects(collectStartups('unit',async()=>{calls++;return new Response(null,{status:403});}),/authorization/);
  assert.equal(calls,1);
});
const sqlite=await import('node:sqlite').catch(()=>null);
test('K-Startup 새로고침 실패 시 마지막 정상 D1 세대를 사용한다',{skip:!sqlite},async t=>{
  const {readFile}=await import('node:fs/promises'),db=new sqlite.DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec(await readFile(new URL('../drizzle/0002_startup_feed.sql',import.meta.url),'utf8'));
  const DB={prepare(sql){
    const s=db.prepare(sql);return {all:()=>({results:s.all()}),bind:(...v)=>()=>s.run(...v)};
  },batch(writes){db.exec('BEGIN');try{writes.forEach(run=>run());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}};
  const env={DB,DATA_GO_KR_SERVICE_KEY:'unit'},get=async()=>(await handleStartups(new Request('https://unit.test/api/startups'),env)).json();
  let failed=false,calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return failed?new Response(null,{status:403}):page(1,1,[row(7)]);});
  assert.equal((await get()).mode,'live');assert.equal((await get()).items[0].id,'kstartup-7');assert.equal(calls,1);
  db.exec('UPDATE startup_feed SET synced_at=1');failed=true;
  const stale=await get();assert.equal(stale.mode,'snapshot');assert.equal(stale.items[0].id,'kstartup-7');assert.match(stale.warning,/인증키/);
});

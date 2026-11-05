import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectKosaf, handleKosaf, kosafDate, kosafStatus, mapKosaf, searchKosaf } from '../worker/scholarships.mjs';

const path = '/15028252/v1/uddi:146a2f2a-3571-4768-9113-8dd47d67338b';
const sample = (i, product='장학금') => ({
  '상품명': '테스트 ' + i, '운영기관명': '검증용 기관', '상품구분': product,
  '모집시작일': '2026-02-01', '모집종료일': '2026-02-28',
  '학년구분': '대학3학기대학4학기', '대학구분': '4년제', '학과구분': '공학계열'
});
function response(page,total,rows) {
  return Response.json({page, perPage:500, totalCount:total, matchCount:total, currentCount:rows.length, data:rows});
}

test('원문 조건과 실제 선발 인원 필드, 빈 값', () => {
  const raw = {...sample(1), '성적기준 상세내용':'  평균  B 이상\n세부 기준 별도', '선발 인원 상세내용':'약간 명', '지역거주여부 상세내용':'  '};
  const mapped = mapKosaf(raw);
  assert.equal(mapped.gpa, raw['성적기준 상세내용']);
  assert.equal(mapped.people,'약간 명');
  assert.equal(mapped.region,'정보 없음');
  assert.throws(()=>mapKosaf({}), {code:'incomplete'});
});
test('모집기간 양 끝 날짜 및 잘못된 날짜', () => {
  const row = mapKosaf(sample(1));
  for(const [date,status] of [['2026-01-31','모집예정'],['2026-02-01','모집중'],['2026-02-28','모집중'],['2026-03-01','마감']]){
    assert.equal(kosafStatus(row,date),status);
  }
  assert.equal(kosafDate('20240229'),'2024-02-29');
  for(const end of ['2026-02-29','','2026-01-02','상시'])assert.equal(kosafStatus({...row,end},'2026-02-01'),'기간 확인 필요');
});
test('전체 자료를 검색하고 필터링한 후 페이지 분할', () => {
  const rows = Array.from({length:40},(_,i)=>({...mapKosaf(sample(i)), org:i>=14?'기관 A':'기관 B',id:String(i)}));
  const p = new URLSearchParams({q:'기관a',grade:'대학4학기',major:'공학',school:'4년',status:'모집중',page:'2'});
  const found = searchKosaf(rows,p,'2026-02-05');
  assert.equal(found.total,26);assert.equal(found.pages,3);assert.equal(found.items.length,12);
  assert.ok(found.items.every(row=>row.org==='기관 A'));
  p.set('status','마감');assert.equal(searchKosaf(rows,p,'2026-02-05').total,0);
});
test('인증·주소 오류, 이중 인코딩 방지, 일시적 오류만 재시도',async()=>{
  const codes=[429,503,200], collected=[];
  const counts=await collectKosaf(path,'test%2B%2F%3D',async rows=>collected.push(...rows),async (address,options)=>{
    const url=new URL(address);assert.equal(options.redirect,'manual');
    assert.equal(url.origin,'https://api.odcloud.kr');assert.equal(url.pathname,'/api'+path);
    assert.equal(url.searchParams.get('serviceKey'),'test+/=');
    const code=codes.shift();
    return code===200?response(1,2,[sample(1),sample(2,'학자금')]):new Response('',{status:code});
  });
  assert.deepEqual(counts,{total:2,scholarships:1});assert.equal(collected.length,1);
  for(const [status,code] of [[401,'authorization'],[403,'authorization'],[400,'upstream']]){
    let calls=0;
    await assert.rejects(collectKosaf(path,'unit',()=>{},async()=>{calls++;return new Response('',{status});}),{code});
    assert.equal(calls,1);
  }
  await assert.rejects(collectKosaf('https://example.com','unit',()=>{}),{code:'path'});
  await assert.rejects(collectKosaf(path,'',()=>{}),{code:'configuration'});
  const zero=await collectKosaf(path,'unit',()=>{},async()=>response(1,0,[]));
  assert.deepEqual(zero,{total:0,scholarships:0});
  await assert.rejects(collectKosaf(path,'unit',()=>{},async()=>response(1,7,[])),{code:'incomplete'});
});

// Exercise the actual migration and SQL statements with an in-memory database.
const sqlite=await import('node:sqlite').catch(()=>null);
test('전체 동기화 교체, 캐시 재사용, 중간 실패 시 기존 자료 유지', {skip:!sqlite}, async t=>{
  const db=new sqlite.DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec(await readFile(new URL('../drizzle/0001_scholarships.sql',import.meta.url),'utf8'));
  function prepare(sql,args=[]){
    const stmt=db.prepare(sql);
    return {bind:(...values)=>prepare(sql,values),
      first:()=>stmt.get(...args),all:()=>({results:stmt.all(...args)}),
      run:()=>({meta:{changes:stmt.run(...args).changes}})};
  }
  const DB={prepare,batch(stmts){
    db.exec('BEGIN');try{for(const s of stmts)s.run();db.exec('COMMIT');}catch(err){db.exec('ROLLBACK');throw err;}
  }};
  const env={DB};
  const query=async params=>{
    const r=await handleKosaf(new Request('https://unit.test/api/scholarships?'+new URLSearchParams(params)),env);
    return {status:r.status,...await r.json()};
  };
  assert.equal((await query({})).code,'configuration');
  env.DATA_GO_KR_SERVICE_KEY='unit-only';
  let fail=false,calls=0,empty=false;
  t.mock.method(globalThis,'fetch',async address=>{
    calls++;const page=Number(new URL(address).searchParams.get('page'));
    if(empty)return response(1,0,[]);
    if(fail&&page===2)return new Response('',{status:403});
    const rows=page===1?Array.from({length:500},(_,i)=>sample(fail?'교체중':i)): [sample(500,'학자금')];
    return response(page,501,rows);
  });
  const result=await query({q:'테스트'});assert.equal(result.total,500);assert.equal(result.sourceCount,501);assert.equal(calls,2);
  const id=result.items[0].id;assert.equal((await query({id})).item.product,'장학금');
  assert.equal((await query({page:2})).syncedAt,result.syncedAt);assert.equal(calls,2);
  db.exec('UPDATE scholarship_catalog SET synced_at=1');fail=true;
  const stale=await query({});assert.equal(stale.total,500);assert.match(stale.warning,/인증키/);
  assert.equal(stale.items[0].id,id);assert.equal((await query({q:'교체중'})).total,0);assert.equal(calls,4);
  assert.equal(db.prepare('SELECT count(DISTINCT generation) AS n FROM scholarship_chunks').get().n,1);
  db.exec('UPDATE scholarship_catalog SET retry_after=0');empty=true;
  const completed=await query({});assert.equal(completed.status,200);assert.equal(completed.sourceCount,0);assert.equal(completed.total,0);
  assert.equal((await query({id})).status,404);assert.equal(calls,5);
});

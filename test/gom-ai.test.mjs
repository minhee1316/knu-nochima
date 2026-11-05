import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { gomCheckAnswer, handleGomChat } from '../worker/gom-ai.mjs';
import '../src/ai/gom-semantic.js';

const model = JSON.parse(readFileSync(new URL('../src/ai/gom-ko.json',import.meta.url)));
const search = createGomSearch(model);
test('local semantic search recognizes Korean paraphrases and only returns relevant records',()=>{
  const question = search.analyze('자취하는데 매달 방값이 부담돼');
  assert.equal(question.topic.id,'housing');
  assert.equal(search.analyze('졸업 전에 회사에서 일을 경험해 보고 싶어').topic.id,'work');
  assert.equal(search.analyze('오늘 저녁 피자는 어떻게 만들어').topic,null);
  const rows=[{id:1,title:'주거비 지원',snippet:'월세 및 임차료 지원'},{id:2,title:'축제 행사'}];
  assert.deepEqual(search.rank(question, rows).map(r=>r.id),[1]);
});
test('citations must be an exact extract from the identified public record',()=>{
  const docs=[{ref:1,id:'event:1',title:'예시',evidence:['신청 자격은 거주 주민입니다.']}];
  const valid={answer:'거주 주민이 신청할 수 있어요.',citations:[{ref:1,line:1}]};
  assert.equal(gomCheckAnswer(valid,docs).citations[0].id,'event:1');
  assert.equal(gomCheckAnswer({...valid,citations:[{ref:2,line:1}]},docs),null);
  assert.equal(gomCheckAnswer({...valid,citations:[{ref:1,line:2}]},docs),null);
  assert.equal(gomCheckAnswer({...valid,citations:[]},docs),null);
});
test('server resolves its own evidence, forwards no account fields, and enforces D1 quotas',async(t)=>{
  const fixture={id:'event:test',title:'가상 테스트 행사',body:'행사 장소는 테스트 광장입니다.'};
  globalThis.STATIC_ASSETS={'/index.html':{body:'<script>window.EMBED='+JSON.stringify({notices:[fixture]})+';</script>'}};
  globalThis.feedMemory=new Map();
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0003_gom_usage.sql',import.meta.url),'utf8'));
  const env={GEMINI_API_KEY:'unit-test',DB:{
    prepare:sql=>({bind:(...args)=>()=>({meta:sqlite.prepare(sql).run(...args)})}),
    batch:async ops=>ops.map(run=>run())
  }};
  let count=0;
  t.mock.method(globalThis,'fetch',async(url,opts)=>{
    count++;
    assert.equal(new URL(url).host,'generativelanguage.googleapis.com');
    assert.equal(opts.headers['x-goog-api-key'],env.GEMINI_API_KEY);
    const data=JSON.parse(JSON.parse(opts.body).contents[0].parts[0].text);
    if(data.context){
      assert.deepEqual(data.context.titles,['첫 과정','둘째 과정']);
      assert.ok(!opts.body.includes('PRIVATE_SENTINEL'));
      return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({mode:'follow',source:'training',city:'춘천',terms:[],positions:[2,9],reply:''})}]}}]});
    }
    assert.deepEqual(Object.keys(data),['question','notices']);
    assert.match(data.notices[0].evidence.join(' '),/테스트 광장/);
    assert.ok(!opts.body.includes('PRIVATE_SENTINEL'));
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({answer:'테스트 광장에서 열려요.',citations:[{ref:1,line:2}]})}]}}]});
  });
  const post=(origin='https://unit.test',extra={})=>new Request('https://unit.test/api/gom-chat',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({question:'행사가 어디에서 열려?',ids:['event:test'],profile:'PRIVATE_SENTINEL',...extra})});
  assert.equal((await handleGomChat(post(),{})).status,503);
  assert.equal((await handleGomChat(post('https://unrelated.test'),env)).status,403);
  assert.equal((await handleGomChat(post('null',{question:'비밀번호: PRIVATE_SENTINEL'}),env)).status,400);
  const plan=await handleGomChat(post('null',{phase:'consult',context:{source:'training',titles:['첫 과정','둘째 과정'],profile:'PRIVATE_SENTINEL'}}),env);
  assert.deepEqual((await plan.json()).plan.positions,[2]);
  for(let i=1;i<20;i++){
    const r=await handleGomChat(post('null'),env);
    assert.equal(r.status,200);
    assert.equal((await r.json()).citations[0].id,fixture.id);
  }
  assert.equal((await handleGomChat(post(),env)).status,429);
  assert.equal(count,20);
  sqlite.close();
  delete globalThis.STATIC_ASSETS;delete globalThis.feedMemory;
});

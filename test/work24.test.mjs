import test from 'node:test';
import assert from 'node:assert/strict';
import {mapWork24,collectWork24} from '../worker/work24.mjs';

const row={trprId:'TRAIN1',trprDegr:'1',title:'검증용 과정',subTitle:'춘천 테스트 기관',address:'강원 삼척시',trngAreaCd:'51230',
  traStartDate:'2026-10-10',traEndDate:'2027-01-10',titleLink:'https://www.work24.go.kr/hr/detail?prtcmpSeqNo=1'};
test('training region follows the venue and training dates are kept separate from application dates',()=>{
  const n=mapWork24(row);
  assert.equal(n.region,'삼척');assert.equal(n.org,row.subTitle);
  assert.equal(n.end,row.traEndDate);assert.equal(n.deadline,undefined);
  assert.throws(()=>mapWork24({...row,titleLink:'https://unrelated.example/'}));
});
test('two non-overlapping start-date windows return active courses only and reject incomplete pages',async()=>{
  const now=Date.parse('2026-11-05T16:00:00Z'),calls=[];
  const data=await collectWork24('unused',now,async url=>{
    const params=new URL(url).searchParams;calls.push([params.get('srchTraStDt'),params.get('srchTraEndDt')]);
    const rows=calls.length===1?[row,{...row,trprId:'EXPIRED',traEndDate:'2026-11-05'}]:[];
    return Response.json({pageNum:'1',srchList:rows,scn_cnt:String(rows.length)});
  });
  assert.deepEqual(calls,[['20251106','20261105'],['20261106','20270505']]);
  assert.equal(data.items.length,1);
  await assert.rejects(collectWork24('unused',now,async()=>Response.json({pageNum:1,scn_cnt:3,srchList:[row]})),/incomplete/);
});

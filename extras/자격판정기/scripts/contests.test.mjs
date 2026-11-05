// 외부 공모전 목록 파서 테스트 (2026-11-06에 받은 실제 목록 구조를 줄여서 씀)
import assert from 'node:assert/strict';
import { parseWevity, parseThinkyou, parseLinkareer, merge, SITES } from './contests.mjs';
const T = '2026-11-06';

const wv = parseWevity(`<li ><!--class="bg" --> <div class="tit"> <a href="?c=find&s=1&gub=1&gbn=view&gp=1&ix=112073">[제3회] 매경 AI 광고 공모전 <span class='stat spec'>SPECIAL</span> </a> <div class="sub-tit">분야 : 기획/아이디어, 광고/마케팅</div> </div> <div class="organ">매경미디어</div> <div class="day"> D-25 <span class="dday future">접수예정</span> </div></li>
<li class='bg'><!--class="bg" --> <div class="tit"> <a href="?c=find&s=1&gub=1&gbn=view&gp=1&ix=112063">광고 온에어 기념 이벤트 <span class='stat spec'>SPECIAL</span> </a> <div class="sub-tit">분야 : 기타</div> </div> <div class="organ">건강보험심사평가원</div> <div class="day"> D-10 </div></li>`, T);
assert.equal(wv.length, 1, '이벤트는 제외');
assert.deepEqual([wv[0].title, wv[0].org, wv[0].deadline, wv[0].field], ['[제3회] 매경 AI 광고 공모전', '매경미디어', '2026-12-01', '기획/아이디어, 광고/마케팅']);
assert.match(wv[0].url, /ix=112073$/);

const ty = parseThinkyou(`<div class="tr "> <div class="title"> <a href="/contest/67937/?page=1&amp;pagesize=45"> <dl> <dt><h3>대한민국 수목원·정원 숏폼 공모전 </h3></dt> <dd>주최 : 한국수목원정원관리원&nbsp;</dd> </dl> </a> </div> <div class="etc">26-11-04 ~ 26-11-23</div> <div class="statNew">D-17</div></div>`);
assert.deepEqual(ty[0], { sid: '67937', title: '대한민국 수목원·정원 숏폼 공모전', org: '한국수목원정원관리원', start: '2026-11-04', deadline: '2026-11-23', url: 'https://thinkyou.co.kr/contest/67937/' });

const lk = parseLinkareer(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { __APOLLO_STATE__: {
  'Activity:362577': { __typename: 'Activity', id: '362577', title: '심벌마크 디자인 공모', organizationName: '부산기술창업투자', recruitCloseAt: '1793977199999' },
  'User:1': { name: 'x' } } } } })}</script>`);
assert.deepEqual([lk[0].title, lk[0].org, lk[0].url], ['심벌마크 디자인 공모', '부산기술창업투자', 'https://linkareer.com/activity/362577']);
assert.match(lk[0].deadline, /^20\d{2}-\d{2}-\d{2}$/);

// 여러 사이트에 같은 공모전 → 하나로, 마감 지난 것 제외, 출처 표시
const m = merge([{ site: SITES[0], rows: [{ sid: '1', title: '매경 AI 광고 공모전', org: 'A', deadline: '2026-12-01', url: 'u1' }, { sid: '2', title: '지난 공모전', deadline: '2026-10-01', url: 'u2' }] },
  { site: SITES[1], rows: [{ sid: '9', title: '매경 AI  광고 공모전', org: 'A', deadline: '2026-12-01', url: 'u9' }] }], T);
assert.equal(m.length, 1); assert.deepEqual(m[0].alsoOn, ['씽유']); assert.equal(m[0].kind, 'contest'); assert.equal(m[0].source, '위비티'); assert.equal(m[0].type, '공모전');
// 대외활동·인턴 목록: 같은 파서, 종류는 대외활동, 인턴은 취업·진로 태그
const intern = SITES.find(s => s.key === 'linkareer-intern');
const mi = merge([{ site: intern, rows: [{ sid: '7', title: '[세방] 채용연계형 인턴 채용', org: '세방', deadline: '2026-11-15', url: 'u7' }] }], T);
assert.equal(mi[0].type, '대외활동'); assert.ok(mi[0].tags.includes('취업·진로')); assert.equal(mi[0].source, '링커리어 인턴'); assert.match(mi[0].summary, /지원 자격/);
console.log('contests tests ok');

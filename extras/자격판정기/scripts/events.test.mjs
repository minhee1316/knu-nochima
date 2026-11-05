// 지역 행사 파서 확인 (실제 페이지 구조를 줄인 HTML)
import assert from 'node:assert/strict';
import { parseChuncheon, parseSamcheok } from './events.mjs';

const card = (id, title, label, date) => `<div class="box"><a href="/tour/festival-event/main/view/?tourEventId=${id}"
   data-content="${title}"><div class="text-box"><span class="label ${label}">x</span><p>${title}</p>
   <span class="date"><i class="ico-clock"></i> ${date} </span></div></a></div>`;
const cc = parseChuncheon(card(119, '시티투어', 'progress', '2026-09-30 ~ 2026-11-29') + card(131, '기부런', 'expected', '2026-11-14') + card(31, '책나라', 'complete', '2026-05-01 ~ 2026-05-17'));
assert.deepEqual(cc.map(e => [e.id, e.start, e.end]), [['ev-cc-119', '2026-09-30', '2026-11-29'], ['ev-cc-131', '2026-11-14', '2026-11-14']]);

const cell = (d, ...ts) => `<a href="?selday=${d}&amp;smonth=2026-11#t" class="a1">${ts.map(t => `<span class="a1t1" data-gubun="축제"><em>축제</em>${t}</span>`).join('')}</a>`;
const sc = parseSamcheok(cell(6, '너와포차') + cell(7, '너와포차', '시네마') + cell(9, '너와포차') + cell(30, 'x').replace('2026-11', '2026-10'), '2026-11');
assert.deepEqual(sc.map(e => [e.title, e.start, e.end]), [['너와포차', '2026-11-06', '2026-11-07'], ['너와포차', '2026-11-09', '2026-11-09'], ['시네마', '2026-11-07', '2026-11-07']]);
console.log('events ok');

// 공공데이터 API 항목 변환
import { fromTour, fromChuncheonApi, fromSamcheokContest } from './events.mjs';
const t = fromTour({ contentid: '2853386', title: '2026 단단단페스티벌', eventstartdate: '20261126', eventenddate: '20261128', lDongSignguCd: '150', lclsSystm2: 'EV02', lclsSystm3: 'EV020100', addr1: '강릉시 단오장길 1', tel: '033-641-1593' },
  { eventplace: '강릉단오제전수교육관 일원', usetimefestival: '무료' }, { homepage: '<a href="https://example.org/fest" target="_blank">홈</a>' });
assert.deepEqual([t.id, t.region, t.start, t.end, t.category, t.place, t.fee, t.url], ['ev-tour-2853386', '강릉', '2026-11-26', '2026-11-28', '전통공연', '강릉단오제전수교육관 일원', '무료', 'https://example.org/fest']);
assert.match(fromTour({ contentid: '1', title: '축제 A', eventstartdate: '20261201', eventenddate: '20261201', lDongSignguCd: '999' }).url, /visitkorea.*keyword=/);
assert.equal(fromChuncheonApi({ eventNo: 3, eventNm: '공연', startDate: '2022-03-03', endDate: '2022-03-03', charge: '무료' }, 'ev').fee, '무료');
assert.equal(fromSamcheokContest({ 대회명: '스토브리그', 대회시작일: '2023-01-09', 대회마감일: '2023-02-03' }).end, '2023-02-03');
console.log('events api ok');

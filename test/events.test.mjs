import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChuncheonEvents, parseSamcheokEvents, samcheokEventDays } from '../src/parse-events.mjs';
import { visibleItems } from '../dist/feed.mjs';

test('춘천 공식 축제 목록에서 행사 일정과 원문 주소를 읽는다', () => {
  const html = '<div class="photo-list"><div class="box"><a href="/tour/festival-event/main/view/?tourEventId=131"><div class="text-box"><p>춘천 기부런</p><span class="date">2026-11-14</span></div></a></div></div>';
  const [item] = parseChuncheonEvents(html);
  assert.equal(item.region, '춘천');
  assert.equal(item.startAt, '2026-11-14');
  assert.match(item.url, /tourEventId=131/);
});

test('삼척 달력에서 날짜별 행사를 읽고 기간을 해석한다', () => {
  const calendar = '<a class="schedule1opener" href="?selday=6&smonth=2026-11">행사</a><a class="schedule1opener" href="?selday=6&smonth=2026-11">반복</a>';
  assert.deepEqual(samcheokEventDays(calendar), ['6']);
  const html = '<ul class="schedule1list1"><li><span class="text"><strong class="t1">너와포차거리</strong><span class="wrap1t2"><span class="t2">기간 : 2026.11.06 ~ 2026.11.07</span></span></span><div class="schedule1list1c">장소 : 삼척해변</div></li></ul>';
  const [item] = parseSamcheokEvents(html, 'https://www.stcf.or.kr/01298/01402.web?smonth=2026-11&selday=6');
  assert.equal(item.startAt, '2026-11-06');
  assert.equal(item.endAt, '2026-11-07');
  assert.match(item.body, /삼척해변/);
});

test('주민 화면은 가입 정보 없이 선택 지역의 유효한 행사만 보여준다', () => {
  const notices = [{ id: 'school', title: '장학 공지', campuses: ['춘천'], postedAt: '2026-11-05' }];
  const events = [
    { id: 'c', kind: 'local-event', region: '춘천', title: '춘천 행사', startAt: '2026-11-06', endAt: '2026-11-06' },
    { id: 's', kind: 'local-event', region: '삼척', title: '삼척 행사', startAt: '2026-11-07', endAt: '2026-11-07' },
    { id: 'old', kind: 'local-event', region: '춘천', title: '지난 행사', startAt: '2026-10-01', endAt: '2026-10-02' }
  ];
  const options = { audience: 'resident', campus: '춘천', query: '', sourceMode: 'all', matchMode: 'all', today: '2026-11-05', matchNotice: () => { throw new Error('주민에게 학사 조건을 조회하면 안 됩니다'); } };
  assert.deepEqual(visibleItems(notices, events, options).map((item) => item.id), ['c']);
  assert.deepEqual(visibleItems(notices, events, { ...options, audience: 'student', sourceMode: 'all' }).map((item) => item.id), ['c', 'school']);
});

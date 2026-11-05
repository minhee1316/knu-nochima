import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSchoolListLive, normalizeTourEvents, normalizeChuncheonApi, normalizeSamcheokCompetitionApi, parseChuncheonLive, samcheokDaysLive, parseSamcheokLive } from '../src/live-feed.mjs';

test('춘천 공공 API는 유효한 현재 일정만 지역 행사로 채택한다', () => {
  const rows = normalizeChuncheonApi({ data: [
    { cultureNo: '1', cultureNm: '가을 문화제', startDate: '20261101', endDate: '20261108', site: '춘천시청 앞' },
    { cultureNo: '2', cultureNm: '지난 축제', startDate: '20241001', endDate: '20241002' },
    { cultureNo: '3', cultureNm: '잘못된 날짜', startDate: '20261350', endDate: '20261351' }
  ] }, 'culture', '2026-11-05');
  assert.deepEqual(rows.map((item) => item.title), ['가을 문화제']);
  assert.equal(rows[0].source, '춘천시 문화축제 API');
  assert.equal(rows[0].endAt, '2026-11-08');
});

test('삼척 전국대회 API의 지난 자료는 현재 행사에 표시하지 않는다', () => {
  const items = normalizeSamcheokCompetitionApi({ data: [
    { 연번: 1, 대회명: '지난 대회', 대회시작일: '2024-06-01', 대회마감일: '2024-06-02' },
    { 연번: 2, 대회명: '예정 대회', 대회시작일: '2026-11-10', 대회마감일: '2026-11-11' }
  ] }, '2026-11-05');
  assert.deepEqual(items.map((item) => item.title), ['예정 대회']);
});

test('학교 공지 갱신은 대상 캠퍼스의 목록 정보만 읽는다', () => {
  const html = `<table><tbody>
    <tr><td><span class="label-status campus" aria-label="삼척">삼척</span></td><td><a href="/ko/bbs/504/detail.do?pstSn=11618&amp;pageIndex=1">삼척 행사</a></td><td>2026.11.05</td></tr>
    <tr><td><span class="label-status campus" aria-label="강릉">강릉</span></td><td><a href="/ko/bbs/504/detail.do?pstSn=11619">강릉 행사</a></td><td>2026.11.05</td></tr>
    <tr><td><span class="photo-chip">ALL</span></td><td><a href="/ko/bbs/504/detail.do?pstSn=11620">전체 행사</a></td><td>2026.11.05</td></tr>
  </tbody></table>`;
  const items = parseSchoolListLive(html, { key: 'general', name: '일반공지', path: '504' });
  assert.deepEqual(items.map((item) => item.id), ['general:11618', 'general:11620']);
  assert.equal(items[0].postedAt, '2026-11-05');
  assert.equal(items[0].body, '');
  assert.deepEqual(items[1].campuses, ['전체']);
});

test('TourAPI 행사에서 춘천·삼척의 남은 일정만 표시한다', () => {
  const items = normalizeTourEvents([
    { contentid: '1', addr1: '강원특별자치도 춘천시 중앙로 1', title: '춘천 문화행사', eventstartdate: '20261101', eventenddate: '20261115' },
    { contentid: '2', addr1: '강원특별자치도 삼척시 대학로 2', title: '삼척 축제', eventstartdate: '20261106', eventenddate: '20261109' },
    { contentid: '3', addr1: '강원특별자치도 강릉시 3', title: '다른 지역', eventstartdate: '20261106', eventenddate: '20261109' },
    { contentid: '4', addr1: '강원특별자치도 춘천시 4', title: '지난 행사', eventstartdate: '20261001', eventenddate: '20261003' }
  ], '2026-11-05');
  assert.deepEqual(items.map((item) => item.id), ['tour:1', 'tour:2']);
  assert.deepEqual(items.map((item) => item.region), ['춘천', '삼척']);
});

test('춘천 공식 목록의 행사 원문과 기간을 읽는다', () => {
  const html = `<div class="photo-list"><div class="box"><a href="/tour/festival-event/main/view/?tourEventId=119"><div class="photo-box"><img alt=""></div><div class="text-box"><p>춘천 시티투어 가을마중투어</p><span class="date">2026-09-30 ~ 2026-11-29</span></div></a></div></div>`;
  const [event] = parseChuncheonLive(html);
  assert.equal(event.id, 'event:chuncheon:119');
  assert.equal(event.endAt, '2026-11-29');
  assert.match(event.url, /tourEventId=119/);
});

test('삼척 공식 달력의 행사 날짜와 제목을 읽는다', () => {
  const calendar = `<a href="?selday=6&amp;smonth=2026-11#timetable1schedule1" class="a1 schedule1opener">행사</a>`;
  const detail = `<li class="li1"><span class="time"><b class="t1" title="날짜">06</b><em class="t2" title="년월">2026-11</em></span><span class="text"><strong class="t1">2026 너와포차거리</strong><span class="wrap1t2"><span class="t2">기간 : 2026.11.06 ~ 2026.11.07</span></span></span></li>`;
  assert.deepEqual(samcheokDaysLive(calendar), ['6']);
  const [event] = parseSamcheokLive(detail, 'https://www.stcf.or.kr/01298/01402.web?smonth=2026-11&selday=6');
  assert.equal(event.title, '2026 너와포차거리');
  assert.equal(event.startAt, '2026-11-06');
  assert.equal(event.endAt, '2026-11-07');
});

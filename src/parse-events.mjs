import { load } from 'cheerio';

const CHUNCHEON_BASE = 'https://www.chuncheon.go.kr';
const SAMCHEOK_CALENDAR = 'https://www.stcf.or.kr/01298/01402.web';
const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const iso = (value) => {
  const match = String(value || '').match(/(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
};

export function parseChuncheonEvents(html) {
  const $ = load(html);
  return $('.photo-list .box a[href*="tourEventId="]').map((_, element) => {
    const link = $(element);
    const url = new URL(link.attr('href'), CHUNCHEON_BASE);
    const dates = clean(link.find('.date').text()).match(/20\d{2}-\d{2}-\d{2}/g) || [];
    const id = url.searchParams.get('tourEventId');
    if (!id || !dates.length) return null;
    return {
      id: `event:chuncheon:${id}`, kind: 'local-event', region: '춘천', board: '지역 행사',
      title: clean(link.find('.text-box p').text()), startAt: dates[0], endAt: dates.at(-1),
      source: '춘천여행ON', url: url.href,
      body: '춘천시 관광포털에 등록된 행사입니다. 참가 대상과 자세한 일정은 원문에서 확인하세요.'
    };
  }).get().filter((item) => item?.title);
}

export function samcheokEventDays(html) {
  const $ = load(html);
  return [...new Set($('.schedule1opener[href*="selday="]').map((_, element) => {
    const href = $(element).attr('href') || '';
    return new URL(href, SAMCHEOK_CALENDAR).searchParams.get('selday');
  }).get().filter(Boolean))];
}

export function parseSamcheokEvents(html, dayUrl) {
  const $ = load(html);
  return $('.schedule1list1 li').map((_, element) => {
    const row = $(element);
    const title = clean(row.find('.text strong.t1').first().text());
    const period = clean(row.find('.wrap1t2 .t2').first().text());
    const dates = period.match(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/g) || [];
    const fallback = `${clean(row.find('.time .t2').text())}-${clean(row.find('.time .t1').text())}`;
    const startAt = iso(dates[0] || fallback);
    const endAt = iso(dates.at(-1) || fallback);
    if (!title || !startAt) return null;
    const body = clean(row.find('.schedule1list1c').text());
    return {
      id: `event:samcheok:${startAt}:${title}`, kind: 'local-event', region: '삼척', board: '지역 행사',
      title, startAt, endAt, source: '삼척관광문화재단', url: dayUrl,
      body: body || '삼척관광문화재단 행사 달력에서 자세한 내용을 확인하세요.'
    };
  }).get().filter(Boolean);
}

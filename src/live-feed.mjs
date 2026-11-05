const cleanText = (value) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\s+/g, ' ').trim();

export function parseSchoolListLive(html, board) {
  const items = [];
  for (const [row] of String(html).matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
    const anchor = row.match(new RegExp(`<a\\b[^>]*href="([^"]*\\/ko\\/bbs\\/${board.path}\\/detail\\.do\\?pstSn=[^"]*)"[^>]*>([\\s\\S]*?)<\\/a>`, 'i'));
    if (!anchor) continue;
    const url = new URL(anchor[1].replaceAll('&amp;', '&'), 'https://www.kangwon.ac.kr');
    const postId = url.searchParams.get('pstSn');
    const postedAt = row.match(/20\d{2}\.\d{2}\.\d{2}/)?.[0].replaceAll('.', '-') || '';
    const campuses = [...row.matchAll(/class="[^"]*label-status\s+campus[^"]*"[^>]*aria-label="([^"]+)"/gi)].map((m) => cleanText(m[1]));
    if (/class="[^"]*photo-chip[^"]*"[^>]*>\s*ALL\s*</i.test(row)) campuses.push('전체');
    if (!postId || !postedAt || !campuses.some((value) => ['전체', '춘천', '삼척'].includes(value))) continue;
    items.push({
      id: `${board.key}:${postId}`, postId, board: board.name, title: cleanText(anchor[2]),
      campuses: [...new Set(campuses)], postedAt,
      url: `https://www.kangwon.ac.kr/ko/bbs/${board.path}/detail.do?pstSn=${encodeURIComponent(postId)}`,
      body: '', originalLinks: [], images: [], contentType: 'empty'
    });
  }
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

const isoTourDate = (value) => /^\d{8}$/.test(String(value || ''))
  ? `${String(value).slice(0, 4)}-${String(value).slice(4, 6)}-${String(value).slice(6, 8)}` : '';

export function normalizeTourEvents(items, today) {
  return (Array.isArray(items) ? items : items ? [items] : []).flatMap((entry) => {
    const address = String(entry.addr1 || '');
    const region = /(?:^|\s)춘천시(?:\s|$)/.test(address) ? '춘천' : /(?:^|\s)삼척시(?:\s|$)/.test(address) ? '삼척' : '';
    const startAt = isoTourDate(entry.eventstartdate);
    const endAt = isoTourDate(entry.eventenddate);
    if (!region || !startAt || !endAt || endAt < today || !entry.contentid) return [];
    return [{
      id: `tour:${entry.contentid}`, kind: 'local-event', region, board: '지역 행사',
      title: String(entry.title || '').trim(), startAt, endAt, source: '한국관광공사 TourAPI',
      address, tel: String(entry.tel || '').trim(),
      body: [address, entry.tel].filter(Boolean).join('\n'),
      url: 'https://korean.visitkorea.or.kr/'
    }];
  }).filter((item) => item.title);
}

const isoCityDate = (value) => {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (!/^20\d{6}$/.test(digits)) return '';
  const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date ? date : '';
};

export function normalizeChuncheonApi(payload, type, today) {
  const root = payload?.response || payload;
  const data = root?.data || root?.body?.items?.item || [];
  const rows = Array.isArray(data) ? data : Array.isArray(data?.item) ? data.item : data && typeof data === 'object' ? [data] : [];
  return rows.flatMap((entry) => {
    const festival = type === 'culture';
    const title = cleanText(festival ? entry.cultureNm : entry.eventNm);
    const startAt = isoCityDate(entry.startDate);
    const endAt = isoCityDate(entry.endDate) || startAt;
    if (!title || !startAt || endAt < today || endAt < startAt) return [];
    const official = String(entry.homepage || '').trim();
    const url = /^https?:\/\//i.test(official) ? official : festival
      ? 'https://www.data.go.kr/data/15112147/openapi.do'
      : 'https://www.data.go.kr/data/15112146/openapi.do';
    const place = cleanText(entry.site || entry.newAddr);
    return [{
      id: `chuncheon-api:${type}:${festival ? entry.cultureNo : entry.eventNo || title}:${startAt}`,
      kind: 'local-event', region: '춘천', board: festival ? '문화축제' : '공연행사', title,
      startAt, endAt, source: festival ? '춘천시 문화축제 API' : '춘천시 공연행사 API',
      url, body: [place, cleanText(entry.info), cleanText(entry.feeInfo)].filter(Boolean).join('\n'),
      address: place, tel: cleanText(entry.telno)
    }];
  });
}

export function normalizeSamcheokCompetitionApi(payload, today) {
  return (Array.isArray(payload?.data) ? payload.data : []).flatMap((entry) => {
    const title = cleanText(entry['대회명']);
    const startAt = isoCityDate(entry['대회시작일']);
    const endAt = isoCityDate(entry['대회마감일']) || startAt;
    if (!title || !startAt || endAt < today || endAt < startAt) return [];
    const homepage = String(entry['홈페이지주소'] || '').trim();
    const place = cleanText(entry['장소'] || entry['주소']);
    return [{
      id: `samcheok-competition:${entry['연번'] || title}:${startAt}`,
      kind: 'local-event', region: '삼척', board: '지역 대회', title, startAt, endAt,
      source: '삼척시 전국대회 API',
      url: /^https?:\/\//i.test(homepage) ? homepage : 'https://www.data.go.kr/data/15027891/fileData.do',
      body: [place, cleanText(entry['주최']), cleanText(entry['문의처'])].filter(Boolean).join('\n'),
      address: place
    }];
  });
}

export function parseChuncheonLive(html) {
  const results = [];
  const pattern = /<a\b[^>]*href="([^"]*tourEventId=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const [, href, block] of String(html).matchAll(pattern)) {
    const url = new URL(href.replaceAll('&amp;', '&'), 'https://www.chuncheon.go.kr');
    const id = url.searchParams.get('tourEventId');
    const title = cleanText(block.match(/<div\s+class="text-box"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]);
    const dates = block.match(/20\d{2}-\d{2}-\d{2}/g) || [];
    if (!id || !title || !dates.length) continue;
    results.push({ id: `event:chuncheon:${id}`, kind: 'local-event', region: '춘천', board: '지역 행사',
      title, startAt: dates[0], endAt: dates.at(-1), source: '춘천여행ON', url: url.href,
      body: '춘천시 관광포털에 등록된 행사입니다. 참가 대상과 자세한 일정은 원문에서 확인하세요.' });
  }
  return [...new Map(results.map((item) => [item.id, item])).values()];
}

export function samcheokDaysLive(html) {
  const days = [];
  for (const [tag] of String(html).matchAll(/<a\b[^>]*class="[^"]*schedule1opener[^"]*"[^>]*>/gi)) {
    const href = tag.match(/href="([^"]+)"/i)?.[1];
    if (href) {
      const day = new URL(href.replaceAll('&amp;', '&'), 'https://www.stcf.or.kr').searchParams.get('selday');
      if (day) days.push(day);
    }
  }
  return [...new Set(days)];
}

export function parseSamcheokLive(html, dayUrl) {
  const results = [];
  for (const [row] of String(html).matchAll(/<li\b[^>]*class="[^"]*li1[^"]*"[^>]*>[\s\S]*?<\/li>/gi)) {
    const title = cleanText(row.match(/<strong\b[^>]*class="[^"]*t1[^"]*"[^>]*>([\s\S]*?)<\/strong>/i)?.[1]);
    const period = cleanText(row.match(/<span\b[^>]*class="[^"]*wrap1t2[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    const dates = [...period.matchAll(/(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/g)]
      .map((match) => `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`);
    const month = row.match(/<em\b[^>]*class="[^"]*t2[^"]*"[^>]*title="년월"[^>]*>(20\d{2}-\d{2})<\/em>/i)?.[1];
    const day = row.match(/<b\b[^>]*class="[^"]*t1[^"]*"[^>]*title="날짜"[^>]*>(\d{1,2})<\/b>/i)?.[1];
    const fallback = month && day ? `${month}-${day.padStart(2, '0')}` : '';
    const startAt = dates[0] || fallback;
    const endAt = dates.at(-1) || fallback;
    if (!title || !startAt) continue;
    results.push({ id: `event:samcheok:${startAt}:${title}`, kind: 'local-event', region: '삼척', board: '지역 행사',
      title, startAt, endAt, source: '삼척관광문화재단', url: dayUrl,
      body: '삼척관광문화재단 행사 달력에서 자세한 내용을 확인하세요.' });
  }
  return [...new Map(results.map((item) => [item.id, item])).values()];
}

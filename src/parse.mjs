import { load } from 'cheerio';

export const BASE_URL = 'https://www.kangwon.ac.kr';
export const BOARD_PATH = '/ko/bbs/504';
export const BOARDS = [
  { key: 'general', name: '일반공지', path: '/ko/bbs/504' },
  { key: 'campus-event', name: '행사안내', path: '/ko/bbs/715' },
  { key: 'contest', name: '공모안내', path: '/ko/bbs/719' },
  { key: 'scholarship', name: '장학공지', path: '/ko/bbs/721' }
];

const compact = (value) => value.replace(/\s+/g, ' ').trim();

export function parseList(html, board = BOARDS[0]) {
  const $ = load(html);
  const posts = [];

  $('tr').each((_, element) => {
    const row = $(element);
    const link = row.find(`a[href*="${board.path}/detail.do?pstSn="]`).first();
    if (!link.length) return;

    const href = link.attr('href')?.replaceAll('&amp;', '&');
    if (!href) return;
    const url = new URL(href, BASE_URL);
    const postId = url.searchParams.get('pstSn');
    if (!postId) return;

    const campuses = row.find('.label-status.campus').map((_, item) =>
      compact($(item).attr('aria-label') || $(item).text())
    ).get().filter(Boolean);
    if (row.find('.photo-chip').text().trim() === 'ALL') campuses.push('전체');

    const cells = row.find('td');
    const date = cells.map((_, cell) => compact($(cell).text())).get()
      .find((text) => /^\d{4}\.\d{2}\.\d{2}$/.test(text)) || '';

    posts.push({
      id: `${board.key}:${postId}`,
      postId,
      board: board.name,
      title: compact(link.text()),
      campuses: [...new Set(campuses)],
      postedAt: date.replaceAll('.', '-'),
      url: `${BASE_URL}${board.path}/detail.do?pstSn=${encodeURIComponent(postId)}`
    });
  });

  return [...new Map(posts.map((post) => [post.id, post])).values()];
}

export function matchesScope(post) {
  return post.campuses.some((campus) =>
    campus === '전체' || campus === '춘천' || campus === '삼척'
  );
}

export function parseDetail(html) {
  const $ = load(html);
  const editor = $('.info-editor-area .editor-wrap').first();
  if (!editor.length) throw new Error('공지 본문 영역을 찾지 못했습니다.');

  editor.find('script, style').remove();
  editor.find('br').replaceWith('\n');
  editor.find('p, div, li').each((_, item) => $(item).append('\n'));
  const body = editor.text()
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(compact)
    .filter(Boolean)
    .join('\n');

  const originalLinks = editor.find('a[href]').map((_, item) => {
    const href = $(item).attr('href');
    try { return new URL(href, BASE_URL).href; } catch { return null; }
  }).get().filter(Boolean);

  const images = editor.find('img[src]').map((_, item) => {
    const src = $(item).attr('src');
    try {
      return { url: new URL(src, BASE_URL).href, alt: compact($(item).attr('alt') || '') };
    } catch { return null; }
  }).get().filter(Boolean);

  return {
    body,
    originalLinks: [...new Set(originalLinks)],
    images,
    contentType: body ? (images.length ? 'text-and-image' : 'text') : (images.length ? 'image' : 'empty')
  };
}

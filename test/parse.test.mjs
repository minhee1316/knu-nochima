import test from 'node:test';
import assert from 'node:assert/strict';
import { parseList, matchesScope, parseDetail } from '../src/parse.mjs';

test('춘천·삼척·전체 공지를 구별하고 글 고유번호를 읽는다', () => {
  const html = `<table><tbody>
    <tr><td>1</td><td><span class="label-status campus" aria-label="삼척">삼척</span></td><td><a href="/ko/bbs/504/detail.do?pstSn=11618&amp;pageIndex=1">삼척 공지</a></td><td>2026.11.05</td></tr>
    <tr><td>2</td><td><span class="label-status campus" aria-label="강릉">강릉</span></td><td><a href="/ko/bbs/504/detail.do?pstSn=11619">강릉 공지</a></td><td>2026.11.05</td></tr>
    <tr><td>3</td><td><span class="photo-chip">ALL</span></td><td><a href="/ko/bbs/504/detail.do?pstSn=11620">전체 공지</a></td><td>2026.11.05</td></tr>
  </tbody></table>`;
  const posts = parseList(html);
  assert.equal(posts.length, 3);
  assert.equal(posts[0].id, 'general:11618');
  assert.equal(posts[0].postedAt, '2026-11-05');
  assert.deepEqual(posts.filter(matchesScope).map((post) => post.postId), ['11618', '11620']);
});

test('공지 상세 본문과 신청 링크를 읽는다', () => {
  const detail = parseDetail(`<div class="info-editor-area"><div class="editor-wrap"><p>대상: 재학생</p><p>신청: <a href="https://example.org/apply">바로가기</a></p></div></div>`);
  assert.match(detail.body, /대상: 재학생/);
  assert.match(detail.body, /신청: 바로가기/);
  assert.deepEqual(detail.originalLinks, ['https://example.org/apply']);
  assert.equal(detail.contentType, 'text');
});

test('이미지로 작성한 공지도 이미지 주소와 설명을 보존한다', () => {
  const detail = parseDetail(`<div class="info-editor-area"><div class="editor-wrap"><img alt="행사 안내" src="/ckeditorImgfile.do?dn=test.png"></div></div>`);
  assert.equal(detail.body, '');
  assert.equal(detail.contentType, 'image');
  assert.deepEqual(detail.images, [{ url: 'https://www.kangwon.ac.kr/ckeditorImgfile.do?dn=test.png', alt: '행사 안내' }]);
});

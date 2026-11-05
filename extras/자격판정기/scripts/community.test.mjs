// 커뮤니티(네이버 검색 API) 정규화·매칭 테스트 — 응답 필드: title, link, description, postdate(블로그), cafename, bloggername
import assert from 'node:assert/strict';
import { clean, coreWords, toPost, toKakaoPost, mentions, discover } from './community.mjs';

assert.equal(clean('<b>강원대</b> 장학금 &amp; 공모전'), '강원대 장학금 & 공모전');
assert.deepEqual(coreWords('[춘천] 2026년 강원대학교 사랑의 연탄 나눔 봉사활동 참가자 모집'), ['사랑', '연탄', '나눔', '봉사활동']);
assert.deepEqual(coreWords('장학금 안내'), ['장학금']);

const p = toPost('blog', { title: '<b>연탄</b> 나눔 봉사 다녀왔어요', link: 'https://blog.example/1', description: '강원대 <b>사랑의 연탄</b> 나눔 후기', postdate: '20261101', bloggername: '곰' });
assert.equal(p.src, '네이버 블로그'); assert.equal(p.date, '2026-11-01'); assert.equal(p.title, '연탄 나눔 봉사 다녀왔어요');
const other = toPost('kin', { title: '연탄 가격 질문', link: 'https://kin.example/2', description: '연탄 보일러' });
const n = { title: '[춘천] 2026년 강원대학교 사랑의 연탄 나눔 봉사활동 참가자 모집' };
assert.deepEqual(mentions(n, [p, other]).map(x => x.link), ['https://blog.example/1'], '단어 하나만 겹치는 글은 제외');
assert.deepEqual(mentions({ title: '장학금 안내' }, [p]), [], '핵심 단어가 하나뿐인 공지는 매칭 안 함');

const T = '2026-11-06';
const posts = [
  toPost('blog', { title: '2026 ○○재단 장학생 모집 공고 정리', link: 'L1', description: '대학생 대상', postdate: '20261103' }),
  toPost('blog', { title: '2026 ○○재단 장학생 모집 공고 정리', link: 'L1b', description: '중복', postdate: '20261104' }),
  toPost('blog', { title: '오늘 맛집 후기', link: 'L2', description: '', postdate: '20261105' }),
  toPost('blog', { title: '대학생 공모전 모집 모음', link: 'L3', description: '', postdate: '20260901' }),
  toPost('cafearticle', { title: '장학생 모집 질문', link: 'L4', description: '' })
];
const d = discover(posts, new Set(), T);
assert.deepEqual(d.map(x => x.url), ['L1'], '모집 글·30일 이내·날짜 있음·중복 제거');
assert.equal(d[0].kind, 'community'); assert.equal(d[0].type, '장학금'); assert.equal(d[0].deadline, '');
assert.deepEqual(discover(posts, new Set(['L1', 'L1b']), T), [], '이미 공지에 붙은 글은 새 기회로 안 넣음');
const kp = toKakaoPost('cafe', { title: '<b>연탄</b> 나눔 후기', contents: '강원대 <b>사랑의 연탄</b> 나눔', url: 'https://cafe.daum.net/x', cafename: '강원대 카페', datetime: '2026-11-02T10:00:00.000+09:00' });
assert.deepEqual([kp.src, kp.date, kp.title, kp.by], ['다음 카페', '2026-11-02', '연탄 나눔 후기', '강원대 카페']);
assert.equal(mentions(n, [kp]).length, 1);
console.log('community tests ok');

// 공공 API 활용신청 승인 전 시연용 '예시' 원본 — 실제 공고가 아니다.
// 각 API의 응답 필드 모양 그대로 만들어 gov.mjs의 같은 변환기(fromKosaf 등)를 통과시킨다.
// 제목은 [예시]로 시작하고, 링크는 해당 API의 공공데이터포털 소개 페이지로만 건다(없는 공고 페이지를 만들지 않음).
// 승인이 나서 그 출처가 실제로 응답하면 예시는 자동으로 빠진다(gov.mjs).
const day = (today, n) => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const d8 = (today, n) => day(today, n).replace(/-/g, '');

export const SAMPLE_RAW = today => ({
  한국장학재단: [
    { 번호: 'S1', 운영기관명: '(예시) ○○장학재단', 운영기관구분: '민간', 상품명: '[예시] 성적우수 장학금 — API 연동 시연용', 학년구분: '대학2학년,대학3학년,대학4학년',
      '성적기준 상세내용': '직전학기 평점평균 3.5점 이상', '소득기준 상세내용': '학자금 지원구간 8구간 이하', '지역거주여부 상세내용': '해당없음',
      '지원내역 상세내용': '학기당 200만원 (예시)', '제출서류 상세내용': '재학증명서, 성적증명서', 모집시작일: day(today, -3), 모집종료일: day(today, 14),
      '홈페이지 주소': 'https://www.data.go.kr/data/15028252/fileData.do' },
    { 번호: 'S2', 운영기관명: '(예시) 강원 인재육성 기관', 운영기관구분: '지자체', 상품명: '[예시] 강원 거주 대학생 생활비 장학 — API 연동 시연용', 학년구분: '',
      '소득기준 상세내용': '학자금 지원구간 6구간 이하', '지역거주여부 상세내용': '강원특별자치도 거주', '지원내역 상세내용': '생활비 100만원 (예시)',
      '제출서류 상세내용': '주민등록등본, 재학증명서', 모집시작일: day(today, 0), 모집종료일: day(today, 21), '홈페이지 주소': 'https://www.data.go.kr/data/15028252/fileData.do' }
  ],
  보조금24: [
    { 서비스ID: 'S-G1', 서비스명: '[예시] 청년 월세 지원 — API 연동 시연용', 소관기관명: '(예시) 강원특별자치도 삼척시', 지원대상: '삼척시 거주 만 19~34세 청년(대학생 포함)',
      지원내용: '월 최대 20만원 (예시)', 신청기한: `${day(today, 5)} ~ ${day(today, 30)}`, 서비스분야: '주거·자립', 신청방법: '온라인 신청 (예시)',
      상세조회URL: 'https://www.data.go.kr/data/15113968/openapi.do' },
    { 서비스ID: 'S-G2', 서비스명: '[예시] 대학생 교육비 지원 — API 연동 시연용', 소관기관명: '(예시) 강원특별자치도 춘천시', 지원대상: '춘천시 거주 대학생',
      지원내용: '등록금 일부 (예시)', 신청기한: `${day(today, 2)} ~ ${day(today, 18)}`, 서비스분야: '교육', 신청방법: '주민센터 방문 (예시)',
      상세조회URL: 'https://www.data.go.kr/data/15113968/openapi.do' }
  ],
  'K-Startup': [
    { pbanc_sn: 'S-K1', biz_pbanc_nm: '[예시] 대학생 창업 아이디어 경진대회 — API 연동 시연용', pbanc_ntrp_nm: '(예시) 창업 지원기관', pbanc_rcpt_bgng_dt: d8(today, -2),
      pbanc_rcpt_end_dt: d8(today, 20), supt_regin: '전국', aply_trgt: '대학생, 청년', rcrt_prgs_yn: 'Y', detl_pg_url: 'https://www.data.go.kr/data/15125364/openapi.do' }
  ],
  전국문화축제: [
    { fstvlNm: '[예시] 춘천 겨울 문화축제 — API 연동 시연용', opar: '(예시) 춘천 일대', fstvlStartDate: day(today, 10), fstvlEndDate: day(today, 12),
      fstvlCo: '예시 축제', rdnmadr: '강원특별자치도 춘천시 (예시)', homepageUrl: 'https://www.data.go.kr/data/15013104/standard.do' }
  ]
});

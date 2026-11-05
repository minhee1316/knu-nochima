// 보수적인 규칙 비교: 원문에 명시된 일부 조건만 판별한다.
const numeric = (value) => value === '' || value == null ? null : Number(value);
const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const rule = (field, min, evidence, label) => ({ field, min: Number(min), evidence: compact(evidence), label });

export function extractRules(notice) {
  const lines = String(notice.body || '').split(/\n+/).map(compact).filter(Boolean);
  const rules = [];
  const add = (field, pattern, label) => {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) { rules.push(rule(field, match[1], line, label)); break; }
    }
  };

  add('lastGpa', /직전\s*학기[^\n]{0,65}?(?:평점\s*평균|평균\s*평점)[^\d\n]{0,12}(\d(?:\.\d{1,2})?)\s*(?:점)?\s*이상/, '직전 학기 평점');
  add('cumulativeGpa', /(?:전체\s*학기|전체\s*평균)[^\n]{0,45}?(?:평점\s*평균|평균\s*평점)[^\d\n]{0,12}(\d(?:\.\d{1,2})?)\s*(?:점)?(?:\([^)]*\))?\s*이상/, '전체 평균평점');
  if (!rules.some((item) => item.field === 'cumulativeGpa')) add('cumulativeGpa', /총\s*평균\s*평점[^\d\n]{0,12}(\d(?:\.\d{1,2})?)\s*(?:점)?\s*이상/, '전체 평균평점');
  add('lastCredits', /직전\s*학기\s*(?:이수|취득)\s*학점\s*(\d{1,2}(?:\.\d)?)\s*학점\s*이상/, '직전 학기 이수학점');
  add('earnedCredits', /(?:총|전체)\s*(?:이수|취득)\s*학점\s*(\d{1,3}(?:\.\d)?)\s*학점\s*이상/, '총 취득학점');
  add('completedSemesters', /(?:정규\s*)?(\d{1,2})\s*학기\s*이상\s*이수/, '이수 학기 수');
  add('incomeBracket', /(?:학자금\s*지원\s*구간|소득\s*분위)[^\n]{0,20}?(\d{1,2})\s*(?:구간|분위)?\s*이하/, '학자금 지원구간');
  if (!rules.some((item) => item.field === 'incomeBracket')) add('incomeBracket', /(?:학자금\s*지원\s*구간|소득\s*분위)[^\n]{0,20}?\d{1,2}\s*구간\s*[~∼-]\s*(\d{1,2})\s*구간/, '학자금 지원구간');
  for (const line of lines) {
    const semesterRange = line.match(/(?:학부\s*)?(\d{1,2})\s*[~∼-]\s*(\d{1,2})\s*학기\s*(?:총|전체)?\s*(?:평균|성적|이수)/);
    if (semesterRange) { rules.push({ field: 'completedSemesters', min: Number(semesterRange[1]), max: Number(semesterRange[2]), evidence: line, label: '이수 학기 수' }); break; }
  }

  const eligibility = lines.filter((line) => /(?:신청\s*대상|지원\s*자격|자격\s*기준|지원\s*대상|선발\s*대상)/.test(line)).join(' ');
  const yearSemester = eligibility.match(/(\d)\s*학년\s*(1|2)\s*학기\s*(?:재학생|대상|에\s*재학)/);
  if (yearSemester) {
    rules.push({ field: 'year', expected: yearSemester[1], evidence: eligibility, label: '현재 학년' });
    rules.push({ field: 'currentSemester', expected: yearSemester[2], evidence: eligibility, label: '현재 학기' });
  }
  if (/(?:학부생만|학부생\s*한정|대학원생\s*제외)/.test(eligibility)) rules.push({ field: 'program', expected: '학부', evidence: eligibility, label: '학위 과정' });
  if (/(?:대학원생만|대학원생\s*한정)/.test(eligibility)) rules.push({ field: 'program', expected: '대학원', evidence: eligibility, label: '학위 과정' });
  if (/(?:재학생(?:만|에\s*한함|으로)|강원대학교\s*재학생)/.test(eligibility) && !/비재학생/.test(eligibility)) rules.push({ field: 'status', expected: '재학', evidence: eligibility, label: '학적 상태' });
  if (!rules.some((item) => item.field === 'status') && /강원대학교\s*재학생/.test(String(notice.body || ''))) rules.push({ field: 'status', expected: '재학', evidence: '강원대학교 재학생', label: '학적 상태' });
  return rules;
}

export function evaluateNotice(notice, profile) {
  if (!['장학공지', '공모안내'].includes(notice.board)) return { category: 'info', label: '일반 정보', matched: [], missing: [], failed: [], rules: [] };
  if (!profile?.campus) return { category: 'setup', label: '내 정보 설정', matched: [], missing: [], failed: [], rules: [] };

  const rules = extractRules(notice);
  const matched = [], missing = [], failed = [];
  if (!notice.campuses.includes('전체')) {
    if (notice.campuses.includes(profile.campus)) matched.push(`${profile.campus}캠퍼스 대상`);
    else failed.push(`캠퍼스 대상: ${notice.campuses.join('·')}`);
  }
  for (const item of rules) {
    const value = profile[item.field];
    if (value === '' || value == null) { missing.push(`${item.label} 입력 필요`); continue; }
    if ('expected' in item) {
      (value === item.expected ? matched : failed).push(`${item.label}: ${item.expected}`);
    } else {
      const n = numeric(value);
      if (!Number.isFinite(n)) { missing.push(`${item.label} 입력 필요`); continue; }
      if (['lastGpa', 'cumulativeGpa'].includes(item.field) && /4\.5\s*만점/.test(item.evidence) && profile.gpaScale !== '4.5') {
        missing.push(`${item.label}: 평점 만점 기준 확인`);
        continue;
      }
      const passes = item.field === 'incomeBracket' ? n <= item.min : n >= item.min && (item.max == null || n <= item.max);
      const criterion = item.max != null ? `${item.min}~${item.max}` : item.field === 'incomeBracket' ? `${item.min}구간 이하` : `${item.min} 이상`;
      (passes ? matched : failed).push(`${item.label} ${criterion}`);
    }
  }
  if (!notice.body) missing.push('이미지·첨부 원문 확인');
  if (failed.length) return { category: 'mismatch', label: '조건 불일치', matched, missing, failed, rules };
  const academicMatches = matched.filter((text) => !text.includes('캠퍼스 대상'));
  if (academicMatches.length && !missing.length) return { category: 'candidate', label: '추천 후보', matched, missing, failed, rules };
  return { category: 'check', label: '추가 확인', matched, missing, failed, rules };
}

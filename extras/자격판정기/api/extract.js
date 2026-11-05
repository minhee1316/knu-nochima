// 공지 원문(텍스트/이미지) → Gemini가 지원 조건을 JSON으로 추출 → 서버에서 검증·정규화
// Vercel 서버리스 함수(/api/extract). API 키는 환경변수 GEMINI_API_KEY에만 둔다(브라우저 코드에 넣지 않음).
import { TAGS } from '../lib/tags.js';
import { limit, tooMany, reqIp } from '../lib/ratelimit.js';

export const CAMPUS = ['춘천', '삼척', '도계', '강릉', '원주'];
export const GRADE = ['1', '2', '3', '4'];
export const COLLEGE = ['인문·사회', '자연과학', '공학·IT', '보건·의료', '예술·체육'];
export const RES = ['자취', '기숙사', '통학'];
export const STATUS = ['내국인', '유학생'];
export const TYPES = ['장학금', '비교과', '공모전', '공지'];
const LISTS = { campus: CAMPUS, grade: GRADE, college: COLLEGE, residence: RES, status: STATUS };
const KEYS = [...Object.keys(LISTS), 'minGpa', 'maxIncome'];
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const enumArr = e => ({ type: 'ARRAY', items: { type: 'STRING', enum: e } });
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: TYPES },
    title: { type: 'STRING' },
    org: { type: 'STRING', description: '주관 부서·기관' },
    amount: { type: 'INTEGER', description: '1인당 지원 금액(원). 금액이 없거나 불명확하면 0' },
    deadline: { type: 'STRING', description: '신청 마감일 YYYY-MM-DD. 없으면 빈 문자열' },
    campus: enumArr(CAMPUS), grade: enumArr(GRADE), college: enumArr(COLLEGE),
    residence: enumArr(RES), status: enumArr(STATUS),
    minGpa: { type: 'NUMBER', nullable: true, description: '최소 평점(4.5 만점 기준)' },
    maxIncome: { type: 'INTEGER', nullable: true, description: '학자금 지원구간 상한(0~10)' },
    unclear: enumArr(KEYS),
    docs: { type: 'ARRAY', items: { type: 'STRING' } },
    summary: { type: 'STRING', description: '한국어 3줄 요약(줄바꿈 구분): 대상 / 혜택·내용 / 신청 방법·기한' },
    tags: enumArr(TAGS)
  },
  required: ['type', 'title', 'org', 'amount', 'deadline', 'campus', 'grade', 'college', 'residence', 'status', 'minGpa', 'maxIncome', 'unclear', 'docs', 'summary', 'tags']
};

const prompt = today => `너는 강원대학교 공지에서 "지원 자격 조건"만 뽑아내는 도구다. 오늘은 ${today}이다.
규칙:
- 원문에 적힌 내용만 쓴다. 추측하지 않는다.
- 조건 목록(campus, grade, college, residence, status)이 원문에 없으면 빈 배열로 둔다(= 제한 없음).
- 조건이 있는 것 같지만 원문으로 확실히 알 수 없으면 그 키를 unclear에 넣는다. 예: "저소득층 우선"처럼 구간이 없으면 maxIncome을 unclear에 넣는다.
- 캠퍼스: 통합 강원대 캠퍼스는 춘천·삼척·도계·강릉·원주. "전 캠퍼스"나 언급이 없으면 빈 배열.
- 학년: "2학년 이상"이면 ["2","3","4"]. 신입생은 "1".
- 계열: 특정 학과만 대상이면 가장 가까운 계열을 넣고 college를 unclear에도 넣는다.
- 평점: 4.5 만점 기준 숫자. 백분율·4.3 만점이면 minGpa는 null, unclear에 minGpa를 넣는다.
- 소득: 한국장학재단 학자금 지원구간(0~10구간) 숫자만. "8구간 이하"면 8.
- 신분: "외국인 유학생" 대상이면 ["유학생"], "대한민국 국적"이면 ["내국인"].
- 종류: 장학금·근로장학=장학금, 공모전·경진대회·대회=공모전, 특강·캠프·프로그램·봉사·행사=비교과, 그 외 학사·일반 안내=공지.
- 마감일: 연도가 없으면 오늘 이후 가장 가까운 날짜로 YYYY-MM-DD. 신청·접수 기간의 마지막 날을 쓴다.
- docs: 제출 서류 이름만 짧게.
- summary: 3줄(대상 / 혜택·내용 / 신청 방법·기한), 줄마다 40자 이내. 원문에 없는 내용은 쓰지 않는다.
- tags: 관심 분야(${TAGS.join(', ')}) 중 해당하는 것만. 없으면 빈 배열.`;

// 무료 한도 보호: 한 사람(IP)당 분·하루 제한 + 서비스 전체 하루 제한(GEMINI_DAILY_CAP, AI Studio 한도보다 낮게)
const rules = env => [
  { name: 'ex-m', max: 5, sec: 60, msg: s => `요청이 너무 빨라요. ${s}초 뒤에 다시 시도해 주세요.` },
  { name: 'ex-d', max: 40, sec: 86400, msg: () => '오늘 AI 읽기 횟수(40회)를 다 썼어요. 내일 다시 시도해 주세요.' },
  { name: 'ex-all', max: Number(env.GEMINI_DAILY_CAP) || 500, sec: 86400, global: true, msg: () => '오늘 서비스 전체 AI 사용량이 다 찼어요. 내일 다시 시도하거나 원문을 직접 입력해 주세요.' }
];

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// 모델 출력은 믿지 않는다: 허용값만 남기고 범위를 벗어난 값은 버린다.
export function normalize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const unclear = Array.isArray(r.unclear) ? r.unclear.filter(k => KEYS.includes(k)) : [];
  const cond = {};
  for (const [k, allow] of Object.entries(LISTS)) {
    const v = Array.isArray(r[k]) ? [...new Set(r[k].map(String).filter(x => allow.includes(x)))] : [];
    cond[k] = unclear.includes(k) && !v.length ? 'unknown' : v.length ? v : null;
  }
  const g = Number(r.minGpa), inc = Number(r.maxIncome);
  cond.minGpa = unclear.includes('minGpa') ? 'unknown' : r.minGpa != null && g > 0 && g <= 4.5 ? g : null;
  cond.maxIncome = unclear.includes('maxIncome') ? 'unknown' : r.maxIncome != null && Number.isInteger(inc) && inc >= 0 && inc <= 10 ? inc : null;
  const amount = Number.isFinite(Number(r.amount)) && Number(r.amount) > 0 ? Math.round(Number(r.amount)) : 0;
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(r.deadline) && !isNaN(Date.parse(r.deadline)) ? r.deadline : '';
  return {
    type: TYPES.includes(r.type) ? r.type : '공지',
    title: str(r.title, 120) || '제목 없는 공지',
    org: str(r.org, 60) || '주관 미상',
    amount, deadline, cond,
    docs: Array.isArray(r.docs) ? r.docs.map(d => str(d, 60)).filter(Boolean).slice(0, 12) : [],
    summary: str(r.summary, 300),
    tags: Array.isArray(r.tags) ? [...new Set(r.tags.map(String).filter(t => TAGS.includes(t)))] : []
  };
}

export async function extract(body, env, method, ip) {
  const key = env.GEMINI_API_KEY;
  if (!key) return { status: 500, json: { error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' } };
  const text = str(body?.text, 20000);
  const img = body?.image;
  const hasImg = img && IMG_TYPES.includes(img.mime) && typeof img.data === 'string' && img.data.length < 6_000_000;
  if (!text && !hasImg) return { status: 400, json: { error: '공지 원문이나 이미지(JPG·PNG·WEBP)를 넣어 주세요.' } };
  const l = await limit(env, ip, rules(env));
  if (!l.ok) return tooMany(l);
  return analyze(text, hasImg ? img : null, env, key);
}

// Gemini 호출 + 정규화 (호출 횟수 제한 없음 — 수집 스크립트도 이걸 직접 쓴다)
export async function analyze(text, img, env, key = env.GEMINI_API_KEY) {
  const hasImg = !!img;
  const parts = [{ text: prompt(new Date().toISOString().slice(0, 10)) }];
  if (text) parts.push({ text: '공지 원문:\n' + text });
  if (hasImg) parts.push({ inline_data: { mime_type: img.mime, data: img.data } });

  const model = env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  let resp;
  try {
    resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA }
      }),
      signal: AbortSignal.timeout(30000)
    });
  } catch (e) {
    return { status: 504, json: { error: 'AI 응답이 늦어요. 잠시 후 다시 시도해 주세요.' } };
  }
  if (resp.status === 429) return { status: 429, json: { error: '무료 사용 한도를 넘었어요. 1분쯤 뒤에 다시 시도해 주세요.' } };
  if (resp.status === 404) return { status: 502, json: { error: `모델 "${model}"을 찾을 수 없어요. GEMINI_MODEL 환경변수를 확인하세요.` } };
  if (!resp.ok) return { status: 502, json: { error: `AI 호출 실패 (${resp.status})` } };

  const data = await resp.json();
  const out = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
  try {
    return { status: 200, json: { notice: normalize(JSON.parse(out)) } };
  } catch {
    return { status: 502, json: { error: 'AI가 읽을 수 없는 형식으로 답했어요. 다시 시도해 주세요.' } };
  }
}

// Vercel 진입점
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 지원합니다.' });
  const r = await extract(req.body, process.env, req.method, reqIp(req));
  for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);
  res.status(r.status).json(r.json);
}

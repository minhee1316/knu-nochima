// 정부·기관 지원사업 수집 → data/gov.json (build.mjs가 '정부·지역(교외)'로 공지 목록에 합친다)
// 참고: knu_platform_api_integration_guide.md. 브라우저에서 부르면 키가 드러나고 CORS에 막히므로 여기(빌드)에서만 부른다.
// 키: DATA_GO_KR_KEY(공공데이터포털) 하나로 부르지만 API마다 data.go.kr '활용신청' 승인이 필요하다.
//     승인 안 된 출처는 건너뛰고 이유를 기록한다(지어내지 않음). 온통청년은 별도 키 YOUTHCENTER_KEY.
// 실행: node scripts/gov.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tagsFor } from '../lib/tags.js';
import { SAMPLE_RAW } from './gov-samples.mjs';

const OTHER = /서울|부산|대구|인천|광주|대전|울산|세종|경기|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주/;
const HOME = /강원|춘천|삼척/;
const STUDENT = /대학생|대학교|재학생|청년|휴학생|대학원생|학생/;
const ymd = s => { const m = String(s || '').replace(/[^\d]/g, ' ').match(/(20\d{2})\s*(\d{1,2})\s*(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };
const lastDate = s => { const all = [...String(s || '').matchAll(/(20\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/g)]; const m = all.at(-1); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };
const regionOf = t => /춘천/.test(t) ? '춘천' : /삼척/.test(t) ? '삼척' : /강원/.test(t) ? '강원' : '전국';
const clip = (s, n = 160) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const COND0 = { campus: null, grade: null, college: null, residence: null, status: null, minGpa: null, maxIncome: null };
const item = o => ({ kind: 'gov', posted: '', amount: 0, docs: [], files: [], snippet: '', aiPending: false, cond: { ...COND0 }, ...o,
  tags: tagsFor(`${o.title} ${o.body || ''}`) });

// 한국장학재단 학자금지원정보(대학생): 장학 상품별 성적·소득·지역 기준과 모집기간 (공식 필드명, 2026-11 swagger 확인)
export function fromKosaf(r, today) {
  const end = ymd(r['모집종료일']), region = r['지역거주여부 상세내용'] || '';
  if (!end || end < today) return null; // 모집 끝난 상품은 뺀다
  if (/대학/.test(r['운영기관구분'] || '') && !/강원대/.test(r['운영기관명'] || '')) return null; // 다른 대학 자체 장학
  if (OTHER.test(region) && !HOME.test(region)) return null; // 다른 지역 거주자 전용
  // 거주 요건이 있으면 춘천·삼척·강원 전체·석탄산업전환지역(삼척 포함)일 때만 (횡성·군포·남원 등 다른 시·군 주민 전용 제외)
  if (/원주|강릉|태백|속초|홍천|횡성|영월|평창|화천|양구|양양|인제|정선|고성|철원|동해/.test(r['운영기관명'] || '')) return null; // 강원 다른 시·군이 운영
  const rg = region.trim();
  if (rg && !/^해당\s*없음$/.test(rg)) {
    if (!/춘천|삼척|강원(특별자치)?도|석탄산업전환지역/.test(rg)) return null;
    if (!/춘천|삼척|석탄산업전환지역/.test(rg) && /원주|강릉|횡성|인제|영월|평창|정선|태백|홍천|화천|양구|고성|속초|양양|철원|동해/.test(rg)) return null; // 강원 다른 시·군 전용
  }
  const gr = [...String(r['학년구분'] || '').matchAll(/(\d)\s*학년/g)].map(m => m[1]);
  const body = [['성적', '성적기준 상세내용'], ['소득', '소득기준 상세내용'], ['지원', '지원내역 상세내용'], ['자격', '특정자격 상세내용'], ['지역', '지역거주여부 상세내용'], ['선발', '선발방법 상세내용'], ['인원', '선발인원 상세내용'], ['제한', '자격제한 상세내용'], ['서류', '제출서류 상세내용']]
    .filter(([, k]) => r[k] && !/^(해당\s*없음|없음|-)$/.test(String(r[k]).trim())).map(([l, k]) => `${l}: ${clip(r[k], 300)}`).join('\n');
  return item({ id: `gov-kosaf-${r['번호'] || r['상품명']}`, type: '장학금', source: '한국장학재단', org: r['운영기관명'] || '', title: r['상품명'] || '', region: regionOf(region),
    start: ymd(r['모집시작일']), deadline: end, url: r['홈페이지 주소'] || 'https://www.kosaf.go.kr/', body,
    cond: { ...COND0, grade: gr.length && gr.length < 4 ? [...new Set(gr)] : null },
    docs: String(r['제출서류 상세내용'] || '').split(/[,\n·]|\d\)/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30).slice(0, 6),
    summary: `누가: ${clip([r['학년구분'], r['학과구분'], r['특정자격 상세내용']].filter(Boolean).join(' · '), 120) || '공고 참고'}\n혜택: ${clip(r['지원내역 상세내용'], 120) || '공고 참고'}\n신청: ${r['모집시작일'] || ''} ~ ${r['모집종료일']} · ${clip(r['선발방법 상세내용'], 60) || '운영기관 안내'}` });
}

// 파일 이름 끝 날짜: '..._20261014' 또는 '..._10/12/2021' (형식이 섞여 있어 그냥 정렬하면 2021년 파일이 최신으로 뽑혔음)
export const fileDate = s => { const a = String(s).match(/(\d{4})(\d{2})(\d{2})\s*$/), b = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  return a ? `${a[1]}-${a[2]}-${a[3]}` : b ? `${b[3]}-${b[1].padStart(2, '0')}-${b[2].padStart(2, '0')}` : ''; };

// 보조금24(정부24 공공서비스): 중앙부처·강원도·춘천·삼척시의 대학생·청년 대상 장학·주거·교육 지원
export function fromGov24(r) {
  const org = r['소관기관명'] || '', text = `${r['서비스명'] || ''} ${r['지원대상'] || ''} ${r['서비스목적요약'] || ''}`;
  // 대학(원)생·청년이 대상이어야 함. '학생'만 있는 초·중·고·청소년·아동 사업은 뺀다 (2026-11-06 실제 응답 335건 중 다수가 이런 사업)
  if (!/대학생|대학원생|대학교|대학\s*재학|청년/.test(text)) return null;
  if (/청소년|아동|초등|중학|고등학교|고등학생|영유아|어르신|노인/.test(r['지원대상'] || '') && !/대학|청년/.test(r['지원대상'] || '')) return null;
  if (!HOME.test(org) && OTHER.test(org)) return null; // 다른 시·도 사업
  if (!HOME.test(org) && /[시군구]$/.test(org.split(' ').at(-1) || '')) return null; // 다른 시·군·구
  // 서비스ID 앞자리 = 소관기관 (2026-11-06 실제 응답으로 확인): 418 춘천 · 424 삼척 · 642/653 강원도 · 그 밖의 3xx·4xx는 다른 시·군·구,
  // O000…는 지자체 출연기관(장학재단 등) → 춘천·삼척·강원 기관만. 그 밖(중앙부처·공공기관)은 전국 대상
  const sid = String(r['서비스ID'] || '');
  if (/^[34]\d{2}/.test(sid) && !/^(418|424)/.test(sid)) return null;
  if (/^O\d/.test(sid) && !/춘천|삼척|강원(특별자치)?도\s*$|강원인재원|강원특별자치도 (춘천|삼척)/.test(org)) return null;
  if (/^O\d/.test(sid) && /강원/.test(org) && /원주|강릉|태백|속초|홍천|횡성|영월|평창|화천|양구|양양|인제|정선|고성|철원|동해/.test(org)) return null;
  // 학생과 상관없는 사업(농지·축산 자금, 시설 요금 감면, 기업용 지원금 등)
  if (/농지|과원|축산|원예|농업종합자금|졸음쉼터|푸드트럭|상하수도|티켓\s*할인|아동양육|보호아동|유스호스텔|금융수수료|고용창출장려금|중소환경기업|채용\s*우대|정신건강복지센터|일상돌봄|건설노동자 대부/.test(r['서비스명'] || '')) return null;
  const field = r['서비스분야'] || '';
  const all = field + text;
  const type = /장학|교육비|등록금|학자금|수당|급여|지원금|바우처|월세|주거|생활비|대출/.test(all) ? '장학금' : /일자리|취업|인턴|채용|창업/.test(all) ? '대외활동' : /교육|연수|캠프|프로그램|체험|문화/.test(all) ? '비교과' : '공지';
  return item({ id: `gov-g24-${r['서비스ID']}`, type, source: '보조금24', org, title: r['서비스명'] || '', region: regionOf(org),
    deadline: lastDate(r['신청기한']), url: r['상세조회URL'] || 'https://www.gov.kr/', body: [r['지원대상'], r['선정기준'], r['지원내용']].filter(Boolean).join('\n'),
    summary: `누가: ${clip(r['지원대상'], 120)}\n혜택: ${clip(r['지원내용'], 120)}\n신청: ${clip(r['신청방법'], 50)}${r['신청기한'] ? ` · ${clip(r['신청기한'], 40)}` : ''}` });
}

// K-Startup 사업공고: 대학생·청년이 낼 수 있는 경진대회·공모만 (일반 지원사업은 뺌)
export function fromKstartup(r, today) {
  const title = r.biz_pbanc_nm || r.intg_pbanc_biz_nm || '', end = ymd(r.pbanc_rcpt_end_dt), reg = r.supt_regin || '';
  if (!/경진|공모|대회|챌린지|해커톤|오디션/.test(title) || (r.rcrt_prgs_yn && r.rcrt_prgs_yn !== 'Y')) return null;
  if (end && end < today) return null;
  if (reg && !/전국|강원/.test(reg)) return null;
  return item({ id: `gov-ks-${r.pbanc_sn || title}`, type: '공모전', source: 'K-Startup', org: r.pbanc_ntrp_nm || r.sprv_inst || '', title, region: regionOf(reg),
    start: ymd(r.pbanc_rcpt_bgng_dt), deadline: end, url: r.detl_pg_url || 'https://www.k-startup.go.kr/', body: clip(r.pbanc_ctnt, 1500),
    summary: `누가: ${clip(r.aply_trgt || r.aply_trgt_ctnt, 120) || '공고 참고'}\n혜택: ${clip(r.supt_biz_clsfc, 80) || '공고 참고'}\n신청: ${ymd(r.pbanc_rcpt_bgng_dt)} ~ ${end} · K-Startup` });
}

// 온통청년 청년정책 (별도 키): 춘천·삼척(+전국) 청년 장학·주거·교육·일자리 정책
// 필드명은 공식 문서(youthcenter.go.kr 오픈 API 제공목록 > 청년정책, 2026-11-06 확인)와 같다
export function fromYouth(r, today) {
  const title = r.plcyNm || '', end = lastDate(r.aplyYmd), cls = `${r.lclsfNm || ''}${r.mclsfNm || ''}${title}`;
  if (!title || r.aplyPrdSeCd === '0057003' || (end && end < today)) return null; // 마감
  const age = r.sprtTrgtAgeLmtYn === 'Y' && (r.sprtTrgtMinAge || r.sprtTrgtMaxAge) ? `만 ${r.sprtTrgtMinAge || '?'}~${r.sprtTrgtMaxAge || '?'}세` : '';
  return item({ id: `gov-yc-${r.plcyNo}`, type: /교육|장학|주거|복지|생활/.test(cls) ? '장학금' : /일자리|취업|인턴|창업/.test(cls) ? '대외활동' : '공지', source: '온통청년', org: r.sprvsnInstCdNm || '',
    title, region: regionOf(r.sprvsnInstCdNm || ''), deadline: end,
    url: r.aplyUrlAddr || r.refUrlAddr1 || `https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/${r.plcyNo}`,
    body: [r.plcyExplnCn, r.plcySprtCn, r.addAplyQlfcCndCn, r.earnEtcCn].filter(Boolean).join('\n'),
    docs: String(r.sbmsnDcmntCn || '').split(/[,\n·]|\d\)/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30).slice(0, 6),
    summary: `누가: ${clip([age, r.addAplyQlfcCndCn].filter(Boolean).join(' · ') || '청년 (세부 자격은 원문)', 120)}\n혜택: ${clip(r.plcySprtCn, 120)}\n신청: ${r.aplyPrdSeCd === '0057002' ? '상시' : clip(r.aplyYmd, 30)}${r.plcyAplyMthdCn ? ' · ' + clip(r.plcyAplyMthdCn, 40) : ''}` });
}

// 전국문화축제표준데이터: 춘천·삼척에서 열리는 축제 → 지역 행사
export function fromFestival(r, today) {
  const addr = `${r.rdnmadr || ''} ${r.lnmadr || ''}`, region = /춘천시/.test(addr) ? '춘천' : /삼척시/.test(addr) ? '삼척' : '';
  const end = ymd(r.fstvlEndDate);
  if (!region || !end || end < today) return null;
  return { id: `ev-fs-${region}-${r.fstvlNm}`, region, source: '전국문화축제표준데이터', title: r.fstvlNm, start: ymd(r.fstvlStartDate) || end, end,
    place: r.opar || '', category: clip(r.fstvlCo, 60), tel: r.phoneNumber || '', url: r.homepageUrl || '' };
}

// 한국산업인력공단 국가자격 시험일정 (활용가이드 2020-12 필드명): 대학생이 많이 보는 기사·산업기사·기능사 '정기' 회차만
// (매주 열리는 상시 기능사 회차·기술사·기능장·이름 없는 전문자격 회차는 뺀다). 다음 원서접수 마감을 마감일로.
export function fromQual(r, today) {
  const d = String(r.description || '');
  if (r.qualgbCd !== 'T' || !/(기사|산업기사|기능사) \(\d{4}년도 제[1-4]회\)/.test(d)) return null;
  const f = s => ymd(String(s || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'));
  const doc = { s: f(r.docRegStartDt), e: f(r.docRegEndDt) }, prac = { s: f(r.pracRegStartDt), e: f(r.pracRegEndDt) };
  const ph = doc.e && doc.e >= today ? ['필기', doc, f(r.docExamStartDt), f(r.docPassDt)] : prac.e && prac.e >= today ? ['실기', prac, f(r.pracExamStartDt), f(r.pracPassDt)] : null;
  if (!ph) return null;
  const [kind, reg, exam, pass] = ph, name = d.replace(/^국가기술자격\s*/, '').replace(/\s*\((\d{4})년도 (제\d회)\)/, ' $1년 $2');
  const x = item({ id: `gov-qual-${r.implYy}-${r.implSeq}-${d.match(/산업기사|기사|기능사/)[0]}-${kind}`, type: '비교과', source: '국가자격 시험일정', org: '한국산업인력공단', title: `[국가기술자격] ${name} ${kind}시험 원서접수`,
    region: '전국', start: reg.s, deadline: reg.e, url: 'https://www.q-net.or.kr/', body: `${d}
${kind} 원서접수 ${reg.s} ~ ${reg.e}${exam ? `
${kind}시험 ${exam}` : ''}${pass ? `
합격 발표 ${pass}` : ''}`,
    summary: `누가: 해당 종목 응시자격이 있는 사람 (종목별 응시자격은 Q-Net 확인)
혜택: ${name} ${kind}시험 응시${exam ? ` · 시험 ${exam}` : ''}${pass ? ` · 발표 ${pass}` : ''}
신청: Q-Net 원서접수 ${reg.s} ~ ${reg.e}` });
  return { ...x, tags: [...new Set([...x.tags, '취업·진로'])] };
}

// 중앙부처 복지서비스(복지로, XML): 청년 생애주기 서비스 중 대학생·청년이 실제로 받을 만한 장학·주거·취업 지원만
export function fromWelfare(xml) {
  const g = k => (String(xml).match(new RegExp(`<${k}>([^<]*)</${k}>`)) || [])[1]?.replace(/&amp;/g, '&').trim() || '';
  const name = g('servNm'), dg = g('servDgst'), text = `${name} ${dg}`;
  // 서비스 이름에 대학생·청년 대상이 드러나는 것만 (청년 생애주기 152건 중 상병수당·어업인 보험 같은 사업은 뺀다, 2026-11-06 실제 응답 기준)
  if (!name || !/대학|학자금|장학|청년|월세|전세|교통비|해외취업|youth/i.test(name)) return null;
  if (/자립준비|고졸|고등학교|고교|경계선|장애|북한이탈|보훈|제대군인/.test(name)) return null;
  const type = /장학|학자금|월세|전세|주거|대출|수당|저축|공제|교통비/.test(text) ? '장학금' : /취업|일자리|창업|인턴/.test(text) ? '대외활동' : '공지';
  return item({ id: `gov-wf-${g('servId')}`, type, source: '복지로', org: [g('jurMnofNm'), g('jurOrgNm')].filter(Boolean).join(' '), title: name, region: '전국', deadline: '',
    url: g('servDtlLink') || 'https://www.bokjiro.go.kr/', body: dg,
    summary: `누가: ${clip([g('lifeArray'), g('trgterIndvdlArray')].filter(Boolean).join(' · '), 100) || '청년 (세부 자격은 원문)'}\n혜택: ${clip(dg, 120)}\n신청: ${g('onapPsbltYn') === 'Y' ? '온라인 신청 가능' : '원문 확인'}${g('rprsCtadr') ? ` · 문의 ${g('rprsCtadr')}` : ''}` });
}

// 고용24 일학습병행 훈련과정 (work24 오픈API 313L01): 기업에 채용돼 일하며 배우는 과정. 춘천·삼척에서 열리거나 강원대가 운영하는 과정만.
// API는 시작된 과정만 내려 준다(2026-11-06 확인: 앞으로 시작할 과정 0건) → 최근 180일 안에 시작한 과정을 '진행 중 · 다음 모집 문의' 참고 정보로 보여 준다(마감일 없음)
export function fromWork24(r, today) {
  const start = ymd(r.traStartDate), addr = r.address || '', inst = r.subTitle || '';
  const since = new Date(new Date(today).getTime() - 180 * 864e5).toISOString().slice(0, 10);
  if (!start || start < since || !(/춘천|삼척/.test(addr) || /강원대학교/.test(inst))) return null;
  const segs = String(r.title || '').split('_'), company = segs.at(-1) || '', job = segs.find((x, i) => /^L\d/.test(segs[i + 1] || '')) || '';
  return item({ id: `gov-w24-${r.trprId}-${r.trprDegr}`, type: '대외활동', source: '고용24 일학습병행', org: inst, title: `[일학습병행] ${job ? job + ' · ' : ''}${company} (${inst})`,
    region: regionOf(addr), deadline: '', start, url: r.titleLink || 'https://www.work24.go.kr/', body: `${r.title}
훈련 ${start} ~ ${ymd(r.traEndDate)} · ${addr}${r.telNo ? ` · 문의 ${r.telNo}` : ''}`,
    summary: `누가: 이 과정에 참여하는 기업에 채용된 학습근로자 (${r.trainTarget || '일학습병행'})
혜택: ${job || '직무'} 훈련 ${start} ~ ${ymd(r.traEndDate)} · 일하며 자격 취득
신청: ${start <= today ? '이미 시작된 과정이에요 · 다음 모집은 훈련기관 문의' : '훈련 시작 전 기업·훈련기관 문의'}${r.telNo ? ` (${r.telNo})` : ''}` });
}

// 한국장학재단 국가장학금 신청·수혜인원(통계): 강원대와 같은 '일반대·국공립·재학생군'의 가장 최근 학기 수혜율
export function kosafRate(rows) {
  const m = rows.filter(r => r['대학구분그룹 명'] === '일반대' && r['설립형태 명'] === '국공립' && r['학적구분 명'] === '재학생군');
  const last = m.sort((a, b) => a['기준년도'] - b['기준년도'] || String(a['장학학기 명']).localeCompare(String(b['장학학기 명']))).at(-1);
  if (!last || !last['신청인원(명)']) return null;
  return { year: last['기준년도'], semester: last['장학학기 명'], applied: last['신청인원(명)'], received: last['수혜인원(명)'], rate: Math.round(last['수혜인원(명)'] / last['신청인원(명)'] * 100) };
}

// 응답 안의 첫 '객체 배열'을 찾는다 (API마다 data / response.body.items / items.item 등 모양이 다름)
export function rows(j) {
  if (Array.isArray(j)) return j.length && typeof j[0] === 'object' ? j : [];
  if (j && typeof j === 'object') for (const v of Object.values(j)) { const r = rows(v); if (r.length) return r; }
  return [];
}

async function main() {
  const file = p => fileURLToPath(new URL(p, import.meta.url));
  try { process.loadEnvFile(file('../.env')); } catch { /* .env 없음 */ }
  const key = process.env.DATA_GO_KR_KEY, yk = process.env.YOUTHCENTER_KEY;
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const get = async u => { const r = await fetch(u, { signal: AbortSignal.timeout(25000) }); const t = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${/NOT_REGISTERED|유효하지 않은 인증키|-401/.test(t) ? 'data.go.kr 활용신청 승인 필요' : t.replace(/\s+/g, ' ').slice(0, 80)}`);
    try { return JSON.parse(t); } catch { throw new Error('JSON이 아닌 응답: ' + t.replace(/\s+/g, ' ').slice(0, 80)); } };
  const sources = {}, items = [], events = [], RAW = SAMPLE_RAW(today);
  // 출처가 응답하지 않으면(승인 전·키 없음) 그 출처의 [예시] 원본을 같은 변환기로 통과시켜 sample:true로 넣는다
  const sample = (name, map, toEvents) => { let n = 0; for (const r of RAW[name] || []) { const x = map(r, today); if (x) { (toEvents ? events : items).push({ ...x, id: 'sample-' + x.id, sample: true }); n++; } } return n; };
  const run = async (name, need, fn, map, toEvents = false) => {
    if (!need) sources[name] = { ok: false, error: '키 없음' };
    else try { const n0 = items.length + events.length; await fn(); sources[name] = { ok: true, count: items.length + events.length - n0 }; }
    catch (e) { sources[name] = { ok: false, error: e.message }; }
    if (!sources[name].ok && map) sources[name].sample = sample(name, map, toEvents);
    console.log(name, JSON.stringify(sources[name]));
  };
  const odPages = async (path, params, map, max = 30) => {
    for (let page = 1; page <= max; page++) {
      const j = await get(`https://api.odcloud.kr/api${path}?` + new URLSearchParams({ serviceKey: key, page, perPage: 500, returnType: 'JSON', ...params }));
      for (const r of rows(j)) { const x = map(r); if (x) items.push(x); }
      if (!j.currentCount || page * 500 >= (j.matchCount ?? j.totalCount ?? 0)) break;
    }
  };
  await run('한국장학재단', key, async () => {
    const d = await get('https://infuser.odcloud.kr/oas/docs?namespace=15028252/v1'); // 매달 새 파일 → 가장 최근 것을 고름
    const latest = Object.entries(d.paths).map(([p, v]) => [p, fileDate(v.get.summary)]).sort((a, b) => a[1].localeCompare(b[1])).at(-1)[0];
    await odPages(latest, {}, r => fromKosaf(r, today), 10);
  }, fromKosaf);
  await run('보조금24', key, () => odPages('/gov24/v3/serviceList', {}, fromGov24, 30), fromGov24);
  await run('K-Startup', key, async () => {
    for (let page = 1; page <= 10; page++) {
      const rs = rows(await get('https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?' + new URLSearchParams({ serviceKey: key, page, perPage: 200, returnType: 'json' })));
      for (const r of rs) { const x = fromKstartup(r, today); if (x) items.push(x); }
      if (rs.length < 200) break;
    }
  }, fromKstartup);
  await run('전국문화축제', key, async () => {
    const rs = rows(await get('https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api?' + new URLSearchParams({ serviceKey: key, pageNo: 1, numOfRows: 1000, type: 'json' })));
    for (const r of rs) { const x = fromFestival(r, today); if (x) events.push(x); }
  }, fromFestival, true);
  await run('온통청년', yk, async () => {
    const rs = rows(await get('https://www.youthcenter.go.kr/go/ythip/getPlcy?' + new URLSearchParams({ apiKeyNm: yk, rtnType: 'json', pageType: 1, pageNum: 1, pageSize: 100, zipCd: '51110,51230' })));
    for (const r of rs) { const x = fromYouth(r, today); if (x) items.push(x); }
  });
  // 두 번째 계정 키(DATA_GO_KR_KEY2)로 승인된 API: 국가자격 시험일정 · 중앙부처 복지서비스
  const key2 = process.env.DATA_GO_KR_KEY2;
  await run('국가자격 시험일정', key2, async () => {
    const y = +today.slice(0, 4);
    for (const implYy of [y, y + 1]) for (let pageNo = 1; pageNo <= 10; pageNo++) {
      const j = await get('http://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList?' + new URLSearchParams({ serviceKey: key2, dataFormat: 'json', implYy, numOfRows: 50, pageNo }));
      if (j.header?.resultCode !== '00') throw new Error(j.header?.resultMsg || '응답 오류');
      const rs = [].concat(j.body?.items?.item || j.body?.items || []);
      for (const r of rs) { const x = fromQual(r, today); if (x) items.push(x); }
      if (pageNo * 50 >= (j.body?.totalCount || 0)) break;
    }
  });
  await run('복지로', key2, async () => {
    const g24 = new Set(items.filter(n => n.source === '보조금24').map(n => n.title.replace(/\s+/g, '')));
    for (let pageNo = 1; pageNo <= 5; pageNo++) {
      const r = await fetch('https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001?' + new URLSearchParams({ serviceKey: key2, callTp: 'L', srchKeyCode: '003', lifeArray: '004', pageNo, numOfRows: 100 }), { signal: AbortSignal.timeout(25000) });
      const t = await r.text();
      if (!r.ok || !/<resultCode>0<\/resultCode>/.test(t)) throw new Error(`${r.status} ${/NOT_REGISTERED/.test(t) ? 'data.go.kr 활용신청 승인 필요' : t.replace(/\s+/g, ' ').slice(0, 80)}`);
      const list = t.split('<servList>').slice(1);
      for (const s of list) { const x = fromWelfare(s); if (x && !g24.has(x.title.replace(/\s+/g, ''))) items.push(x); } // 보조금24에 이미 있는 사업은 한 번만
      if (pageNo * 100 >= +(t.match(/<totalCount>(\d+)/)?.[1] || 0)) break;
    }
  });
  const wk = process.env.WORK24_KEY;
  await run('고용24 일학습병행', wk, async () => {
    const from = new Date(Date.now() + 9 * 3600e3 - 180 * 864e5).toISOString().slice(0, 10).replace(/-/g, ''), until = new Date(Date.now() + 9 * 3600e3 + 183 * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
    for (const extra of [{ srchTraArea1: '51' }, { srchTraOrganNm: '강원대학교' }]) for (let pageNum = 1; pageNum <= 5; pageNum++) {
      const j = await get('https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo313L01.do?' + new URLSearchParams({ authKey: wk, returnType: 'JSON', outType: 1, pageNum, pageSize: 100, srchTraStDt: from, srchTraEndDt: until, sort: 'ASC', sortCol: 2, ...extra }));
      const rs = j.srchList || [];
      for (const r of rs) { const x = fromWork24(r, today); if (x && !items.some(n => n.title === x.title)) items.push(x); } // 같은 과정의 다른 회차는 한 번만
      if (rs.length < 100) break;
    }
  });
  let stats = null;
  await run('국가장학금 수혜 통계', key, async () => {
    const d = await get('https://infuser.odcloud.kr/oas/docs?namespace=15114806/v1'); // 해마다 새 파일 → 가장 최근 것
    const latest = Object.entries(d.paths).map(([p, v]) => [p, fileDate(v.get.summary)]).sort((a, b) => a[1].localeCompare(b[1])).at(-1)[0];
    const j = await get(`https://api.odcloud.kr/api${latest}?` + new URLSearchParams({ serviceKey: key, page: 1, perPage: 500, returnType: 'JSON' }));
    stats = { kosafRate: kosafRate(rows(j)) };
    if (!stats.kosafRate) throw new Error('국공립 일반대 재학생 통계를 찾지 못함');
  });
  const seen = new Set(), uniq = items.filter(n => !seen.has(n.id) && seen.add(n.id));
  await mkdir(file('../data'), { recursive: true });
  await writeFile(file('../data/gov.json'), JSON.stringify({ collectedAt: new Date().toISOString(), sources, stats, items: uniq, events }, null, 1));
  console.log(`저장: data/gov.json — 정부·기관 ${uniq.filter(n => !n.sample).length}건(+예시 ${uniq.filter(n => n.sample).length}), 축제 ${events.filter(e => !e.sample).length}건(+예시 ${events.filter(e => e.sample).length})`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

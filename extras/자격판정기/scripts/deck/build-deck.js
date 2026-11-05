// KNU 자격판정기 해커톤 발표 — 데이터톤 '강원 발견' 덱 문법(흰 바탕, 섹션 태그, 큰 제목, 둥근 카드, 남색 마무리)
// 수치는 data/notices.json에서 계산한다(손으로 쓰지 않음).
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/user/Desktop/AI/공모전/해커톤/자격판정기';
const OUT = process.argv[2] || path.join(ROOT, '..', 'KNU_자격판정기_발표.pptx');
const SHOT = name => path.join(__dirname, 'shots', name);
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/notices.json'), 'utf8'));
const N = data.notices;
const today = new Date().toISOString().slice(0, 10);

// ---------- 수치 ----------
const bySrc = s => N.filter(n => n.source === s).length;
const withDl = N.filter(n => n.deadline).length;
const noDl = N.length - withDl;
const open = N.filter(n => n.deadline >= today);
const perWeek = Math.round(N.length / (data.days || 45) * 7);
// 데모 사용자: 삼척캠퍼스 3학년 (화면 판정과 같은 규칙: 캠퍼스·학년 조건만 비교)
const fails = n => (Array.isArray(n.cond.campus) && !n.cond.campus.includes('삼척')) || (Array.isArray(n.cond.grade) && !n.cond.grade.includes('3'));
const mine = open.filter(n => !fails(n));
const mineSch = mine.filter(n => n.type === '장학금');
const analyzed = N.filter(n => !n.aiPending);
const unclear = analyzed.filter(n => Object.values(n.cond).some(v => v === 'unknown')).length;
const collected = new Date(data.collectedAt);
const ymd = `${collected.getFullYear()}.${collected.getMonth() + 1}.${collected.getDate()}`;
const big = N.find(n => /창업장학금/.test(n.title));
const local = N.find(n => /지역주민/.test(n.title));
console.log({ total: N.length, withDl, noDl, open: open.length, perWeek, mine: mine.length, mineSch: mineSch.length, analyzed: analyzed.length, unclear });

// ---------- 테마 ----------
const C = { navy: '001546', blue: '3F60A9', deep: '2D4478', sky: 'ECEFF6', sky2: 'C3CEE4', bg: 'F4F5F6', ink: '141414', muted: '4E5359', faint: '6B7280', line: 'E3E6EA', white: 'FFFFFF', orange: 'B5470F', ok: '0E7C4A', warn: 'A15C00', no: 'B42318' };
const F = 'Malgun Gothic';
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.title = 'KNU 자격판정기 — 2026 KNU AI 해커톤';
pres.author = 'KNU 자격판정기 팀';
pres.theme = { headFontFace: F, bodyFontFace: F };
const W = 13.333, MX = 0.6;

// 공통 프레임: 섹션 태그 + 제목 + 페이지 번호 + 푸터
let page = 0;
function frame(tagNo, tag, title, { dark = false } = {}) {
  page++;
  const s = pres.addSlide();
  s.background = { color: dark ? C.navy : C.white };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 0.42, w: 0.42, h: 0.28, rectRadius: 0.06, fill: { color: dark ? C.deep : C.sky }, line: { type: 'none' } });
  s.addText(tagNo, { x: MX, y: 0.42, w: 0.42, h: 0.28, fontFace: F, fontSize: 10, bold: true, color: dark ? C.white : C.blue, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addText(tag, { x: MX + 0.52, y: 0.42, w: 6, h: 0.28, fontFace: F, fontSize: 11, bold: true, color: dark ? C.sky2 : C.blue, valign: 'middle', margin: 0, isTextBox: true });
  s.addText(title, { x: MX, y: 0.82, w: W - 2 * MX, h: 0.7, fontFace: F, fontSize: 28, bold: true, color: dark ? C.white : C.ink, valign: 'middle', margin: 0, isTextBox: true });
  s.addShape(pres.shapes.LINE, { x: MX, y: 7.0, w: W - 2 * MX, h: 0, line: { color: dark ? C.deep : C.line, width: 0.75 } });
  s.addText('KNU AI HACKATHON · KNU 자격판정기', { x: MX, y: 7.05, w: 6, h: 0.3, fontFace: F, fontSize: 9, color: dark ? C.sky2 : C.faint, margin: 0, isTextBox: true });
  s.addText(String(page).padStart(2, '0'), { x: W - MX - 1, y: 7.05, w: 1, h: 0.3, fontFace: F, fontSize: 9, color: dark ? C.sky2 : C.faint, align: 'right', margin: 0, isTextBox: true });
  return s;
}
function card(s, x, y, w, h, { fill = C.white, border = C.line } = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: border, width: 0.75 } });
}
function pill(s, x, y, text, { fill = C.sky, color = C.blue, w } = {}) {
  const ww = w || Math.max(0.9, text.length * 0.13 + 0.3);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: ww, h: 0.3, rectRadius: 0.15, fill: { color: fill }, line: { type: 'none' } });
  s.addText(text, { x, y, w: ww, h: 0.3, fontFace: F, fontSize: 10, bold: true, color, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}
const T = (s, text, o) => s.addText(text, { fontFace: F, margin: 0, isTextBox: true, color: C.ink, ...o });
const img = (s, file, o) => { if (fs.existsSync(SHOT(file))) s.addImage({ path: SHOT(file), ...o }); else { card(s, o.x, o.y, o.w, o.h, { fill: C.bg }); T(s, `[화면 캡처: ${file}]`, { x: o.x, y: o.y, w: o.w, h: o.h, align: 'center', color: C.faint, fontSize: 12 }); } };
const EDIT = '✎ 팀이 직접 채울 칸';

// =====================================================================
// 01 표지 + 문제 한 문장 (대회 규칙: 발표 첫 장에 이 문장)
{
  page++;
  const s = pres.addSlide();
  s.background = { color: C.white };
  pill(s, MX, 0.45, 'KNU AI HACKATHON  /  Zero to One', { w: 3.1 });
  T(s, 'KNU 자격판정기', { x: MX, y: 1.15, w: 7, h: 0.9, fontSize: 44, bold: true });
  T(s, '놓치면 끝나는 마감, 내 조건으로 먼저', { x: MX, y: 2.05, w: 7, h: 0.55, fontSize: 22, bold: true, color: C.blue });
  // 문제 한 문장 (규칙 슬라이드의 어두운 카드 형식)
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 2.95, w: 6.9, h: 3.55, rectRadius: 0.16, fill: { color: C.navy }, line: { type: 'none' } });
  T(s, '문 제  한 문 장', { x: MX + 0.4, y: 3.2, w: 5, h: 0.3, fontSize: 11, color: C.sky2, bold: true });
  s.addText([
    { text: '[강원대 학생]', options: { color: '8FB0FF', bold: true } }, { text: '은 ', options: { color: C.white } },
    { text: '[장학·공모 신청 기간마다]', options: { color: '8FB0FF', bold: true, breakLine: true } },
    { text: `[게시판 4곳에 흩어진 공지 ${perWeek}건/주]`, options: { color: '8FB0FF', bold: true } }, { text: ' 때문에', options: { color: C.white, breakLine: true } },
    { text: '[공지마다 자격·마감을 직접 대조하는 시간]', options: { color: '8FB0FF', bold: true } }, { text: '과', options: { color: C.white, breakLine: true } },
    { text: '[놓친 장학금]', options: { color: 'FFB48A', bold: true } }, { text: '을 치른다.', options: { color: C.white } }
  ], { x: MX + 0.4, y: 3.6, w: 6.2, h: 2.2, fontFace: F, fontSize: 19, valign: 'top', margin: 0, isTextBox: true, paraSpaceAfter: 4 });
  T(s, `근거: 강원대 공개 게시판 수집 ${data.days || 45}일 ${N.length}건 (${ymd})`, { x: MX + 0.4, y: 5.95, w: 6.2, h: 0.3, fontSize: 11, color: C.sky2 });
  // 오른쪽 3단계 카드
  const steps = [['01', '모으고', '장학·공모·행사·학사 게시판을 한곳에'], ['02', '읽고', 'AI가 자격 조건·마감·서류를 구조화'], ['03', '판정·알림', '내 조건으로 판정하고 캘린더에 마감 등록']];
  steps.forEach(([no, t, d], i) => {
    const y = 1.2 + i * 1.75, x = 8.1, w = 4.6, h = 1.5, on = i === 2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.14, fill: { color: on ? C.blue : C.white }, line: { color: on ? C.blue : C.line, width: 0.75 }, shadow: { type: 'outer', color: '000000', opacity: 0.08, blur: 6, offset: 2, angle: 90 } });
    pill(s, x + 0.35, y + 0.35, no, { w: 0.45, fill: on ? C.deep : C.sky, color: on ? C.white : C.blue });
    T(s, t, { x: x + 0.95, y: y + 0.3, w: 3.4, h: 0.4, fontSize: 20, bold: true, color: on ? C.white : C.ink });
    T(s, d, { x: x + 0.95, y: y + 0.8, w: 3.4, h: 0.4, fontSize: 13, color: on ? C.sky : C.muted });
  });
  s.addNotes(`첫 장 문장: 강원대 학생은 장학·공모 신청 기간마다 게시판 4곳에 흩어진 공지(일주일 평균 ${perWeek}건) 때문에 공지마다 자격과 마감을 직접 대조하는 시간과, 놓친 장학금이라는 숨은 비용을 치릅니다. 근거는 ${ymd}에 강원대 공개 게시판에서 수집한 ${N.length}건입니다.`);
}

// 02 숨은 비용 4가지
{
  const s = frame('01', '숨은 비용', '아무도 기록하지 않지만 매 학기 반복되는 비용');
  const items = [
    ['시간', `${perWeek}건/주`, `장학·공모·행사·학사 4개 게시판에 ${data.days || 45}일 동안 ${N.length}건이 올라왔다`],
    ['수고', `${noDl}건`, `${N.length}건 중 본문만으로는 마감일을 찾을 수 없어 첨부·포스터를 열어야 하는 공지`],
    ['돈', big ? '200만원' : '—', big ? `KNU창업장학금 생활비 200만원(마감 ${big.deadline.slice(5).replace('-', '/')}) 같은 공지를 놓치면 그대로 손실` : '놓친 장학금은 기록되지 않는다'],
    ['불안', analyzed.length ? `${Math.round(unclear / analyzed.length * 100)}%` : '—', `"내가 해당되나?" AI가 읽어도 자격 조건 일부가 원문 확인 필요로 남은 공지 비율 (${unclear}/${analyzed.length}건)`]
  ];
  items.forEach(([k, v, d], i) => {
    const x = MX + i * 3.08, y = 1.9, w = 2.86, h = 4.6;
    card(s, x, y, w, h, { fill: i === 2 ? C.sky : C.white });
    pill(s, x + 0.3, y + 0.3, k, { w: 0.8, fill: i === 2 ? C.blue : C.sky, color: i === 2 ? C.white : C.blue });
    T(s, v, { x: x + 0.3, y: y + 1.0, w: w - 0.6, h: 1.0, fontSize: 36, bold: true, color: i === 2 ? C.orange : C.blue });
    T(s, d, { x: x + 0.3, y: y + 2.2, w: w - 0.6, h: 2.0, fontSize: 14, color: C.muted, valign: 'top' });
  });
  T(s, `수치 출처: ${ymd} 강원대 공개 게시판 수집본. '불안'은 AI 분석을 마친 ${analyzed.length}건 기준.`, { x: MX, y: 6.62, w: W - 2 * MX, h: 0.3, fontSize: 10, color: C.faint });
  s.addNotes('대회가 말한 숨은 비용 네 가지(시간·수고·돈·불안)를 모두 실제 데이터로 보여줍니다. 숫자는 손으로 쓴 것이 아니라 수집한 공지에서 계산했습니다.');
}

// 03 문제를 좁히다
{
  const s = frame('02', '문제 좁히기', '한 명의 사용자, 한 장면, 한 번에 끝나는 과업');
  const rows = [
    ['사용자', '삼척캠퍼스 3학년, 자취하는 재학생'],
    ['장면', '월요일 아침 "이번 주 내가 신청할 장학금은?"'],
    ['과업', '공지 찾기 → 자격 확인 → 마감일 캘린더 등록'],
    ['팀원 경험', `${EDIT}: 팀원이 직접 마감을 놓쳤거나 헤맸던 사례 한 줄`]
  ];
  rows.forEach(([k, v], i) => {
    const y = 1.9 + i * 1.12;
    card(s, MX, y, 7.4, 0.95, { fill: i === 3 ? 'FFF3DF' : C.white, border: i === 3 ? 'F2C98A' : C.line });
    T(s, k, { x: MX + 0.35, y, w: 1.5, h: 0.95, fontSize: 14, bold: true, color: i === 3 ? C.warn : C.blue, valign: 'middle' });
    T(s, v, { x: MX + 1.9, y, w: 5.3, h: 0.95, fontSize: 15, valign: 'middle', color: i === 3 ? C.warn : C.ink });
  });
  // 오른쪽: 범위가 좁아지는 숫자
  const x = 8.4, w = 4.33;
  card(s, x, 1.9, w, 4.3, { fill: C.sky, border: C.sky });
  T(s, '같은 사용자에게 필요한 것만 남기면', { x: x + 0.35, y: 2.15, w: w - 0.7, h: 0.4, fontSize: 13, bold: true, color: C.deep });
  [[`${N.length}건`, '수집한 전체 공지'], [`${open.length}건`, `${today.slice(5).replace('-', '/')} 기준 마감 전`], [`${mine.length}건`, '삼척·3학년에 해당 가능']].forEach(([v, l], i) => {
    const y = 2.7 + i * 1.12;
    T(s, v, { x: x + 0.35, y, w: 1.75, h: 0.75, fontSize: i === 2 ? 34 : 28, bold: true, color: i === 2 ? C.orange : C.blue, valign: 'middle' });
    T(s, l, { x: x + 2.1, y, w: w - 2.3, h: 0.75, fontSize: 13, color: C.muted, valign: 'middle' });
  });
  s.addNotes('대회 규칙 2번(한 명의 사용자, 한 장면, 한 과업)에 맞춰 범위를 좁혔습니다. 노란 칸은 팀원의 실제 경험으로 채워 주세요(규칙 1번).');
}

// 04 비슷한 서비스와 부족한 점
{
  const s = frame('03', '기존 서비스', '비슷한 서비스는 있지만 "지금, 나에게"를 답하지 못한다');
  const rows = [
    ['서비스', '알려 주는 것', '부족한 한 줄'],
    ['학교 맞춤장학 조회', '장학 제도 목록과 자격 설명', '지금 모집 중인지·마감일을 모른다 (제도 사전)'],
    ['학교 공지 게시판', '장학·공모·행사·학사 원문', '게시판이 나뉘어 있고 자격은 직접 읽어야 한다'],
    ['에브리타임·단톡방', '학생들이 퍼 나른 공지', '흩어져 있고 출처·마감이 불확실하다'],
    ['KNU 자격판정기', '마감 순 공지 + 내 자격 판정 + 이유', '원문 링크를 붙여 학교 시스템을 보완한다']
  ];
  s.addTable(rows.map((r, i) => r.map((c, j) => ({ text: c, options: {
    bold: i === 0 || j === 0, color: i === 0 ? C.white : i === 4 ? C.blue : C.ink,
    fill: { color: i === 0 ? C.navy : i === 4 ? C.sky : C.white }, fontSize: i === 0 ? 13 : 14, fontFace: F, valign: 'middle', margin: [0.08, 0.15, 0.08, 0.15]
  } }))), { x: MX, y: 1.9, w: W - 2 * MX, colW: [3.0, 3.7, 5.43], rowH: 0.78, border: { type: 'solid', color: C.line, pt: 0.75 } });
  T(s, '학교 맞춤장학 조회는 직접 확인한 화면 기준(춘천·삼척 선택지). 장학 공지에는 "학교 맞춤장학 조회에서 보기" 링크를 함께 보여 준다.', { x: MX, y: 6.15, w: W - 2 * MX, h: 0.5, fontSize: 11, color: C.faint });
  s.addNotes('대회 규칙 3번: 비슷한 서비스가 있다면 왜 부족한지 한 줄로. 학교 맞춤장학 조회는 제도 사전이고, 우리는 지금 신청할 수 있는 공지와 마감을 알려 주는 보완 서비스입니다.');
}

// 05 외부 데이터
{
  const s = frame('04', '외부 데이터', `강원대 공개 게시판 4곳에서 ${data.days || 45}일치 공지 ${N.length}건을 모았다`);
  s.addChart(pres.charts.BAR, [{ name: '공지 수', labels: ['장학공지', '공모안내', '행사안내', '학사공지'], values: [bySrc('장학공지'), bySrc('공모안내'), bySrc('행사안내'), bySrc('학사공지')] }], {
    x: MX, y: 1.85, w: 6.2, h: 4.6, barDir: 'bar', chartColors: [C.blue], showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: C.ink, dataLabelFontSize: 12, dataLabelFontFace: '+mn-lt',
    catAxisLabelColor: C.muted, catAxisLabelFontSize: 13, catAxisLabelFontFace: '+mn-lt', valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    showLegend: false, showTitle: true, title: '게시판별 수집 공지 (같은 글 중복 제거)', titleFontSize: 13, titleColor: C.ink, titleFontFace: '+mn-lt', catAxisOrientation: 'maxMin'
  });
  const steps = [['01', '수집', 'robots.txt가 허용한 공개 게시판만, 1초 간격'], ['02', '정제', '같은 글 중복 제거, 본문·첨부·부서 분리'], ['03', 'AI 구조화', `Gemini가 자격·마감·서류를 JSON으로 (${analyzed.length}건 완료)`], ['04', '검증', '허용값 밖·날짜 오류는 서버가 버림']];
  steps.forEach(([no, t, d], i) => {
    const y = 1.85 + i * 1.18, x = 7.25, w = 5.48;
    card(s, x, y, w, 1.0, { fill: i === 2 ? C.sky : C.white });
    pill(s, x + 0.25, y + 0.35, no, { w: 0.45 });
    T(s, t, { x: x + 0.85, y: y + 0.12, w: 1.6, h: 0.76, fontSize: 15, bold: true, valign: 'middle' });
    T(s, d, { x: x + 2.3, y: y + 0.12, w: w - 2.5, h: 0.76, fontSize: 12, color: C.muted, valign: 'middle' });
  });
  T(s, `마감일 확인 ${withDl}건 · 마감 전 ${open.length}건 · 수집일 ${ymd}`, { x: 7.25, y: 6.62, w: 5.48, h: 0.3, fontSize: 11, color: C.faint });
  s.addNotes('필수 제약 2번(외부 데이터 활용): 강원대 공개 게시판에서 직접 수집했습니다. 시연 중에는 학교 서버에 실시간 접속하지 않고 미리 수집한 데이터를 씁니다.');
}

// 06 서비스 화면
{
  const s = frame('05', '서비스', '마감 순 타임라인 위에 "내 판정"과 "이유"를 얹었다');
  img(s, 'desktop.png', { x: MX, y: 1.8, w: 7.9, h: 4.94 });
  const f = [['마감 타임라인', 'D-Day 순, 마감 지난 것은 숨김'], ['내 판정 + 이유', '지원 가능 · 확인 필요 · 해당 없음'], ['AI 3줄 요약·태그', '대상 / 혜택 / 신청 방법'], ['캘린더 등록', '.ics로 마감 3일 전 알림']];
  f.forEach(([t, d], i) => {
    const y = 1.8 + i * 1.27, x = 8.85, w = 3.88;
    card(s, x, y, w, 1.1, { fill: i === 1 ? C.blue : C.white, border: i === 1 ? C.blue : C.line });
    T(s, t, { x: x + 0.3, y: y + 0.15, w: w - 0.6, h: 0.42, fontSize: 15, bold: true, color: i === 1 ? C.white : C.ink });
    T(s, d, { x: x + 0.3, y: y + 0.58, w: w - 0.6, h: 0.38, fontSize: 12, color: i === 1 ? C.sky : C.muted });
  });
  s.addNotes('필수 제약 1번(인터넷 기반 서비스): 웹사이트이며 모바일과 데스크탑 모두 지원합니다.');
}

// 07 AI는 어디에 (안전한 설계)
{
  const s = frame('06', 'AI 설계', 'AI는 읽고 해석한다, 판정은 코드가 한다');
  const flow = [['공지 원문', '본문·포스터 이미지'], ['Gemini', '자격·마감·서류·요약을\n정해진 JSON으로'], ['서버 검증', '허용값만 남기고\n애매하면 "확인 필요"'], ['코드 판정', '내 조건과 비교\n이유까지 표시'], ['사람 확인', '틀린 조건은\n화면에서 바로 수정']];
  flow.forEach(([t, d], i) => {
    const x = MX + i * 2.47, y = 2.0, w = 2.2, h = 2.1, ai = i === 1;
    card(s, x, y, w, h, { fill: ai ? C.blue : C.white, border: ai ? C.blue : C.line });
    T(s, t, { x: x + 0.2, y: y + 0.25, w: w - 0.4, h: 0.45, fontSize: 16, bold: true, color: ai ? C.white : C.ink, align: 'center' });
    T(s, d, { x: x + 0.2, y: y + 0.85, w: w - 0.4, h: 1.0, fontSize: 12, color: ai ? C.sky : C.muted, align: 'center', valign: 'top' });
    if (i < flow.length - 1) T(s, '›', { x: x + w, y: y + 0.7, w: 0.27, h: 0.6, fontSize: 24, bold: true, color: C.sky2, align: 'center' });
  });
  card(s, MX, 4.55, W - 2 * MX, 1.75, { fill: C.sky, border: C.sky });
  T(s, '✦ 질문창도 같은 원칙', { x: MX + 0.4, y: 4.78, w: 5, h: 0.4, fontSize: 16, bold: true, color: C.deep });
  T(s, '"이번 주 내가 신청할 수 있는 장학금" → AI는 [기간·종류·관심 분야·판정] 필터로만 바꾸고, 실제 검색은 코드가 한다. 그래서 AI가 없는 공지를 지어낼 수 없고, AI가 실패하면 키워드 규칙으로 대신한다.', { x: MX + 0.4, y: 5.25, w: W - 2 * MX - 0.8, h: 0.85, fontSize: 15, color: C.ink, valign: 'top' });
  s.addNotes('AI 활용의 핵심: 환각이 판정에 섞이지 않게 역할을 나눴습니다. 이 부분이 "AI를 왜 썼나, 믿을 수 있나"에 대한 답입니다.');
}

// 08 시연 시나리오 (모바일)
{
  const s = frame('07', '시연', '3분 시연: 질문 한 줄로 시작해 캘린더 등록으로 끝난다');
  // 캡처 비율 390:844 유지 (h 5.1 → w 2.36)
  img(s, 'mobile.png', { x: MX + 0.15, y: 1.75, w: 2.36, h: 5.1 });
  img(s, 'mobile2.png', { x: MX + 2.75, y: 1.75, w: 2.36, h: 5.1 });
  const steps = [['01', '내 조건 고르기', '캠퍼스·학년·평점·관심 분야 (브라우저에만 저장)'], ['02', '질문하기', '"이번 주 내가 신청할 수 있는 장학금"'], ['03', '이유 확인', '왜 가능한지·무엇이 부족한지·서류 체크리스트'], ['04', '캘린더 등록', '마감 3일 전 알림까지 한 번에'], ['05', '새 공지 추가', '단톡방 포스터 사진 → AI가 조건 추출 → 수정 후 공유']];
  steps.forEach(([no, t, d], i) => {
    const y = 1.75 + i * 1.03, x = 6.45, w = 6.28;
    card(s, x, y, w, 0.88, { fill: i === 3 ? C.sky : C.white });
    pill(s, x + 0.25, y + 0.29, no, { w: 0.45 });
    T(s, t, { x: x + 0.85, y, w: 1.9, h: 0.88, fontSize: 14, bold: true, valign: 'middle' });
    T(s, d, { x: x + 2.75, y, w: w - 2.95, h: 0.88, fontSize: 12, color: C.muted, valign: 'middle' });
  });
  s.addNotes('시연 순서. 무대 와이파이를 믿지 말고 핫스팟과 녹화 영상을 백업으로 준비하세요.');
}

// 09 증명
{
  const s = frame('08', '증명', '숨은 비용이 줄었는가 — 같은 과업을 전·후로 잰다');
  // 왼쪽: 지금 확인된 감소(데이터)
  card(s, MX, 1.85, 4.6, 4.75, { fill: C.blue, border: C.blue });
  T(s, '확인해야 할 공지', { x: MX + 0.4, y: 2.1, w: 3.8, h: 0.4, fontSize: 14, bold: true, color: C.sky });
  T(s, `${N.length} → ${mine.length}건`, { x: MX + 0.4, y: 2.6, w: 3.8, h: 1.0, fontSize: 40, bold: true, color: C.white });
  T(s, `삼척·3학년 사용자 기준 (${Math.round((1 - mine.length / N.length) * 100)}% 감소)\n마감 지난 공지·조건이 안 맞는 공지를 자동 제외`, { x: MX + 0.4, y: 3.7, w: 3.8, h: 0.9, fontSize: 12, color: C.sky });
  T(s, `이 중 장학금 ${mineSch.length}건`, { x: MX + 0.4, y: 4.75, w: 3.8, h: 0.5, fontSize: 20, bold: true, color: 'FFB48A' });
  T(s, '데이터로 바로 계산한 값', { x: MX + 0.4, y: 5.95, w: 3.8, h: 0.35, fontSize: 11, color: C.sky2 });
  // 오른쪽: 실사용 측정표 (가점: 팀 밖 3명)
  T(s, `실사용 기록 — 팀 밖 사용자 3명 (${EDIT})`, { x: 5.55, y: 1.85, w: 7.2, h: 0.4, fontSize: 14, bold: true, color: C.warn });
  const head = ['', '기존 방식\n(게시판 직접)', 'KNU 자격판정기', '찾은 공지 수\n(전 → 후)'];
  const blank = r => [r, '__분 __초', '__분 __초', '__ → __'];
  s.addTable([head, blank('사용자 A'), blank('사용자 B'), blank('사용자 C')].map((r, i) => r.map((c, j) => ({ text: c, options: {
    bold: i === 0 || j === 0, fontSize: i === 0 ? 12 : 14, fontFace: F, color: i === 0 ? C.white : j === 0 ? C.ink : C.faint,
    fill: { color: i === 0 ? C.navy : C.white }, align: j === 0 ? 'left' : 'center', valign: 'middle', margin: [0.06, 0.12, 0.06, 0.12]
  } }))), { x: 5.55, y: 2.35, w: 7.18, colW: [1.6, 1.86, 1.86, 1.86], rowH: [0.75, 0.62, 0.62, 0.62], border: { type: 'solid', color: C.line, pt: 0.75 } });
  card(s, 5.55, 5.15, 7.18, 1.45, { fill: C.bg, border: C.bg });
  T(s, '측정 방법', { x: 5.85, y: 5.27, w: 3, h: 0.35, fontSize: 13, bold: true, color: C.deep });
  T(s, '과업 "이번 주 내가 신청할 수 있는 장학금을 찾아 마감을 기록하라"를\n같은 사람이 ① 학교 게시판으로 ② 자격판정기로 수행, 시간과 찾은 개수를 기록', { x: 5.85, y: 5.62, w: 6.7, h: 0.9, fontSize: 12, color: C.muted, valign: 'top' });
  s.addNotes('세부 과제의 "줄었다는 것을 증명하라"에 대한 답. 왼쪽은 데이터로 계산한 값이고, 오른쪽 표는 해커톤 중 팀 밖 3명에게 실제로 시켜 보고 채워야 합니다(가점: 실사용 기록). 측정 전에는 숫자를 넣지 마세요.');
}

// 10 가점 대응
{
  const s = frame('09', '선택 도전', '가점 3가지에 대한 우리의 답');
  const cols = [
    ['실사용 기록', '측정 진행', ['팀 밖 3명 전·후 과업 시간 측정 (앞 장 표)', '측정 화면 녹화로 기록 남기기']],
    ['사용자 범위 확장', '설계 반영', ['유학생: 다국어 요약(언어 선택 메뉴)', local ? `지역 주민: "${local.title.slice(0, 18)}…" 같은 공지도 수집됨` : '지역 주민·교직원 대상 공지도 함께 수집', '교직원: 학생 추가 공지 검토·승인']],
    ['끝까지 수행하는 AI', '일부 구현', ['질문 → 필터 → 결과까지 자동 (구현)', '마감 캘린더 등록·서류 체크리스트 (구현)', '마감 3일 전 자동 알림 발송 (다음 단계)']]
  ];
  cols.forEach(([t, st, items], i) => {
    const x = MX + i * 4.08, y = 1.85, w = 3.85, h = 4.75;
    card(s, x, y, w, h, { fill: i === 2 ? C.sky : C.white });
    T(s, t, { x: x + 0.35, y: y + 0.3, w: w - 0.7, h: 0.5, fontSize: 18, bold: true });
    pill(s, x + 0.35, y + 0.9, st, { w: 1.1, fill: st === '일부 구현' ? C.blue : C.sky, color: st === '일부 구현' ? C.white : C.blue });
    s.addText(items.map((t2, k) => ({ text: t2, options: { bullet: true, breakLine: k < items.length - 1 } })), { x: x + 0.35, y: y + 1.45, w: w - 0.7, h: 3.0, fontFace: F, fontSize: 13, color: C.muted, valign: 'top', paraSpaceAfter: 10, margin: 0, isTextBox: true });
  });
  s.addNotes('선택 도전(가점) 세 가지에 각각 무엇을 했고 무엇이 남았는지 정직하게 구분했습니다. "다음 단계"는 아직 구현하지 않은 것입니다.');
}

// 11 신뢰와 안전
{
  const s = frame('10', '신뢰', '오늘 배포해도 문제없게: 개인정보·비용·출처');
  const g = [['개인정보', '학점·소득구간은 브라우저에만 저장, 서버로 보내지 않음'], ['무료 한도 보호', '사람당 분·하루 호출 제한 + 서비스 전체 상한'], ['출처 투명성', '모든 카드에 원문 링크·게시판·게시일 표시'], ['중복 방지', '같은 공지는 저장 차단, 비슷하면 경고'], ['수집 예의', 'robots.txt 허용 경로만, 1초 간격, 시연 중 실시간 접속 없음'], ['검토 흐름', '학생이 올린 공지는 "검토 전" 표시 후 운영자 승인']];
  g.forEach(([t, d], i) => {
    const x = MX + (i % 3) * 4.08, y = 1.85 + Math.floor(i / 3) * 2.45, w = 3.85, h = 2.2;
    card(s, x, y, w, h);
    s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: y + 0.35, w: 0.5, h: 0.5, fill: { color: C.sky }, line: { type: 'none' } });
    T(s, String(i + 1), { x: x + 0.35, y: y + 0.35, w: 0.5, h: 0.5, fontSize: 14, bold: true, color: C.blue, align: 'center', valign: 'middle' });
    T(s, t, { x: x + 1.0, y: y + 0.35, w: w - 1.3, h: 0.5, fontSize: 16, bold: true, valign: 'middle' });
    T(s, d, { x: x + 0.35, y: y + 1.05, w: w - 0.7, h: 1.0, fontSize: 13, color: C.muted, valign: 'top' });
  });
  s.addNotes('심사 기준의 "오늘 바로 쓸 수 있는가"에 대한 답입니다.');
}

// 12 마무리 (남색)
{
  const s = frame('11', '마무리', '흩어진 공지를 "지금, 나에게"로 바꾼다', { dark: true });
  T(s, '결론', { x: MX, y: 1.85, w: 4, h: 0.4, fontSize: 14, bold: true, color: C.sky2 });
  T(s, '학생은 공지를 찾는 데 시간을 쓰지 않고, 신청하는 데 쓴다', { x: MX, y: 2.3, w: 8.5, h: 0.6, fontSize: 22, bold: true, color: C.white });
  T(s, '학교 맞춤장학 조회(제도)와 게시판(원문)을 잇는 "마감·자격 비서"', { x: MX, y: 3.0, w: 8.5, h: 0.5, fontSize: 15, color: C.sky2 });
  T(s, `수집 ${N.length}건 · 마감 전 ${open.length}건 · 삼척 3학년 기준 ${mine.length}건만 확인`, { x: MX, y: 3.75, w: 8.5, h: 0.5, fontSize: 16, bold: true, color: 'FFB48A' });
  T(s, `실제 배포 URL: ${EDIT} (배포 후 입력)`, { x: MX, y: 4.9, w: 8.3, h: 0.45, fontSize: 15, bold: true, color: C.white });
  T(s, `GitHub: ${EDIT}`, { x: MX, y: 5.4, w: 8.3, h: 0.45, fontSize: 13, color: C.sky2 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.3, y: 4.3, w: 2.4, h: 2.4, rectRadius: 0.1, fill: { color: C.white }, line: { type: 'none' } });
  T(s, 'QR 코드\n(배포 후 교체)', { x: 10.3, y: 4.3, w: 2.4, h: 2.4, fontSize: 12, color: C.faint, align: 'center', valign: 'middle' });
  s.addNotes('마무리. 배포 URL과 QR은 배포 후 교체하세요.');
}

pres.writeFile({ fileName: OUT }).then(f => console.log('저장:', f));

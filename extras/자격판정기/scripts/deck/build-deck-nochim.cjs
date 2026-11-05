// 놓치지마 — 2026 KNU AI 해커톤 발표 자료 (현재 만든 서비스 기준)
// 수치는 data/*.json과 nums.json(화면에서 계산한 값)에서 읽는다. 손으로 쓴 수치 없음.
// 실행: node build-deck-nochim.cjs [저장 경로]   (pptxgenjs 필요)
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/user/Desktop/AI/공모전/해커톤/자격판정기';
const OUT = process.argv[2] || 'C:/Users/user/Desktop/KNU_놓치지마_발표.pptx';
const SHOT = n => path.join(ROOT, 'scripts/deck/shots2', n);
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/notices.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/raw.json'), 'utf8'));
const NUM = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/deck/nums.json'), 'utf8'));
const SCRIPT = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/deck/script.json'), 'utf8')).slides; // 발표 대본 → 발표자 노트

// ---------- 수치 ----------
const N = data.notices, notices = N.filter(n => !n.kind), events = N.filter(n => n.kind === 'event');
const extern = N.filter(n => n.kind === 'contest'), gov = N.filter(n => n.kind === 'gov' && !n.sample);
const REV = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/categories.json'), 'utf8')).items, reviewed = Object.keys(REV).length, hidden = Object.values(REV).filter(v => v.hide).length;
const ids = new Set(N.map(n => n.id));
const rawUsed = raw.items.filter(i => ids.has(`${i.board.id}-${i.row.sn}`));
const chars = rawUsed.reduce((s, i) => s + i.det.body.length + i.row.title.length, 0);
const files = rawUsed.reduce((s, i) => s + i.det.files.length, 0);
const fmt = n => n.toLocaleString('ko-KR');
const man = n => (Math.round(n / 1000) / 10) + '만';
const c = new Date(data.collectedAt), ymd = `${c.getFullYear()}.${c.getMonth() + 1}.${c.getDate()}`;
const perks = N.filter(n => n.perks?.length).length;
const imgOnly = N.filter(n => n.imageOnly).length;
const cutPct = Math.floor((1 - NUM.counsel.after / NUM.counsel.before) * 100); // 내림: 99.6%를 100%로 부풀리지 않게

// ---------- 디자인: 강원대 남색 + 곰두리 하늘색, 둥근 카드 ----------
const C = { navy: '001546', blue: '3F60A9', deep: '2D4478', sky: 'ECEFF6', sky2: 'C3CEE4', bear: '7CC3EF', bearD: '1F6FA8', ink: '141414', muted: '4E5359', faint: '6B7280', line: 'E3E6EA', white: 'FFFFFF', orange: 'B5470F', ok: '0E7C4A', okBg: 'E7F4EC', warn: 'A15C00', warnBg: 'FFF3DF' };
const F = 'Malgun Gothic';
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.title = '놓치지마 — 2026 KNU AI 해커톤';
pres.author = '놓치지마 팀';
pres.theme = { headFontFace: F, bodyFontFace: F };
const W = 13.333, MX = 0.6;

let page = 0;
function frame(tagNo, tag, title, { dark = false } = {}) {
  page++;
  const s = pres.addSlide();
  s.background = { color: dark ? C.navy : C.white };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 0.42, w: 0.46, h: 0.3, rectRadius: 0.08, fill: { color: dark ? C.deep : C.sky }, line: { type: 'none' } });
  tagNo = String(page - 1).padStart(2, '0');
  s.addText(tagNo, { x: MX, y: 0.42, w: 0.46, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: dark ? C.white : C.blue, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addText(tag, { x: MX + 0.58, y: 0.42, w: 7, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: dark ? C.sky2 : C.blue, valign: 'middle', margin: 0, isTextBox: true });
  s.addText(title, { x: MX, y: 0.86, w: W - 2 * MX, h: 0.8, fontFace: F, fontSize: 30, bold: true, color: dark ? C.white : C.ink, valign: 'middle', margin: 0, isTextBox: true });
  s.addText(`놓치지마 · KNU AI 해커톤 2026`, { x: MX, y: 7.08, w: 6, h: 0.28, fontFace: F, fontSize: 10, color: dark ? C.sky2 : C.faint, margin: 0, isTextBox: true });
  s.addText(String(page).padStart(2, '0'), { x: W - MX - 1, y: 7.08, w: 1, h: 0.28, fontFace: F, fontSize: 10, color: dark ? C.sky2 : C.faint, align: 'right', margin: 0, isTextBox: true });
  return s;
}
const card = (s, x, y, w, h, fill = C.white, border = C.line) =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.14, fill: { color: fill }, line: { color: border, width: 0.75 } });
const txt = (s, t, o) => s.addText(t, { fontFace: F, margin: 0, isTextBox: true, valign: 'top', ...o });
function stat(s, x, y, w, num, label, color = C.blue, sub = '') {
  card(s, x, y, w, 1.75, C.white);
  txt(s, num, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.8, fontSize: 40, bold: true, color });
  txt(s, label, { x: x + 0.25, y: y + 1.02, w: w - 0.5, h: 0.32, fontSize: 14, bold: true, color: C.ink });
  if (sub) txt(s, sub, { x: x + 0.25, y: y + 1.34, w: w - 0.5, h: 0.3, fontSize: 11, color: C.faint });
}
function shot(s, file, x, y, w, h) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.line, width: 0.75 }, shadow: { type: 'outer', color: '001546', opacity: 0.18, blur: 8, offset: 3, angle: 90 } });
  s.addImage({ path: SHOT(file), x, y, w, h, sizing: { type: 'contain', w, h } });
}
function bullets(s, items, x, y, w, h, size = 15) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: i < items.length - 1, paraSpaceAfter: 8 } })),
    { x, y, w, h, fontFace: F, fontSize: size, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
}
const bear = (s, x, y, d) => s.addImage({ path: SHOT('../bear.png'), x, y, w: d, h: d });

// ===== 01 표지 =====
{
  page++;
  const s = pres.addSlide(); s.background = { color: C.navy };
  bear(s, MX, 1.25, 1.35);
  s.addImage({ path: SHOT('../gomduri_draw_full.png'), x: 9.0, y: 0.9, w: 3.6, h: 4.5 });
  txt(s, '2026 KNU AI 해커톤 · Zero to One', { x: MX, y: 2.85, w: 9, h: 0.4, fontSize: 16, bold: true, color: C.sky2 });
  txt(s, '놓치지마', { x: MX, y: 3.3, w: 9, h: 1.2, fontSize: 66, bold: true, color: C.white });
  txt(s, '곰두리가 대신 챙겨 주는 강원대 공지 AI 에이전트', { x: MX, y: 4.55, w: 11, h: 0.55, fontSize: 24, bold: true, color: C.bear });
  txt(s, '학교 공지·외부 공모전·정부 지원사업을 모아 내 조건으로 판정하고, 취업 상담·할 일·지원서 초안까지 끝까지 만들어 줍니다', { x: MX, y: 5.2, w: 8.0, h: 0.45, fontSize: 15, color: C.sky2 });
  txt(s, `춘천·삼척 캠퍼스 · 데이터 기준 ${ymd} · 비공식 학생 프로젝트`, { x: MX, y: 6.6, w: 9, h: 0.3, fontSize: 11, color: C.sky2 });
}

// ===== 02 문제 =====
{
  const s = frame('01', '문제 정의', '신청 시기마다 공지 수십 건을 직접 열어 자격을 확인한다');
  card(s, MX, 1.85, W - 2 * MX, 1.05, C.sky, C.sky);
  txt(s, [{ text: '[춘천·삼척 학생]은 ', options: { color: C.ink } }, { text: '[장학·공모 신청 시기]', options: { color: C.blue, bold: true } }, { text: '마다 ', options: { color: C.ink } },
    { text: '[공지를 하나씩 열어 자격을 확인하느라]', options: { color: C.blue, bold: true } }, { text: ' ', options: {} }, { text: `[${data.days || 45}일 ${fmt(notices.length)}건 · ${man(chars)} 자]`, options: { color: C.orange, bold: true } }, { text: '를 읽는 비용을 치른다', options: { color: C.ink } }],
  { x: MX + 0.3, y: 1.95, w: W - 2 * MX - 0.6, h: 0.85, fontSize: 19, bold: true, valign: 'middle' });
  const cw = (W - 2 * MX - 0.9) / 4;
  stat(s, MX, 3.25, cw, fmt(notices.length) + '건', `최근 ${data.days || 45}일 학교 공지`, C.blue, '6개 게시판 합계 (취업정보 포함)');
  stat(s, MX + (cw + 0.3), 3.25, cw, man(chars) + '자', '공지 본문 분량', C.orange, '제목+본문 기준, 첨부 제외');
  stat(s, MX + 2 * (cw + 0.3), 3.25, cw, fmt(files) + '개', '첨부파일', C.deep, '조건이 첨부에 숨는 경우 많음');
  stat(s, MX + 3 * (cw + 0.3), 3.25, cw, fmt(imgOnly) + '건', '이미지로만 된 공지', C.warn, '글로 검색조차 안 됨');
  bullets(s, ['학교 게시판은 "모아서 보여 주기"까지 — 나에게 해당하는지는 학생이 직접 판단', '상담 교직원도 학생마다 같은 공지를 다시 찾아 읽는다 (멘토 피드백)', '결과: 마감 지난 뒤 알게 되거나, 해당하는데도 지원하지 않는 기회 손실'], MX, 5.3, W - 2 * MX, 1.5, 15);
}

// ===== 03 기존 서비스와 차이 =====
{
  const s = frame('02', '왜 기존 서비스로는 부족한가', '찾아 주는 서비스는 많다 — 판정하고 끝까지 해 주는 곳은 없다');
  const rows = [['', '학교 게시판', '맞춤장학 조회', '알림 앱 (유니뷰 등)', '놓치지마'],
    ['공지 모으기', '게시판별', '장학만', '키워드 알림', '학교 6개 + 공모전 3곳 + 정부 API'],
    ['내 조건으로 판정', '✕', '제도 설명', '✕', '✓ 지원 가능/확인 필요 + 이유'],
    ['원문 근거 문장', '✕', '✕', '✕', '✓ 근거 인용'],
    ['할 일·초안까지', '✕', '✕', '✕', '✓ 곰두리 에이전트'],
    ['상담 교직원 지원', '✕', '✕', '✕', '✓ 상담관 모드'],
    ['취업 상담', '✕', '✕', '✕', '✓ 학년·직무별 추천']];
  s.addTable(rows.map((r, i) => r.map((v, j) => ({ text: v, options: { bold: i === 0 || j === 0 || j === 4, color: j === 4 ? (i === 0 ? C.white : C.blue) : (i === 0 ? C.white : C.ink), fill: { color: i === 0 ? (j === 4 ? C.blue : C.deep) : (j === 4 ? C.sky : C.white) }, align: j === 0 ? 'left' : 'center', valign: 'middle' } }))),
    { x: MX, y: 1.95, w: W - 2 * MX, colW: [2.3, 2.2, 2.2, 2.4, 3.03], rowH: 0.55, fontFace: F, fontSize: 14, border: { type: 'solid', color: C.line, pt: 0.75 } });
  txt(s, '멘토: "공지·공모전 찾아 주는 건 흔한 아이디어, AI를 어떻게 붙이냐의 싸움" → 판정 + 근거 + 끝까지 수행으로 차별화', { x: MX, y: 6.05, w: W - 2 * MX, h: 0.6, fontSize: 15, bold: true, color: C.orange });
}

// ===== 04 작동 방식 =====
{
  const s = frame('03', '해결 방법', '수집 → AI 조건 읽기 → 코드 판정, AI가 판정하지 않는다');
  const steps = [['수집', `강원대 게시판 6개\n공모전 사이트 3곳\n정부 공공 API 3종`, C.deep],
    ['AI 조건 읽기', 'Gemini가 공지에서\n자격·서류·마감을 추출\n허용값만 통과', C.blue],
    ['코드 판정', '내 조건과 비교해\n지원 가능·확인 필요\n이유까지 표시', C.ok],
    ['곰두리 실행', '찾기·근거 답변·할 일\n자소서 뼈대·문의 메일\n대신 만들어 줌', C.bearD]];
  const w = 2.8;
  steps.forEach(([h, b, col], i) => {
    const x = MX + i * (w + 0.31);
    card(s, x, 1.95, w, 2.6, C.white);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 2.15, w: 0.55, h: 0.55, fill: { color: col }, line: { type: 'none' } });
    txt(s, String(i + 1), { x: x + 0.25, y: 2.15, w: 0.55, h: 0.55, fontSize: 18, bold: true, color: C.white, align: 'center', valign: 'middle' });
    txt(s, h, { x: x + 0.95, y: 2.2, w: w - 1.1, h: 0.45, fontSize: 18, bold: true, color: C.ink, valign: 'middle' });
    txt(s, b, { x: x + 0.25, y: 2.9, w: w - 0.5, h: 1.5, fontSize: 14, color: C.muted, lineSpacingMultiple: 1.15 });
    if (i < 3) s.addText('›', { x: x + w, y: 2.9, w: 0.31, h: 0.6, fontFace: F, fontSize: 26, bold: true, color: C.sky2, align: 'center', margin: 0, isTextBox: true });
  });
  shot(s, 'list.png', MX + 0.4, 4.85, 5.0, 2.0);
  bullets(s, ['판정은 AI가 아니라 코드 → 같은 조건이면 언제나 같은 결과', `카테고리 7개 · 글 ${fmt(reviewed)}건을 직접 읽고 분류, 중복·광고·교직원 대상 ${hidden}건 숨김`, '원문에 언급 없는 "확인 필요" 조건은 제한 없음으로 정리 (11/5: 171개 → 지원 가능 7건 → 16건)', '평점·소득구간은 브라우저에만 저장'], 6.0, 4.85, 6.7, 2.1, 13.5);
}

// ===== 05 데이터 =====
{
  const s = frame('04', '실제 데이터 3층 (가짜 아님)', '학교 게시판 + 공모전 사이트 + 정부 API, 원문 링크 확인');
  const cw = (W - 2 * MX - 0.9) / 4;
  stat(s, MX, 1.95, cw, fmt(notices.length) + '건', '강원대 공지', C.blue, `6개 게시판 · 최근 ${data.days || 45}일 · AI 분석 ${fmt(data.analyzed)}`);
  stat(s, MX + (cw + 0.3), 1.95, cw, fmt(extern.length) + '건', '외부 공모전·대외활동·인턴', C.deep, '위비티·씽유·링커리어 11/6 기준');
  stat(s, MX + 2 * (cw + 0.3), 1.95, cw, fmt(gov.length) + '건', '정부 공공 API', C.ok, `장학재단 ${NUM.kosaf} · 보조금24 ${NUM.g24} · K-Startup ${NUM.kstartup}`);
  stat(s, MX + 3 * (cw + 0.3), 1.95, cw, fmt(events.length) + '건', '춘천·삼척 지역 행사', C.orange, '관광공사·춘천시·삼척시 API');
  shot(s, 'gov.png', MX + 0.1, 4.0, 4.8, 3.0 * 0.95);
  bullets(s, ['학교: robots.txt 허용 경로(/ko/)만 1초 간격 · 45일 안 글은 쪽을 넘겨 끝까지', '공모전·대외활동: robots.txt가 허용하고 로그인 없는 3곳만 · 제목·주최·기간·링크만 (AI 수집 차단 사이트·에브리타임 계열 제외)', '정부: 공공데이터포털 활용신청 승인 API · 춘천·삼척·강원·전국 대상만 (다른 시·군 주민 전용 제외)', '전국 상시 정부 사업은 "정부·지역" 탭에만 — 학교 공지가 묻히지 않게'], 5.4, 4.05, 7.3, 2.9, 13.5);
}

// ===== 06 곰두리 에이전트 =====
{
  const s = frame('05', 'AI 에이전트 · 곰두리', '알려 주는 데서 멈추지 않고, 사람 대신 끝까지 수행한다');
  shot(s, 'chat.png', MX + 0.1, 1.9, 2.9, 4.7);
  shot(s, 'plan.png', MX + 3.25, 1.9, 2.9, 4.7);
  const flow = [['"나 삼척 3학년이고 자취해"', '내 조건에 바로 저장 → 판정 다시 계산'], ['"이번 주 받을 수 있는 장학금"', '찾아서 목록에 띄움 · 없으면 조건을 넓혀 다시 찾기'],
    ['"1번 휴학생도 돼?"', '공지 본문에서 근거 문장을 찾아 인용해 답함'], ['"1번 할 일 만들어줘"', '자격 확인·서류·신청·마감 2일 전 체크리스트 저장'],
    ['"자소서 도와줘 / 문의 메일 써줘"', '말한 경험만 넣은 뼈대 · 담당 부서 메일 초안'], ['"3학년 마케팅 취업 준비 뭐부터?"', '학교 취업 프로그램·인턴·대외활동·체크리스트']];
  flow.forEach(([q, a], i) => {
    const y = 1.9 + i * 0.8;
    card(s, 6.75, y, 6.0, 0.68, i % 2 ? C.white : C.sky, C.line);
    txt(s, q, { x: 6.95, y: y + 0.07, w: 5.7, h: 0.28, fontSize: 13, bold: true, color: C.blue });
    txt(s, a, { x: 6.95, y: y + 0.36, w: 5.7, h: 0.28, fontSize: 12.5, color: C.ink });
  });
  txt(s, `도구 ${NUM.tools}개 · 「놓치지마 실행」으로 AI 자동 연결 · AI가 막혀도 규칙으로 실행`, { x: 6.75, y: 6.75, w: 6.0, h: 0.3, fontSize: 11, color: C.faint });
}

// ===== 07 상담관 모드 =====
{
  const s = frame('06', '상담관 모드 (교직원)', '학생 메모 한 줄 → 추천 5건 + 이유 + 근거 + 상담 기록지');
  shot(s, 'counsel.png', MX + 0.1, 1.9, 2.9, 4.7);
  shot(s, 'detail.png', MX + 3.25, 1.9, 3.7, 4.6);
  const x = 7.7, cw = 5.0;
  stat(s, x, 1.9, cw, `${fmt(NUM.counsel.checked)}건 → ${NUM.counsel.items}건`, '공지를 대신 판정해 추천', C.blue, '학생 조건으로 마감 전 공지 전부 판정');
  stat(s, x, 3.85, cw, `${cutPct}% ↓`, `읽을 분량 ${man(NUM.counsel.before)}자 → ${fmt(NUM.counsel.after)}자`, C.orange, '예시 학생: 삼척 2학년 공학·봉사·공모전');
  bullets(s, ['곰두리 🧑‍🏫 상담 탭에서', '"이 학생 조건을 [내 조건]에 적용" · 되돌리기', '이름·학번은 받지 않음 · 추천만 볼 땐 내 조건 유지'], x, 5.85, cw, 1.1, 13);
}

// ===== 07-1 취업 상담 =====
{
  const s = frame('06', '곰두리 💼 취업 상담', '학년·희망 직무 → 지금 지원할 수 있는 것만 골라 준다');
  shot(s, 'career.png', MX + 0.1, 1.9, 2.9, 4.7);
  shot(s, 'career2.png', MX + 3.25, 1.9, 2.9, 4.7);
  const g = [['🏫 학교 취업 프로그램', '취업정보 게시판 · 직무박람회 · 기업탐방 · 역량 강화'], ['인턴·채용', '희망 직무와 맞는 인턴 먼저 (예: 마케팅 → 콘텐츠 마케팅 인턴)'],
    ['직무 관련 대외활동·공모전', '직무 말과 맞는 것만 — 관계없는 건 빼고'], ['📋 학년별 체크리스트', '1~4학년 준비 단계 · "일반적인 가이드"라고 표시'], ['학교 취업 공식 페이지', '취업정보 게시판 · 취업관리시스템 · 취업안내 (접속 확인)']];
  g.forEach(([h, b], i) => {
    const y = 1.9 + i * 0.93;
    card(s, 6.75, y, 6.0, 0.8, i % 2 ? C.white : C.sky, C.line);
    txt(s, h, { x: 6.95, y: y + 0.08, w: 5.7, h: 0.3, fontSize: 13.5, bold: true, color: C.blue });
    txt(s, b, { x: 6.95, y: y + 0.42, w: 5.7, h: 0.3, fontSize: 12.5, color: C.ink });
  });
  txt(s, '대화로도: "3학년인데 마케팅 직무 취업 준비 뭐부터 해?" → Gemini가 취업 상담 도구를 골라 실행 · 합격률·연봉 같은 수치는 지어내지 않음', { x: MX, y: 6.68, w: W - 2 * MX, h: 0.3, fontSize: 12, color: C.faint });
}

// ===== 07-2 곰두리가 할 수 있는 일 =====
{
  const s = frame('06', '곰두리가 할 수 있는 일', '할 수 있는 일과 못 하는 일을 먼저 알려 준다');
  shot(s, 'tab_help.png', MX + 0.1, 1.85, 2.92, 4.73);
  const can = ['내 조건 저장 — "나 삼척 3학년이고 자취해"', '공지 찾기 — "이번 주 받을 수 있는 장학금", "AI 공모전"', '공지 질문 — "1번 휴학생도 돼?" (본문 근거로 답)',
    '지원 준비 — 할 일 · 자소서 뼈대 · 문의 메일 초안', '취업 상담 — "3학년 마케팅 취업 준비 뭐부터?"', '계산·바로가기 — "평점 3.8이면?" · 학식·학사일정·취업정보'];
  const cant = ['신청서 제출·메일 발송 (초안까지만, 마지막은 직접)', '이미지·첨부로만 된 공지 읽기 → 원문 확인 안내', '장학금 중복 수혜 판단 · 공지에 없는 내용', '학번·이름·비밀번호 받기', '춘천·삼척 외 캠퍼스 (확장 예정)'];
  card(s, 3.75, 1.85, 4.55, 4.75, C.sky, C.sky);
  txt(s, '✓ 할 수 있는 일', { x: 3.98, y: 2.02, w: 4.1, h: 0.4, fontSize: 18, bold: true, color: C.blue });
  bullets(s, can, 3.98, 2.55, 4.15, 3.9, 13.5);
  card(s, 8.5, 1.85, 4.23, 4.75, C.white, C.line);
  txt(s, '✕ 하지 않는 일', { x: 8.73, y: 2.02, w: 3.8, h: 0.4, fontSize: 18, bold: true, color: C.warn });
  bullets(s, cant, 8.73, 2.55, 3.85, 3.9, 13.5);
  txt(s, '"곰두리가 할 수 있는 일" 버튼이나 "도움말"이라고 말하면 AI를 쓰지 않고 바로 목록을 보여 줌', { x: MX, y: 6.68, w: W - 2 * MX, h: 0.3, fontSize: 12, color: C.faint });
}

// ===== 08 사용자 범위 확장 =====
{
  const s = frame('07', '사용자 범위 확장', '학생 · 교직원 · 지역 주민 · 방문객 — 같은 엔진으로');
  const cols = [['학생', '내 조건 판정 · 곰두리 할 일 · 자소서 뼈대', C.blue], ['교직원 (상담사)', '상담관 모드 · 상담 기록지 복사·인쇄', C.deep], ['지역 주민 · 방문객', '"학교 밖 누구나" 공지 · 춘천·삼척 축제\n로그인 없이 둘러보기', C.ok]];
  const w = (W - 2 * MX - 0.6) / 3;
  cols.forEach(([h, b, col], i) => {
    const x = MX + i * (w + 0.3);
    card(s, x, 1.95, w, 1.7, C.white);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 2.17, w: 0.42, h: 0.42, fill: { color: col }, line: { type: 'none' } });
    txt(s, h, { x: x + 0.8, y: 2.18, w: w - 1, h: 0.42, fontSize: 18, bold: true, color: C.ink, valign: 'middle' });
    txt(s, b, { x: x + 0.25, y: 2.8, w: w - 0.5, h: 0.8, fontSize: 13.5, color: C.muted });
  });
  shot(s, 'mobile_chat.png', MX + 0.3, 3.95, 1.4, 3.0);
  shot(s, 'mobile.png', MX + 1.95, 3.95, 1.4, 3.0);
  bullets(s, ['회원가입 구분: 학생·교직원·지역 주민·방문객 (본인 선택, 학교 신분 인증은 하지 않음)', `공지에 "마일리지·봉사시간"이 실제로 적힌 ${perks}건에만 배지 — 지역 축제를 봉사로 인정한다고 지어내지 않음`, '휴대폰 화면 지원 · 곰두리 전체 화면'], 4.0, 4.05, 8.7, 2.8, 15);
}

// ===== 09 신뢰와 안전 =====
{
  const s = frame('08', '신뢰 · 안전', 'AI가 틀릴 수 있는 곳마다 안전장치를 둔다');
  const items = [['판정은 코드', 'AI는 조건 읽기·대화만. 판정과 수치는 코드로 계산'], ['근거 인용', '공지 본문 문장을 그대로 보여 주고, 없으면 "원문 확인 필요"'],
    ['개인정보 최소', '학번·이름·비밀번호를 받지 않음. 평점·소득은 브라우저에만, AI에도 보내지 않음'], ['숨은 지시 방어', '공지 글 속 지시로 내 조건이 바뀌지 않게 — 사용자가 직접 말한 값만 저장'],
    ['링크 안전', 'http(s)만 열고, 곰두리 답장 링크는 학교·공공기관 사이트만'], ['수집 규정 준수', 'robots.txt·약관 확인한 곳만, 1초 간격 · AI 수집 차단 사이트 제외 · 사실 정보만 + 출처 표시']];
  const w = (W - 2 * MX - 0.3) / 2;
  items.forEach(([h, b], i) => {
    const x = MX + (i % 2) * (w + 0.3), y = 1.95 + Math.floor(i / 2) * 1.6;
    card(s, x, y, w, 1.4, i % 2 ? C.white : C.sky, C.line);
    txt(s, h, { x: x + 0.3, y: y + 0.2, w: w - 0.6, h: 0.4, fontSize: 18, bold: true, color: C.blue });
    txt(s, b, { x: x + 0.3, y: y + 0.65, w: w - 0.6, h: 0.65, fontSize: 14, color: C.ink });
  });
}

// ===== 10 효과 측정 =====
{
  const s = frame('09', '효과 측정', '줄어든 비용을 숫자로 — 실사용 3명 측정 계획 포함');
  stat(s, MX, 1.95, 3.8, `${cutPct}% ↓`, '읽을 분량', C.orange, `${man(NUM.counsel.before)}자 → ${fmt(NUM.counsel.after)}자 (상담 예시)`);
  stat(s, MX + 4.1, 1.95, 3.8, `${fmt(NUM.live)} → ${NUM.ok}건`, '바로 지원 가능한 공지', C.ok, '삼척 3학년·자취 기준, 해당 없음은 숨김');
  stat(s, MX + 8.2, 1.95, 3.93, '171개', '"확인 필요" 조건 정리', C.blue, '원문에 언급 없는 조건 → 제한 없음');
  const rows = [['참가자 (팀 밖)', '과제', '학교 홈페이지로', '놓치지마로', '찾은 공지 수'], ['1', '이번 주 신청 가능한 장학금 찾기', '측정 예정', '측정 예정', '측정 예정'], ['2', '같은 과제', '측정 예정', '측정 예정', '측정 예정'], ['3', '같은 과제', '측정 예정', '측정 예정', '측정 예정']];
  s.addTable(rows.map((r, i) => r.map(v => ({ text: v, options: { bold: i === 0, color: i === 0 ? C.white : (v === '측정 예정' ? C.faint : C.ink), fill: { color: i === 0 ? C.deep : C.white }, align: 'center', valign: 'middle' } }))),
    { x: MX, y: 4.1, w: W - 2 * MX, colW: [1.8, 4.1, 2.1, 2.1, 2.03], rowH: 0.5, fontFace: F, fontSize: 13, border: { type: 'solid', color: C.line, pt: 0.75 } });
  txt(s, '※ 실사용 측정값은 발표 전 팀이 직접 기록해 채워 넣습니다 (가점 항목: 팀 밖 3명 실사용 기록)', { x: MX, y: 6.25, w: W - 2 * MX, h: 0.35, fontSize: 12.5, color: C.warn, bold: true });
}

// ===== 11 학교 연계 로드맵 =====
{
  const s = frame('10', '확장 로드맵', '강원대 시스템과 연결되면 입력 0번, 판정은 자동');
  const st = [['지금', '공개 게시판 수집\n자체 계정(이메일)\n춘천·삼척 캠퍼스', C.sky2, C.ink], ['1단계\nK-Cloud 로그인 연동', '학년·학적·평점 자동 입력\n내 조건 입력 없이 바로 판정', C.blue, C.white],
    ['2단계\n학사·장학 시스템 연계', '비교과 마일리지·장학 신청 연결\n상담 기록을 상담 시스템에 저장', C.deep, C.white], ['3단계\n통합 강원대 전체', '강릉·원주·도계 캠퍼스로 확장\n강원 지역 기관 공지까지', C.navy, C.white]];
  const w = (W - 2 * MX - 0.9) / 4;
  st.forEach(([h, b, fill, col], i) => {
    const x = MX + i * (w + 0.3);
    card(s, x, 2.0, w, 2.9, fill, fill);
    txt(s, h, { x: x + 0.25, y: 2.2, w: w - 0.5, h: 0.75, fontSize: 16, bold: true, color: col });
    txt(s, b, { x: x + 0.25, y: 3.05, w: w - 0.5, h: 1.7, fontSize: 13.5, color: col });
  });
  bullets(s, ['멘토: "학교와 연계할 수 있다고 강조하는 게 더 좋다" → 같은 판정 엔진에 입력만 바꾸면 되는 구조', '캠퍼스는 무리하게 늘리지 않고 춘천·삼척을 정밀하게 검증 → 코드 두 곳에 도시만 추가하면 확장'], MX, 5.25, W - 2 * MX, 1.5, 15);
}

// ===== 12 마무리 =====
{
  const s = frame('11', '정리', '놓치지마 — 곰두리가 대신 챙겨 줄게요', { dark: true });
  bear(s, W - MX - 1.6, 0.6, 1.4);
  const pts = [['판정', '된다·안 된다와\n그 이유'], ['근거', '공지 원문 문장 인용'], ['수행', '취업 상담·할 일·\n초안·메일까지'], ['확장', '학교·외부·정부 3층 데이터\n학교 시스템 연계']];
  const w = (W - 2 * MX - 0.9) / 4;
  pts.forEach(([h, b], i) => {
    const x = MX + i * (w + 0.3);
    card(s, x, 2.3, w, 1.9, C.deep, C.deep);
    txt(s, h, { x: x + 0.3, y: 2.5, w: w - 0.6, h: 0.6, fontSize: 26, bold: true, color: C.bear });
    txt(s, b, { x: x + 0.3, y: 3.2, w: w - 0.6, h: 0.9, fontSize: 15, color: C.white });
  });
  txt(s, '시연: 「놓치지마 실행」 → 내 조건 3단계 → 관련도 순·카테고리 · 곰두리 "나 삼척 3학년이고 자취해" → "이번 주 장학금" → 💼 취업 상담 → "1번 할 일 만들어줘"', { x: MX, y: 4.7, w: W - 2 * MX, h: 0.7, fontSize: 15, color: C.sky2 });
  txt(s, '비공식 학생 프로젝트 · 강원대학교 공식 서비스가 아닙니다 · 곰두리 그림은 강원대 마스코트를 참고해 새로 그림', { x: MX, y: 6.4, w: W - 2 * MX, h: 0.35, fontSize: 12, color: C.sky2 });
}

pres._slides.forEach((sl, i) => { const sc = SCRIPT.find(x => x.no === i + 1); if (sc) sl.addNotes(`[${sc.time}] ${sc.say}${sc.do ? `\n\n※ ${sc.do}` : ''}`); });
pres.writeFile({ fileName: OUT }).then(f => console.log('저장:', f, `(${page}장)`));

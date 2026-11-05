// 놓치지마 — 5분 발표용 (핵심 장점 4개만, 7장)
// 수치는 data/*.json과 nums.json(화면에서 계산한 값)에서 읽는다. 손으로 쓴 수치 없음.
// 실행: node build-deck-5min.cjs [저장 경로]   (pptxgenjs 필요)
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/user/Desktop/AI/공모전/해커톤/자격판정기';
const OUT = process.argv[2] || 'C:/Users/user/Desktop/KNU_놓치지마_발표_5분.pptx';
const SHOT = n => path.join(ROOT, 'scripts/deck/shots2', n);
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/notices.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/raw.json'), 'utf8'));
const NUM = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/deck/nums.json'), 'utf8'));
const SCRIPT = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/deck/script5.json'), 'utf8')).slides; // 발표 대본 → 발표자 노트

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
const D5 = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/deck/nums5.json'), 'utf8')); // shots5.cjs가 화면에서 센 예시 학생 수치

// ===== 01 표지 =====
{
  page++;
  const s = pres.addSlide(); s.background = { color: C.navy };
  bear(s, MX, 1.25, 1.35);
  s.addImage({ path: SHOT('../gomduri_draw_full.png'), x: 9.0, y: 0.9, w: 3.6, h: 4.5 });
  txt(s, '2026 KNU AI 해커톤 · Zero to One', { x: MX, y: 2.85, w: 9, h: 0.4, fontSize: 16, bold: true, color: C.sky2 });
  txt(s, '놓치지마', { x: MX, y: 3.3, w: 9, h: 1.2, fontSize: 66, bold: true, color: C.white });
  txt(s, '내 조건으로 판정하고,\n곰두리가 끝까지 챙겨 주는 강원대 공지 AI', { x: MX, y: 4.55, w: 8.2, h: 1.0, fontSize: 24, bold: true, color: C.bear });
  txt(s, `춘천·삼척 캠퍼스 · 데이터 기준 ${ymd} · 비공식 학생 프로젝트`, { x: MX, y: 6.6, w: 9, h: 0.3, fontSize: 11, color: C.sky2 });
}

// ===== 02 문제 =====
{
  const s = frame('', '문제', '공지를 하나씩 열어 "나도 되나?"를 직접 판단한다');
  const cw = (W - 2 * MX - 0.9) / 4;
  stat(s, MX, 1.9, cw, fmt(notices.length) + '건', `최근 ${data.days || 45}일 학교 공지`, C.blue, '6개 게시판 합계');
  stat(s, MX + (cw + 0.3), 1.9, cw, man(chars) + '자', '공지 본문 분량', C.orange, '제목+본문, 첨부 제외');
  stat(s, MX + 2 * (cw + 0.3), 1.9, cw, fmt(files) + '개', '첨부파일', C.deep, '조건이 첨부에 숨음');
  stat(s, MX + 3 * (cw + 0.3), 1.9, cw, fmt(imgOnly) + '건', '이미지로만 된 공지', C.warn, '검색조차 안 됨');
  txt(s, '학생이 지금 하는 일', { x: MX, y: 3.95, w: 6, h: 0.35, fontSize: 15, bold: true, color: C.faint });
  const flow = [['게시판 6곳 돌기', '장학·공모·행사·학사·일반·취업정보'], ['공지·첨부 열기', `본문 ${man(chars)}자 · 첨부 ${fmt(files)}개`], ['자격 직접 판단', '"나도 되나?" 캠퍼스·학년·평점·소득'], ['결과', '마감을 놓치거나\n해당돼도 지원 안 함']];
  const fw = (W - 2 * MX - 0.9) / 4;
  flow.forEach(([h, b], i) => {
    const x = MX + i * (fw + 0.3), last = i === 3;
    card(s, x, 4.4, fw, 2.1, last ? C.warnBg : C.sky, last ? C.warnBg : C.sky);
    if (!last) {
      s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 4.6, w: 0.5, h: 0.5, fill: { color: C.blue }, line: { type: 'none' } });
      txt(s, String(i + 1), { x: x + 0.25, y: 4.6, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle' });
    } else txt(s, '⚠', { x: x + 0.25, y: 4.6, w: 0.5, h: 0.5, fontSize: 22, bold: true, color: C.warn, align: 'center', valign: 'middle' });
    txt(s, h, { x: x + 0.25, y: 5.25, w: fw - 0.5, h: 0.45, fontSize: 17, bold: true, color: last ? C.warn : C.ink });
    txt(s, b, { x: x + 0.25, y: 5.72, w: fw - 0.5, h: 0.7, fontSize: 13, color: C.muted });
    if (i < 3) s.addText('›', { x: x + fw, y: 5.1, w: 0.3, h: 0.6, fontFace: F, fontSize: 28, bold: true, color: C.sky2, align: 'center', margin: 0, isTextBox: true });
  });
}

// ===== 03 장점 ① 판정 =====
{
  const s = frame('', '장점 ① 판정', '된다·안 된다와 그 이유까지 — 판정은 AI가 아니라 코드');
  const steps = [['AI가 조건 읽기', 'Gemini가 공지에서 캠퍼스·학년·평점·서류·마감 추출', C.blue], ['코드가 판정', '내 조건과 비교 → 같은 조건이면 언제나 같은 결과', C.ok], ['이유 표시', '카드마다 "✓ 캠퍼스 삼척 대상" 같은 근거', C.bearD]];
  const lw = 5.6;
  steps.forEach(([h, b, col], i) => {
    const y = 1.9 + i * 1.02;
    card(s, MX, y, lw, 0.88, C.white);
    s.addShape(pres.shapes.OVAL, { x: MX + 0.2, y: y + 0.19, w: 0.5, h: 0.5, fill: { color: col }, line: { type: 'none' } });
    txt(s, String(i + 1), { x: MX + 0.2, y: y + 0.19, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle' });
    txt(s, h, { x: MX + 0.88, y: y + 0.1, w: lw - 1.05, h: 0.36, fontSize: 16, bold: true, color: C.ink });
    txt(s, b, { x: MX + 0.88, y: y + 0.47, w: lw - 1.05, h: 0.33, fontSize: 12.5, color: C.muted });
  });
  stat(s, MX, 5.0, lw, `${fmt(D5.all)} → ${fmt(D5.ok)}건`, '바로 지원 가능한 공지만 먼저', C.ok, `예시: ${D5.profile}`);
  shot(s, 'judge_cards.png', 6.6, 1.9, 6.1, 6.1 * 1330 / 1872);
  txt(s, '실제 화면 · 원문에 근거가 없으면 "확인 필요"로 표시하고, 모든 카드에 원문 링크', { x: 6.6, y: 6.35, w: 6.1, h: 0.35, fontSize: 12, color: C.faint });
}

// ===== 04 장점 ② Gemini 학과 맞춤 추천 =====
{
  const s = frame('', '장점 ② 학과 맞춤 · Gemini 추천', '학과를 넣는 순간 Gemini가 공지를 읽고 골라 준다');
  const A = D5.ai;
  shot(s, 'aipick_cards.png', MX + 0.05, 1.9, 6.5, 6.5 * 900 / 1404);
  txt(s, '실제 화면 · 카드마다 "Gemini 추천" 배지와 이유 한 줄', { x: MX + 0.05, y: 6.2, w: 6.5, h: 0.35, fontSize: 12, color: C.faint });
  const x = 7.35, rw = W - MX - x;
  shot(s, 'aipick_box.png', x, 1.9, rw, rw * 300 / 960);
  const sw = (rw - 0.3) / 2;
  stat(s, x, 3.85, sw, `${fmt(A.picked)}건`, 'Gemini 추천', C.blue, `공지 ${fmt(A.checked)}건 읽음`);
  stat(s, x + sw + 0.3, 3.85, sw, `${fmt(A.hiddenCol)}건`, '다른 계열 숨김', C.orange, '규칙 매칭');
  txt(s, `"${A.major}" · ${A.at} 실제 실행\nAI가 막히면 "AI 아님 · 규칙 매칭"이라고 그대로 표시`, { x, y: 5.8, w: rw, h: 0.75, fontSize: 12.5, color: C.muted });
}

// ===== 05 장점 ③ 곰두리 =====
{
  const s = frame('', '장점 ③ 곰두리 에이전트', '알려 주고 끝이 아니라, 말하면 대신 해 준다');
  shot(s, 'chat5.png', MX + 0.1, 1.9, 2.9, 4.7);
  shot(s, 'plan5.png', MX + 3.25, 1.9, 2.9, 4.7);
  const flow = [['"나 삼척 3학년이고 자취해"', '내 조건 저장 → 판정 다시 계산'], ['"이번 주 받을 수 있는 장학금 찾아줘"', '찾아서 카드로 보여 줌'], ['"1번 할 일 만들어줘"', '자격 확인·서류·신청·마감 체크리스트 저장'], ['"문의 메일 써줘"', '담당 부서 문의 메일 초안 (발송은 직접)']];
  flow.forEach(([q, a], i) => {
    const y = 1.9 + i * 1.05;
    card(s, 6.75, y, 6.0, 0.88, i % 2 ? C.white : C.sky, C.line);
    txt(s, q, { x: 6.98, y: y + 0.1, w: 5.6, h: 0.32, fontSize: 15, bold: true, color: C.blue });
    txt(s, a, { x: 6.98, y: y + 0.47, w: 5.6, h: 0.32, fontSize: 13.5, color: C.ink });
  });
  txt(s, 'AI 한도가 차도 같은 기능이 규칙 모드로 동작 (화면은 규칙 모드에서 캡처)', { x: 6.75, y: 6.2, w: 6.0, h: 0.4, fontSize: 12, color: C.faint });
}

// ===== 06 장점 ④ 실제 데이터 =====
{
  const s = frame('', '장점 ④ 실제 데이터 3층', '학교 + 외부 공모전 + 공공 API — 전부 원문 링크');
  const cw = (W - 2 * MX - 0.6) / 3;
  const cols = [[fmt(notices.length) + '건', '강원대 공지', C.blue, `6개 게시판 · 최근 ${data.days || 45}일`, ['장학', '공모', '행사', '학사', '일반', '취업정보']],
    [fmt(extern.length) + '건', '외부 공모전·대외활동·인턴', C.deep, '사이트 기준 날짜 표시', ['위비티', '씽유', '링커리어 공모전', '링커리어 대외활동', '링커리어 인턴']],
    [fmt(gov.length) + '건', '정부·공공 API 7종', C.ok, '공공데이터포털·고용24 승인', ['한국장학재단', '보조금24', 'K-Startup', '복지로', 'Q-Net 시험일정', '고용24 일학습병행', '국가장학금 통계']]];
  cols.forEach(([num, label, col, sub, chips], i) => {
    const x = MX + i * (cw + 0.3);
    stat(s, x, 1.9, cw, num, label, col, sub);
    card(s, x, 3.8, cw, 2.05, C.sky, C.sky);
    let cx = x + 0.2, cy = 3.98;
    for (const c of chips) {
      const w = 0.3 + c.length * 0.15;
      if (cx + w > x + cw - 0.15) { cx = x + 0.2; cy += 0.5; }
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w, h: 0.38, rectRadius: 0.19, fill: { color: C.white }, line: { color: C.sky2, width: 0.75 } });
      txt(s, c, { x: cx, y: cy, w, h: 0.38, fontSize: 11.5, bold: true, color: col, align: 'center', valign: 'middle' });
      cx += w + 0.12;
    }
  });
  card(s, MX, 6.05, W - 2 * MX, 0.7, C.white, C.line);
  txt(s, `✓ robots.txt·약관이 허용한 곳만   ✓ 로그인 필요한 커뮤니티는 수집 안 함   ✓ 수집 기준 ${ymd} · 화면에 확인 시각 표시`, { x: MX + 0.3, y: 6.05, w: W - 2 * MX - 0.6, h: 0.7, fontSize: 13.5, color: C.ink, valign: 'middle' });
}

// ===== 07 정리 =====
{
  const s = frame('', '정리', '놓치지마 — 곰두리가 대신 챙겨 줄게요', { dark: true });
  bear(s, W - MX - 1.6, 0.6, 1.4);
  const pts = [['판정', '된다·안 된다와\n그 이유'], ['Gemini 추천', '학과를 넣으면\nAI가 읽고 골라 줌'], ['곰두리', '찾기·할 일·\n문의 초안까지'], ['실제 데이터', '학교·외부·정부\n원문 링크']];
  const w = (W - 2 * MX - 0.9) / 4;
  pts.forEach(([h, b], i) => {
    const x = MX + i * (w + 0.3);
    card(s, x, 2.15, w, 1.8, C.deep, C.deep);
    txt(s, h, { x: x + 0.3, y: 2.35, w: w - 0.6, h: 0.6, fontSize: 24, bold: true, color: C.bear });
    txt(s, b, { x: x + 0.3, y: 3.0, w: w - 0.6, h: 0.85, fontSize: 15, color: C.white });
  });
  txt(s, '30초 시연', { x: MX, y: 4.3, w: 4, h: 0.4, fontSize: 15, bold: true, color: C.sky2 });
  const demo = ['학과 "컴퓨터공학과" 판정 → Gemini 추천 묶음', '곰두리 "이번 주 장학금 찾아줘"', '"1번 할 일 만들어줘" → 체크리스트'];
  const dw = (W - 2 * MX - 0.6) / 3;
  demo.forEach((t, i) => {
    const x = MX + i * (dw + 0.3);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.8, w: dw, h: 0.85, rectRadius: 0.42, fill: { color: C.navy }, line: { color: C.bear, width: 1 } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: 4.97, w: 0.5, h: 0.5, fill: { color: C.bear }, line: { type: 'none' } });
    txt(s, String(i + 1), { x: x + 0.18, y: 4.97, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.navy, align: 'center', valign: 'middle' });
    txt(s, t, { x: x + 0.82, y: 4.8, w: dw - 1.0, h: 0.85, fontSize: 13.5, bold: true, color: C.white, valign: 'middle' });
  });
  txt(s, '비공식 학생 프로젝트 · 강원대학교 공식 서비스가 아닙니다 · 곰두리 그림은 강원대 마스코트를 참고해 새로 그림', { x: MX, y: 6.4, w: W - 2 * MX, h: 0.35, fontSize: 12, color: C.sky2 });
}

pres._slides.forEach((sl, i) => { const sc = SCRIPT.find(x => x.no === i + 1); if (sc) sl.addNotes(`[${sc.time}] ${sc.say}${sc.do ? `\n\n※ ${sc.do}` : ''}`); });
console.log('수치 확인:', { school: notices.length, chars, files, imgOnly, extern: extern.length, gov: gov.length, D5 });
pres.writeFile({ fileName: OUT }).then(f => console.log('저장:', f, `(${page}장)`));

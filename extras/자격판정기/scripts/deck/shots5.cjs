// 5분 발표용 화면 캡처 (바탕화면 단독 HTML 기준). AI 한도가 차 있으면 곰두리는 규칙 모드 화면이 찍힌다.
// 실행: NODE_PATH=%TEMP%/knu-deck/node_modules node scripts/deck/shots5.cjs
const p = require('puppeteer-core'), path = require('path');
const OUT = path.join(__dirname, 'shots2'), URL = 'file:///C:/Users/user/Desktop/KNU_놓치지마.html';
const PROFILE = { campus: '삼척', grade: '3', residence: '자취', interests: ['AI·SW', '취업·진로'] };
(async () => {
  const b = await p.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 240000 });
  const sl = ms => new Promise(r => setTimeout(r, ms));
  const g = await b.newPage(); await g.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  const errs = []; g.on('pageerror', e => errs.push(e.message));
  await g.goto(URL); await g.evaluate(P => { localStorage.clear(); localStorage.setItem('knu-setup-seen', '1'); localStorage.setItem('knu-elig-profile', JSON.stringify(P)); }, PROFILE); await g.reload(); await sl(1200);
  // 1) 학과 → 계열 판정 팝업
  await g.evaluate(() => openSetup(2)); await g.type('#f-major', '컴퓨터공학과'); await g.click('#major-go');
  await g.waitForFunction(() => !document.getElementById('major-go').disabled, { timeout: 15000 }); await sl(400);
  await (await g.$('#setup')).screenshot({ path: path.join(OUT, 'major.png') });
  await g.evaluate(() => document.getElementById('setup').close()); await sl(300);
  // 2) 계열·주제로 묶인 판정 결과
  await g.addStyleTag({ content: '#toast,.gd-fab{visibility:hidden!important}' });
  await g.setViewport({ width: 1000, height: 900, deviceScaleFactor: 2 }); await sl(500);
  await g.evaluate(() => scrollTo(0, 0)); await sl(300);
  const c = await g.evaluate(() => { const a = document.getElementById('status-tabs').getBoundingClientRect(), r = document.getElementById('results').getBoundingClientRect(); return { x: r.x, y: a.y + scrollY - 12, width: r.width }; });
  await g.screenshot({ path: path.join(OUT, 'grouped.png'), clip: { ...c, height: 980 }, captureBeyondViewport: true });
  await g.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 }); await sl(300);
  const nums = await g.evaluate(() => ({ all: +document.querySelector('[data-count="all"]').textContent, ok: +document.querySelector('[data-count="ok"]').textContent, warn: +document.querySelector('[data-count="warn"]').textContent, hiddenCol: +((document.getElementById('res-sub').textContent.match(/다른 계열 공지 (\d+)건/) || [])[1] || 0), colMatch: +((document.getElementById('col-status').textContent.match(/맞춤 공지 (\d+)건/) || [])[1] || 0) }));
  require('fs').writeFileSync(path.join(__dirname, 'nums5.json'), JSON.stringify({ profile: '삼척 3학년 · 자취 · 컴퓨터공학과(공학·IT) · 관심 AI·SW·취업', ...nums }, null, 1));
  // 3) 곰두리 대화
  const send = async t => { await g.evaluate(t => gdSend(t), t); await g.waitForFunction(() => !GD.busy, { timeout: 120000 }); };
  await g.evaluate(() => gdOpen());
  await send('나 삼척 3학년이고 자취해'); await send('이번 주 내가 받을 수 있는 장학금 찾아줘'); await sl(300);
  const mode = await g.evaluate(() => document.getElementById('gd-mode').textContent);
  await (await g.$('#gd')).screenshot({ path: path.join(OUT, 'chat5.png') });
  await send('1번 할 일 만들어줘'); await sl(300);
  await g.evaluate(() => { const l = document.getElementById('gd-log'); l.scrollTop = l.scrollHeight; }); await sl(200);
  await (await g.$('#gd')).screenshot({ path: path.join(OUT, 'plan5.png') });
  console.log('곰두리 모드:', mode, '| 오류:', errs.length ? errs : '없음');
  await b.close();
})();

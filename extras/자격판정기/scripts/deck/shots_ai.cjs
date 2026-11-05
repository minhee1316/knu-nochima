// 곰두리 화면 캡처를 AI 모드로 다시 찍는다 (로컬 서버 http://localhost:5178 필요: 바탕화면 「놓치지마 실행」)
// AI가 실제로 답했을 때만 shots2/의 그림을 바꾼다. 규칙 모드면 아무것도 바꾸지 않고 종료 코드 2.
// 실행: NODE_PATH=%TEMP%/knu-deck/node_modules node scripts/deck/shots_ai.cjs
const p = require('puppeteer-core'), fs = require('fs'), path = require('path'), os = require('os');
const OUT = path.join(__dirname, 'shots2'), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'knu-shots-'));
(async () => {
  const b = await p.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 240000 });
  const sl = ms => new Promise(r => setTimeout(r, ms)), mode = [];
  const g = await b.newPage(); await g.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await g.goto('http://localhost:5178/'); await g.evaluate(() => { localStorage.clear(); localStorage.setItem('knu-setup-seen', '1'); }); await g.reload(); await sl(1500);
  const send = async t => { await g.evaluate(t => gdSend(t), t); await g.waitForFunction(() => !GD.busy, { timeout: 180000 }); mode.push(await g.evaluate(() => document.getElementById('gd-mode').textContent)); };
  const box = async f => (await g.$('#gd')).screenshot({ path: path.join(TMP, f) });
  await g.evaluate(() => gdOpen());
  await send('나 삼척 3학년이고 자취해'); await send('이번 주 내가 받을 수 있는 장학금 찾아줘');
  await g.evaluate(() => { const l = document.getElementById('gd-log'), r = [...l.querySelectorAll('.gd-row')]; l.scrollTop = (r[r.length - 4] || r[0]).offsetTop - 8; }); await sl(300); await box('chat.png');
  await send('1번 할 일 만들어줘'); await g.evaluate(() => gdTab('plans')); await sl(200); await box('plan.png');
  await g.evaluate(() => { gdTab('career'); document.querySelector('[data-cr-grade="3"]').click(); document.querySelector('[data-cr-job="마케팅·콘텐츠"]').click(); document.getElementById('gd-cr-go').click(); document.getElementById('gd-career').scrollTop = 0; }); await sl(300); await box('career.png');
  await g.evaluate(() => { document.getElementById('gd-career').scrollTop = 380; }); await sl(200); await box('career2.png');
  await g.evaluate(() => gdTab('chat')); await send('곰두리가 할 수 있는 일');
  await g.evaluate(() => { const l = document.getElementById('gd-log'), r = [...l.querySelectorAll('.gd-row')].at(-1); l.scrollTop = r.offsetTop - 10; }); await sl(200); await box('tab_help.png');
  await g.evaluate(() => gdTab('counsel')); await g.click('#gd-presets [data-preset="0"]'); await sl(300); await box('counsel.png');
  const m = await b.newPage(); await m.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }); await m.goto('http://localhost:5178/');
  await m.evaluate(() => localStorage.setItem('knu-setup-seen', '1')); await m.reload(); await sl(1500);
  await m.evaluate(() => gdOpen()); await m.evaluate(() => gdSend('주민인데 볼 만한 축제 있어?')); await m.waitForFunction(() => !GD.busy, { timeout: 180000 }); await sl(200);
  mode.push(await m.evaluate(() => document.getElementById('gd-mode').textContent)); await m.screenshot({ path: path.join(TMP, 'mobile_chat.png') });
  await b.close();
  const ai = mode.slice(0, 3).every(t => t && !t.includes('규칙 모드'));
  console.log('곰두리 모드:', mode.join(' | '));
  if (!ai) { console.log('AI 모드가 아니어서 그림을 바꾸지 않았어요.'); process.exit(2); }
  for (const f of fs.readdirSync(TMP)) fs.copyFileSync(path.join(TMP, f), path.join(OUT, f));
  console.log('AI 모드 캡처로 교체:', fs.readdirSync(TMP).join(', '));
})();

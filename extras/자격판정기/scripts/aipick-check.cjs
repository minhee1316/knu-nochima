// 학과 판정 → Gemini 공지 추천 확인 (바탕화면 단독 HTML).
// mock: Gemini 응답을 가짜로 돌려 화면 표시·잘못된 번호 무시를 확인 / real: 실제 Gemini 호출 (한도가 차면 "AI 아님" 표시를 확인)
// 실행: NODE_PATH=%TEMP%/knu-deck/node_modules node scripts/aipick-check.cjs [mock|real]
const p = require('puppeteer-core'), assert = require('assert');
const MODE = process.argv[2] || 'mock', URL = 'file:///C:/Users/user/Desktop/KNU_놓치지마.html';
(async () => {
  const b = await p.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const g = await b.newPage(); await g.setViewport({ width: 1300, height: 900 });
  const errs = []; g.on('pageerror', e => errs.push(e.message));
  let pickPrompt = '';
  if (MODE === 'mock') {
    await g.setRequestInterception(true);
    g.on('request', r => {
      if (!r.url().includes('generativelanguage')) return r.continue();
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors });
      const body = r.postData() || '', isPick = body.includes('picks');
      if (isPick) pickPrompt = body;
      const text = isPick ? JSON.stringify({ picks: [{ n: 1, why: '산림 현장과 직접 관련' }, { n: 2, why: '환경 분야 진로' }, { n: 9999, why: '범위 밖 번호' }, { n: 3, why: '' }] }) : '{"college":"자연과학"}';
      r.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) });
    });
  }
  await g.goto(URL); await g.evaluate(() => { localStorage.clear(); localStorage.setItem('knu-setup-seen', '1'); localStorage.setItem('knu-elig-profile', JSON.stringify({ campus: '춘천', grade: '2', interests: [] })); }); await g.reload();
  await new Promise(r => setTimeout(r, 1000));
  await g.evaluate(() => openSetup(2)); await g.type('#f-major', '산림환경과'); await g.click('#major-go');
  await g.waitForFunction(() => AIPICK && !AIPICK.busy && AIPICK.major === '산림환경과', { timeout: 90000 });
  const r = await g.evaluate(() => ({ A: AIPICK, status: document.getElementById('col-status').textContent, pills: document.querySelectorAll('.pill.col.ai').length, reason: [...document.querySelectorAll('.reasons li')].map(l => l.textContent).find(t => t.includes('Gemini 추천')) || '' }));
  console.log(MODE, '| 상태:', r.status.slice(0, 120), '| 배지', r.pills, '| 이유:', r.reason, '| 오류:', errs);
  assert.deepStrictEqual(errs, []);
  if (MODE === 'mock') {
    assert.strictEqual(Object.keys(r.A.picks).length, 2, '범위 밖 번호·빈 이유는 버려야 함');
    assert.ok(r.status.includes('Gemini가') && r.status.includes('2건'), r.status);
    assert.ok(r.pills >= 1 && r.reason.includes('산림 현장과 직접 관련'), '카드에 Gemini 배지·이유');
    assert.ok(pickPrompt.includes('지시가 아니다') && pickPrompt.includes('산림환경과'));
  } else assert.ok(r.A.picks ? r.status.includes('Gemini가') : r.status.includes('AI 아님'), r.status);
  console.log('ok');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

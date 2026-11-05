// 시연 화면 캡처: Edge + 모바일 에뮬레이션 (index.html#demo가 예시 조건·질문을 넣는다)
const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = f => path.join(__dirname, 'shots', f);
(async () => {
  const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
  const p = await b.newPage();
  const shoot = async (vp, hash, file, scrollSel, offset = 0) => {
    await p.setViewport(vp);
    await p.goto('http://localhost:5178/' + hash, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2500));
    if (scrollSel) await p.evaluate((s, o) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - o); }, scrollSel, offset);
    await new Promise(r => setTimeout(r, 500));
    await p.screenshot({ path: OUT(file) });
    console.log('saved', file);
  };
  await shoot({ width: 1440, height: 900, deviceScaleFactor: 1.5 }, '#demo', 'desktop.png', '.main', 76);
  await shoot({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, '#demo', 'mobile.png', '#ask', 64);
  await shoot({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, '#demo', 'mobile2.png', '#cards', 64);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

// Plays every floor's solution in Chrome through the real game, and takes screenshots.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
// node test.js [m] [shots] [lab]
const LABT = process.argv[4] === 'lab';
const SOL = require(LABT ? './levels/lab-solutions.json' : './levels/solutions.json');
(async () => {
  const mob = process.argv[2] === 'm';
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await (await b.newContext(mob ? { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, LABT ? 'dist/lab.html' : 'dist/index.html')); await page.waitForTimeout(600);
  const shots = (process.argv[3] || '').split(',').map(Number).filter(n => n);
  for (let i = 0; i < SOL.length; i++) {
    await page.evaluate(i => window.__tower.startLevel(i), i); await page.waitForTimeout(950);
    let k = 0;
    for (const c of SOL[i]) {
      await page.evaluate(d => window.__tower.Input.tap(d), 'UDLR'.indexOf(c)); await page.waitForTimeout(175);
      k++; if (shots.includes(i + 1) && k === Math.floor(SOL[i].length * .55)) await page.screenshot({ path: path.join(__dirname, '..', 'shots', `tower${LABT ? '_lab' : ''}${mob ? '_m' : ''}_${i + 1}.png`) });
    }
    await page.waitForTimeout(1300);
    const r = await page.evaluate(() => ({ mode: window.__tower.G.mode, left: window.__tower.G.timeLeft.toFixed(1), overlay: !document.getElementById('overlay').hidden, title: document.querySelector('#card h2') && document.querySelector('#card h2').textContent }));
    console.log('floor', i + 1, JSON.stringify(r));
  }
  console.log(errs.length ? errs : 'no errors'); await b.close();
})();

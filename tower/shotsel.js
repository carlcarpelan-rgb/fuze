const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const mob = process.argv[2] === 'm';
  const page = await (await b.newContext(mob ? { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(__dirname, 'dist/index.html')); await page.waitForTimeout(500);
  await page.evaluate(() => { window.__tower.Save.d.done = { 0: 1, 1: 1, 2: 1 }; window.__tower.showTitle(); }); await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'tower_title' + (mob ? '_m' : '') + '.png') });
  await page.evaluate(() => window.__tower.showSelect()); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'tower_select' + (mob ? '_m' : '') + '.png') });
  const lvl = +(process.argv[3] || 0);
  await page.evaluate(i => window.__tower.startLevel(i), lvl); await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'tower_play' + (mob ? '_m' : '') + '.png') });
  console.log(errs.length ? errs : 'no errors'); await b.close();
})();

const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + __dirname + '/dist/index.html'); await page.waitForTimeout(500);
  const sol = require('./gen/solutions.json'), K = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' };
  await page.evaluate(() => __stubin.startLevel(0)); await page.waitForTimeout(1000);
  for (const c of sol[0]) { await page.keyboard.press(K[c]); await page.waitForTimeout(150); }
  await page.waitForTimeout(1900);
  await page.screenshot({ path: 'shots/medal_win.png' });
  console.log('L1', await page.evaluate(() => JSON.stringify(__stubin.Save.d.medal) + ' pushes=' + __stubin.G.pushes));
  await page.evaluate(() => { __stubin.LEVELS[30] = { m: '..S../...../..#../..O../..B..', t: 90, p: 1 }; __stubin.startLevel(30); });
  await page.waitForTimeout(1000);
  const st = () => page.evaluate(() => { const G = __stubin.G, s = G.st; return 'p=' + s.px + ',' + s.py + ' push=' + G.pushes + ' hole=' + (s.holes[0].filled ? 'F' : 'o') + ' wall=' + s.walls[0].x + ',' + s.walls[0].y + (s.walls[0].gone ? ' gone' : ''); });
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(700);
  console.log('after fill ', await st());
  await page.keyboard.press('z'); await page.waitForTimeout(400); console.log('after undo ', await st());
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(700); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(1900);
  console.log('end mode', await page.evaluate(() => __stubin.G.mode), await st());
  await page.evaluate(() => __stubin.showSelect()); await page.waitForTimeout(300);
  await page.screenshot({ path: 'shots/medal_select.png' });
  console.log(errs.length ? errs : 'no errors'); await browser.close();
})();

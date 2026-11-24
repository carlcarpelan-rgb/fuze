const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + __dirname + '/dist/index.html'); await page.waitForTimeout(500);
  const idx = +process.argv[2] || 60;
  await page.evaluate((idx) => {
    __stubin.LEVELS[idx] = { m: ['X....#S#....X', '.X.I.....I.X.', '..X..O.O..X..', '.....#.#.....', 'X.#.......#.X', '.....#.#.....', '..X..O.O..X..', '.X.I.....I.X.', 'X....#B#....X'].join('/'), t: 90, p: 5 };
    __stubin.startLevel(idx);
  }, idx);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'shots/feat_' + idx + '_0.png' });
  // walk: from S(6,0) go left to (4,0)? path: L is wall at (5,0) -> push it left
  const tap = async s => { for (const ch of s) { await page.evaluate(d => __stubin.Input.tap(d), 'UDLR'.indexOf(ch)); await page.waitForTimeout(190); } };
  await tap('DDDDLU');
  await page.waitForTimeout(60);
  await page.screenshot({ path: 'shots/feat_' + idx + '_1.png' });
  await page.waitForTimeout(600);
  await tap('UULL');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/feat_' + idx + '_2.png' });
  console.log(await page.evaluate(() => { const G = __stubin.G; return 'p=' + G.st.px + ',' + G.st.py + ' pushes=' + G.pushes + ' holes=' + G.st.holes.map(h => h.filled ? 'F' : 'o').join(''); }));
  console.log(errs.length ? errs : 'no errors'); await browser.close();
})();

const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + __dirname + '/dist/index.html'); await page.waitForTimeout(400);
  // synthetic board: hero, 4 free cells, a wall, free cell behind it
  const st = () => page.evaluate(() => { const G = __stubin.G; return 'x=' + G.st.px + ' pushes=' + G.st.walls.map(w => w.x).join(','); });
  await page.evaluate(() => { __stubin.LEVELS[0] = { m: 'S....#...B', t: 60, p: 1 }; __stubin.startLevel(0); });
  await page.waitForTimeout(1000);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250); console.log('quick tap (80ms hold):', await st());
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(180); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(250); console.log('slow release 180ms:  ', await st());
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(200); console.log('held 1.5 s:          ', await st());
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300); console.log('fresh press at wall: ', await st());
  console.log(errs.length ? errs : 'no errors'); await browser.close();
})();

const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + __dirname + '/dist/index.html'); await page.waitForTimeout(500);
  const st = () => page.evaluate(() => { const G = __stubin.G; return G.mode + ' idx=' + G.idx + ' p=' + G.st.px + ',' + G.st.py + ' hist=' + G.history.length + ' t=' + G.timeLeft.toFixed(1) + ' ov=' + !document.getElementById('overlay').hidden; });
  await page.keyboard.press('Enter'); await page.waitForTimeout(1000); console.log('after Enter   ', await st());
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(450); await page.keyboard.up('ArrowDown'); await page.waitForTimeout(200); console.log('held Down 450 ', await st());
  await page.keyboard.press('z'); await page.waitForTimeout(200); console.log('undo          ', await st());
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); const t1 = await st(); await page.waitForTimeout(600); console.log('paused        ', t1, '|', await st());
  await page.keyboard.press('Enter'); await page.waitForTimeout(300); console.log('resumed       ', await st());
  await page.keyboard.press('r'); await page.waitForTimeout(1000); console.log('restart       ', await st());
  // play the whole of level 1 with real keys, then Enter for next level
  const sol = require('./gen/solutions.json')[0], K = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' };
  for (const c of sol) { await page.keyboard.press(K[c]); await page.waitForTimeout(140); }
  await page.waitForTimeout(1400); console.log('solved        ', await st(), await page.evaluate(() => JSON.stringify(__stubin.Save.d.stars)));
  await page.keyboard.press('Enter'); await page.waitForTimeout(1000); console.log('next          ', await st());
  await page.click('#btnPause'); await page.waitForTimeout(200); await page.click('#card .btn:nth-of-type(1)'); await page.waitForTimeout(100);
  console.log(errs.length ? errs : 'no errors'); await browser.close();
})();

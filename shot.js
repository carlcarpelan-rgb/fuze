const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const mob = args[0] === 'm';
  const ctx = await browser.newContext({ viewport: mob ? { width: 390, height: 780 } : { width: 1280, height: 800 }, deviceScaleFactor: mob ? 2 : 1, hasTouch: mob, isMobile: mob });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + __dirname + '/dist/index.html');
  await page.waitForTimeout(700);
  const pre = mob ? 'm_' : '';
  const shot = n => page.screenshot({ path: `shots/${pre}${n}.png` });
  const tap = async (s, gap) => { for (const ch of s) { await page.evaluate(d => __stubin.Input.tap(d), 'UDLR'.indexOf(ch)); await page.waitForTimeout(gap || 160); } };
  for (const w of args.slice(1)) {
    const name = w.replace(/:/g, '_');
    if (w === 'title') { await page.evaluate(() => __stubin.showTitle()); await page.waitForTimeout(500); await shot(name); }
    else if (w === 'select') { await page.evaluate(() => __stubin.showSelect()); await page.waitForTimeout(300); await shot(name); }
    else if (w === 'all') {
      const n = await page.evaluate(() => __stubin.LEVELS.length);
      for (let i = 0; i < n; i++) { await page.evaluate(i => __stubin.startLevel(i), i); await page.waitForTimeout(70); }
      console.log('cycled', n, 'levels');
    } else if (w[0] === 'L') {
      const [i, moves, wait] = w.slice(1).split(':');
      await page.evaluate(i => __stubin.startLevel(i), +i);
      await page.waitForTimeout(1000); await tap(moves || ''); await page.waitForTimeout(+(wait || 200)); await shot(name);
    } else if (w[0] === 'W') {
      const i = +w.slice(1), sol = require('./gen/solutions.json')[i];
      await page.evaluate(i => __stubin.startLevel(i), i);
      await page.waitForTimeout(900); await tap(sol, 150); await page.waitForTimeout(250); await shot(name + '_a');
      await page.waitForTimeout(1500); await shot(name);
    } else if (w[0] === 'X') {
      const i = +w.slice(1);
      await page.evaluate(i => __stubin.startLevel(i), i);
      await page.waitForTimeout(900); await page.evaluate(() => { __stubin.G.timeLeft = 0.05; });
      await page.waitForTimeout(330); await shot(name + '_a'); await page.waitForTimeout(1500); await shot(name);
    } else if (w[0] === 'S') {
      const i = +w.slice(1);
      await page.evaluate(i => __stubin.startLevel(i), i);
      for (let k = 0; k < 4; k++) { await page.waitForTimeout(k ? 2600 : 3200); await shot(name + '_' + k); }
    } else if (w[0] === 'P') {
      // play a scrolling level's recorded solution in real time: moves right after each tick
      const i = +w.slice(1), sol = require('./gen/solutions.json')[i];
      await page.evaluate(i => __stubin.startLevel(i), i);
      const res = await page.evaluate(async (sol) => {
        const S = __stubin, G = S.G, sleep = ms => new Promise(r => setTimeout(r, ms));
        while (G.mode === 'intro') await sleep(20);
        const segs = sol.split('T');
        for (let k = 0; k < segs.length; k++) {
          for (const ch of segs[k]) { S.Input.tap('UDLR'.indexOf(ch)); await sleep(150); }
          if (k < segs.length - 1) { const cam = G.st.cam; while (G.st.cam === cam && G.mode === 'play') await sleep(10); await sleep(40); }
          if (G.mode !== 'play') break;
        }
        await sleep(300);
        return G.mode + ' cam=' + G.st.cam + ' left=' + G.timeLeft.toFixed(1);
      }, sol);
      console.log('level', i + 1, '->', res); await shot(name);
    }
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await browser.close();
})();

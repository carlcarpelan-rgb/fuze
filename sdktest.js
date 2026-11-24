// Runs the CrazyGames build against a stand-in SDK that records every call.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 800, height: 450 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/sdk\.crazygames\.com/, r => r.fulfill({ contentType: 'text/javascript', body: `
    window.__log = []; const L = (...a) => window.__log.push(a.join(' '));
    const store = {};
    window.CrazyGames = { SDK: { environment: 'local',
      init: async () => L('init'),
      game: { gameplayStart: () => L('gameplayStart'), gameplayStop: () => L('gameplayStop'), happytime: () => L('happytime'), settings: { muteAudio: false }, addSettingsChangeListener: f => { window.__setMute = f; } },
      user: { systemInfo: { device: { type: 'mobile' } } },
      data: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; L('setItem ' + k); } },
      ad: { requestAd: (t, cb) => { L('requestAd ' + t); setTimeout(() => cb.adStarted && cb.adStarted(), 50); setTimeout(() => cb.adFinished && cb.adFinished(), 400); } } } };` }));
  await page.goto('file://' + __dirname + '/dist/crazygames/index.html'); await page.waitForTimeout(1300);
  const state = () => page.evaluate(() => ({ mode: __stubin.G.mode, idx: __stubin.G.idx, touch: document.getElementById('app').classList.contains('touch') }));
  console.log('start', JSON.stringify(await state()));
  await page.screenshot({ path: 'shots/cg_start.png' });
  const sol = require('./gen/solutions.json');
  // play levels 1-4 by tapping the d-pad, pressing Next on each result
  for (let i = 0; i < 4; i++) {
    for (const c of sol[i]) { await page.evaluate(d => __stubin.Input.tap(d), 'UDLR'.indexOf(c)); await page.waitForTimeout(140); }
    await page.waitForTimeout(1500);
    if (i === 0) await page.screenshot({ path: 'shots/cg_result.png' });
    await page.click('#card .btn.primary'); await page.waitForTimeout(i === 3 ? 900 : 1100);
  }
  console.log('after 4 levels', JSON.stringify(await state()));
  await page.evaluate(() => window.__setMute({ muteAudio: true })); await page.waitForTimeout(100);
  console.log('platform mute', await page.evaluate(() => __stubin.Platform.sysMute));
  const log = await page.evaluate(() => window.__log);
  const counts = {}; log.forEach(l => counts[l] = (counts[l] || 0) + 1);
  console.log('sdk calls', JSON.stringify(counts));
  console.log('order (first 14):', log.slice(0, 14).join(' | '));
  console.log(errs.length ? errs : 'no errors'); await b.close();
})();

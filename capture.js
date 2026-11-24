// Makes the store covers and preview videos by driving the real game frame by frame.
//   node capture.js covers   -> store/cover-1920x1080.png, cover-800x1200.png, cover-800x800.png
//   node capture.js video    -> store/preview-1920x1080.mp4, preview-1080x1620.mp4
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SOL = require('./gen/solutions.json');
const SHOW = 62;   // a maze with pillars, ice and holes
const BOSS = 59;   // a boss level
const OUT = path.join(__dirname, 'store');
fs.mkdirSync(OUT, { recursive: true });

const TITLE_CSS = `
#coverTitle { position: absolute; z-index: 20; display: flex; flex-direction: column; gap: 0; pointer-events: none; }
#coverTitle h1 { margin: 0; font-family: 'Saira Stencil One', sans-serif; font-weight: 400; color: #f6edda; line-height: .86; letter-spacing: .01em;
  text-shadow: 0 .06em 0 #000, 0 0 .5em rgba(255,160,30,.35); }
#coverTitle .cwick { position: relative; height: .07em; border-radius: .04em; margin-top: .08em;
  background: linear-gradient(90deg, #2c2824 0 58%, transparent 58%), repeating-linear-gradient(115deg, #e0bb80 0 .06em, #b98f55 .06em .12em); }
#coverTitle .cwick i { position: absolute; left: 58%; top: 50%; width: .5em; height: .5em; margin: -.25em; border-radius: 50%;
  background: radial-gradient(circle, #fff 0 14%, #ffd66e 28%, rgba(255,120,20,.65) 50%, transparent 70%); }
#coverShade { position: absolute; inset: 0; z-index: 19; pointer-events: none; }
`;

async function open(b, w, h, dpr) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(__dirname, 'dist/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__capture = true; });
  return page;
}
// put the game into a level, hide the HUD, and optionally overlay the title
async function stage(page, idx, opts) {
  await page.evaluate(({ idx, opts, css }) => {
    const S = window.__stubin;
    S.Save.d.mute = true;
    window.__zoom = 0;
    S.startLevel(idx);
    document.getElementById('hint').classList.add('off');
    if (opts.noHud) document.getElementById('hud').hidden = true;
    document.getElementById('app').classList.remove('touch');
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    S.layout(true);
  }, { idx, opts, css: TITLE_CSS });
}
async function step(page, n, fps) {
  await page.evaluate(({ n, fps }) => { const S = window.__stubin; for (let i = 0; i < n; i++) S.update(1 / fps); S.render(); S.updateHud(); }, { n, fps });
}
// shift and rescale the board inside the frame
async function frameBoard(page, o) {
  await page.evaluate(o => {
    const S = window.__stubin, V = S.V, st = S.G.st;
    window.__zoom = o.zoom || 0;
    S.layout(true);
    if (o.fx != null) V.ox = Math.round(V.cw * o.fx - (st.px - st.cam + .5) * V.s);
    if (o.fy != null) V.oy = Math.round(V.ch * o.fy - (st.py + .5) * V.s);
    S.buildFrame();
  }, o);
}
async function title(page, o) {
  await page.evaluate(o => {
    let t = document.getElementById('coverTitle');
    if (!t) {
      const sh = document.createElement('div'); sh.id = 'coverShade'; document.getElementById('app').appendChild(sh);
      t = document.createElement('div'); t.id = 'coverTitle'; t.innerHTML = '<h1>FUZE</h1><div class="cwick"><i></i></div>';
      document.getElementById('app').appendChild(t);
    }
    Object.assign(t.style, o.pos, { fontSize: o.size + 'px' });
    document.getElementById('coverShade').style.background = o.shade;
  }, o);
}
// play the recorded solution until `stopBefore` moves are left, stepping frames as a player would
async function playTo(page, idx, stopBefore, fps, onFrame) {
  const sol = SOL[idx].slice(0, Math.max(0, SOL[idx].length - stopBefore));
  for (const c of sol) {
    if (c === 'T') {
      for (let k = 0; k < 120; k++) {
        const moved = await page.evaluate(() => { const S = window.__stubin; const c0 = S.G.st.cam; S.update(1 / 30); S.render(); S.updateHud(); return S.G.st.cam !== c0; });
        if (onFrame) await onFrame();
        if (moved) break;
      }
      continue;
    }
    await page.evaluate(d => window.__stubin.Input.tap(d), 'UDLR'.indexOf(c));
    for (let k = 0; k < 60; k++) {
      await step(page, 1, fps);
      if (onFrame) await onFrame();
      const idle = await page.evaluate(() => { const G = window.__stubin.G; return G.hero.t >= 1 && !window.__stubin.Input.queue.length; });
      if (idle && k >= 4) break;
    }
  }
}

async function covers(b) {
  const specs = [
    { name: 'cover-1920x1080.png', w: 1920, h: 1080, dpr: 1, board: { zoom: 1.85, fx: .62, fy: .6 }, size: 380, pos: { left: '100px', top: '300px' },
      shade: 'linear-gradient(90deg, rgba(6,8,11,.92) 0, rgba(6,8,11,.75) 28%, rgba(6,8,11,0) 52%)' },
    { name: 'cover-800x1200.png', w: 800, h: 1200, dpr: 2, board: { zoom: 1.7, fx: .5, fy: .66 }, size: 210, pos: { left: '50%', top: '70px', transform: 'translateX(-50%)' },
      shade: 'linear-gradient(180deg, rgba(6,8,11,.92) 0, rgba(6,8,11,.6) 22%, rgba(6,8,11,0) 34%)' },
    { name: 'cover-800x800.png', w: 800, h: 800, dpr: 2, board: { zoom: 1.6, fx: .5, fy: .64 }, size: 170, pos: { left: '50%', top: '34px', transform: 'translateX(-50%)' },
      shade: 'linear-gradient(180deg, rgba(6,8,11,.92) 0, rgba(6,8,11,.55) 24%, rgba(6,8,11,0) 36%)' }
  ];
  for (const sp of specs) {
    const page = await open(b, sp.w, sp.h, sp.dpr);
    await stage(page, SHOW, { noHud: true });
    await step(page, 30, 30);
    await playTo(page, SHOW, 3, 30);
    await frameBoard(page, sp.board);
    await page.evaluate(() => { window.__stubin.G.timeLeft = 3; }); // urgent, so the bombs glow hard
    await step(page, 8, 30);
    await title(page, sp);
    await page.evaluate(() => document.fonts.ready);
    const raw = path.join(OUT, 'raw-' + sp.name);
    await page.screenshot({ path: raw });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', `scale=${sp.w}:${sp.h}:flags=lanczos`, path.join(OUT, sp.name)]);
    fs.unlinkSync(raw);
    console.log('cover', sp.name);
    await page.context().close();
  }
}

async function video(b) {
  const specs = [
    { name: 'preview-1920x1080.mp4', w: 1920, h: 1080, board: { zoom: 1.85, fx: .62, fy: .6 }, size: 380, pos: { left: '100px', top: '300px' },
      shade: 'linear-gradient(90deg, rgba(6,8,11,.92) 0, rgba(6,8,11,.75) 28%, rgba(6,8,11,0) 52%)' },
    { name: 'preview-1080x1620.mp4', w: 1080, h: 1620, board: { zoom: 1.7, fx: .5, fy: .66 }, size: 280, pos: { left: '50%', top: '90px', transform: 'translateX(-50%)' },
      shade: 'linear-gradient(180deg, rgba(6,8,11,.92) 0, rgba(6,8,11,.6) 22%, rgba(6,8,11,0) 34%)' }
  ];
  const fps = 30;
  for (const sp of specs) {
    const dir = path.join(OUT, 'frames'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    let n = 0;
    const page = await open(b, sp.w, sp.h, 1);
    const shot = async () => { await page.screenshot({ path: path.join(dir, String(n++).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 }); };
    // 1. the cover as the opening frame (1 s)
    await stage(page, SHOW, { noHud: true });
    await step(page, 30, fps);
    await playTo(page, SHOW, 3, fps);
    await frameBoard(page, sp.board);
    await page.evaluate(() => { window.__stubin.G.timeLeft = 3; });
    await step(page, 8, fps);
    await title(page, sp);
    await page.evaluate(() => document.fonts.ready);
    for (let k = 0; k < fps; k++) { await step(page, 1, fps); await shot(); }
    await page.evaluate(() => { document.getElementById('coverTitle').remove(); document.getElementById('coverShade').remove(); });
    // 2. the showcase maze from the start, with the HUD (about 10 s)
    await stage(page, SHOW, {});
    for (let k = 0; k < 24; k++) { await step(page, 1, fps); await shot(); }
    await playTo(page, SHOW, 0, fps, shot);
    for (let k = 0; k < 30; k++) { await step(page, 1, fps); await shot(); }
    // 3. a boss level rolling in (until 19 s in total)
    await page.evaluate(() => { document.getElementById('overlay').hidden = true; });
    await stage(page, BOSS, {});
    for (let k = 0; k < 24; k++) { await step(page, 1, fps); await shot(); }
    const limit = fps * 19;
    await playTo(page, BOSS, 0, fps, async () => { if (n < limit) await shot(); });
    while (n < Math.min(limit, n + 20)) { await step(page, 1, fps); await shot(); if (n >= limit) break; }
    await page.context().close();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, '%04d.jpg'), '-frames:v', String(Math.min(n, limit)),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', path.join(OUT, sp.name)]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('video', sp.name, (Math.min(n, limit) / fps).toFixed(1) + ' s');
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  if (process.argv[2] === 'covers') await covers(b);
  if (process.argv[2] === 'video') await video(b);
  await b.close();
})();

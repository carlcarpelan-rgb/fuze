// Close-up cover candidates for the store: a small staged scene in the real game, zoomed right in.
//   node cover2.js            -> store/covers2/<variant>-<size>.png
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const OUT = path.join(__dirname, 'store', 'covers2');
fs.mkdirSync(OUT, { recursive: true });

const TITLE_CSS = `
#coverTitle { position: absolute; z-index: 20; display: flex; flex-direction: column; gap: 0; pointer-events: none; }
#coverTitle h1 { margin: 0; font-family: 'Saira Stencil One', sans-serif; font-weight: 400; color: #fff3dc; line-height: .86; letter-spacing: .02em;
  text-shadow: 0 .05em 0 #000, 0 .1em .2em rgba(0,0,0,.6), 0 0 .45em rgba(255,150,30,.55); -webkit-text-stroke: .012em #1a0f06; }
#coverTitle .cwick { position: relative; height: .085em; border-radius: .04em; margin-top: .09em;
  background: linear-gradient(90deg, #2c2824 0 64%, transparent 64%), repeating-linear-gradient(115deg, #e0bb80 0 .06em, #b98f55 .06em .12em); }
#coverTitle .cwick i { position: absolute; left: 64%; top: 50%; width: .4em; height: .4em; margin: -.2em; border-radius: 50%;
  background: radial-gradient(circle, #fff 0 14%, #ffd66e 28%, rgba(255,120,20,.6) 45%, transparent 68%); }
#coverShade { position: absolute; inset: 0; z-index: 19; pointer-events: none; }
`;

// staged scenes: the hero mid-push, the bomb close by and about to blow
const SCENES = {
  lava: 84,    // glowing rock: hot light all round the bomb
  cellar: 24,  // warm brick vaults
  ice: 60      // the cave look of the current cover, only closer
};
// the scene: the hero shoving a wall at the bomb, with a few more walls and a pillar to say "puzzle"
const ACROSS = { m: '........./......X../........./.S#.B..../........./.....#.../.........', push: 'R', focus: [3.5, 3.5] };
const UP =     { m: '.........#/X........./....B...../........#./....#...../....S...../.#......../.......X..', push: 'U', focus: [4.5, 4.1] };
const SIZES = [
  { name: '1920x1080', scene: ACROSS, w: 1920, h: 1080, dpr: 1, zoom: 4.1, fx: .63, fy: .6, size: 300, pos: { left: '80px', top: '70px' },
    shade: 'linear-gradient(180deg, rgba(6,8,11,.85) 0, rgba(6,8,11,.4) 30%, rgba(6,8,11,0) 46%), linear-gradient(90deg, rgba(6,8,11,.55) 0, rgba(6,8,11,0) 40%)' },
  { name: '800x1200', scene: ACROSS, w: 800, h: 1200, dpr: 2, zoom: 3.5, fx: .5, fy: .56, size: 220, pos: { left: '50%', top: '60px', transform: 'translateX(-50%)' },
    shade: 'linear-gradient(180deg, rgba(6,8,11,.9) 0, rgba(6,8,11,.55) 20%, rgba(6,8,11,0) 32%)' },
  { name: '800x800', scene: ACROSS, w: 800, h: 800, dpr: 2, zoom: 3.25, fx: .5, fy: .63, size: 175, pos: { left: '50%', top: '28px', transform: 'translateX(-50%)' },
    shade: 'linear-gradient(180deg, rgba(6,8,11,.9) 0, rgba(6,8,11,.5) 22%, rgba(6,8,11,0) 34%)' }
];

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const only = process.argv[2];
  for (const [vn, idx] of Object.entries(SCENES)) {
    if (only && only !== vn) continue;
    for (const sp of SIZES) {
      const sc = Object.assign({ idx }, sp.scene);
      const ctx = await b.newContext({ viewport: { width: sp.w, height: sp.h }, deviceScaleFactor: sp.dpr });
      const page = await ctx.newPage();
      await page.goto('file://' + path.join(__dirname, 'dist/index.html'));
      await page.waitForTimeout(400);
      await page.evaluate(({ sc, sp, css }) => {
        window.__capture = true;
        const S = window.__stubin;
        S.Save.d.mute = true;
        S.LEVELS[sc.idx] = { m: sc.m, t: 30, p: 1 };
        window.__zoom = 0;
        S.startLevel(sc.idx);
        const hint = document.getElementById('hint'); if (hint) hint.classList.add('off');
        document.getElementById('hud').hidden = true;
        document.getElementById('app').classList.remove('touch');
        const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
        for (let i = 0; i < 40; i++) S.update(1 / 30);
      }, { sc, sp, css: TITLE_CSS });
      // the push, frozen part way through
      await page.evaluate(d => window.__stubin.Input.tap(d), 'UDLR'.indexOf(sc.push));
      await page.evaluate(() => { const S = window.__stubin; for (let i = 0; i < 6; i++) S.update(1 / 60); S.G.timeLeft = 2.2; });
      await page.evaluate(({ sp, sc }) => {
        const S = window.__stubin, V = S.V;
        window.__zoom = sp.zoom; S.layout(true);
        V.ox = Math.round(V.cw * sp.fx - sc.focus[0] * V.s);
        V.oy = Math.round(V.ch * sp.fy - sc.focus[1] * V.s);
        S.buildFrame();
        for (let i = 0; i < 2; i++) S.update(1 / 60);
        S.G.particles.length = 0; // no dust cloud over the hero's face
        S.render();
        let t = document.createElement('div'); const sh = document.createElement('div'); sh.id = 'coverShade'; document.getElementById('app').appendChild(sh);
        t.id = 'coverTitle'; t.innerHTML = '<h1>FUZE</h1><div class="cwick"><i></i></div>'; document.getElementById('app').appendChild(t);
        Object.assign(t.style, sp.pos, { fontSize: sp.size + 'px' }); sh.style.background = sp.shade;
      }, { sp, sc });
      await page.evaluate(() => document.fonts.ready);
      const raw = path.join(OUT, 'raw.png'), out = path.join(OUT, vn + '-' + sp.name + '.png');
      await page.screenshot({ path: raw });
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', `scale=${sp.w}:${sp.h}:flags=lanczos`, out]);
      fs.unlinkSync(raw);
      console.log(out);
      await ctx.close();
    }
  }
  await b.close();
})();

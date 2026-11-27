// Bright, poster-style store covers in the style of the CrazyGames front page:
// a warm sunburst, a big chunky logo, the hero shoving a block at a huge sparking bomb, and an arrow that says "push".
// Drawn with the game's own character, block and bomb painters (src/art.js), only much bigger.
//   node cover3.js   -> store/covers3/poster-<size>.png
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'store', 'covers3');
fs.mkdirSync(OUT, { recursive: true });
const art = fs.readFileSync(path.join(__dirname, 'src/art.js'), 'utf8');
const font = 'file://' + path.join(__dirname, 'src/fonts/saira-stencil-one-latin-400-normal.woff2');

// where things go in each format (all in pixels of the final image)
// G is the floor line everything stands on
function lay(w, h, logo, burst, G, hero, block, arrow, bomb) {
  return { w, h, logo, burst,
    hero: [hero[0], G - .33 * hero[1], hero[1]], block: [block[0], G - .74 * block[1], block[1]],
    arrow: [arrow[0], G - .5 * block[1] - .1 * block[1], arrow[1]], bomb: [bomb[0], G - .4 * bomb[1], bomb[1]] };
}
const LAYOUTS = {
  '1920x1080': lay(1920, 1080, { x: 80, y: 60, size: 330, align: 'left' }, [1350, 620], 930, [455, 430], [790, 360], [1135, 170], [1530, 600]),
  '800x1200': lay(800, 1200, { x: 400, y: 90, size: 270, align: 'center' }, [560, 820], 1020, [122, 290], [322, 232], [500, 100], [670, 380]),
  '800x800': lay(800, 800, { x: 400, y: 34, size: 200, align: 'center' }, [560, 560], 735, [116, 272], [312, 218], [482, 94], [662, 350])
};

const page = (L) => `<!DOCTYPE html><html><head><style>
@font-face { font-family: 'Stencil'; src: url('${font}') format('woff2'); }
html,body { margin: 0; background: #000; } canvas { display: block; }
</style></head><body><canvas id="c" width="${L.w}" height="${L.h}"></canvas>
<script>${art}
const L = ${JSON.stringify(L)};
async function go() {
  await document.fonts.load('100px Stencil');
  const cv = document.getElementById('c'), c = cv.getContext('2d'), W = L.w, H = L.h;
  const rnd = mulberry32(7);
  // sunburst: hot yellow in the middle, orange, then deep red at the edges
  const [bx, by] = L.burst, R = Math.hypot(W, H);
  let g = c.createRadialGradient(bx, by, 0, bx, by, R * .75);
  g.addColorStop(0, '#fff3a8'); g.addColorStop(.18, '#ffc93c'); g.addColorStop(.45, '#ff7a1a'); g.addColorStop(.8, '#c8281e'); g.addColorStop(1, '#6e0f16');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.translate(bx, by); c.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < 22; i++) { const a0 = i / 22 * TAU, a1 = a0 + TAU / 44; c.fillStyle = i % 2 ? 'rgba(255,255,255,.45)' : 'rgba(255,240,200,.0)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a0, a1); c.closePath(); c.fill(); }
  c.restore();
  // a hint of the game's floor grid, fading out
  c.save(); c.globalAlpha = .13; c.strokeStyle = '#5a1206'; c.lineWidth = Math.max(2, W / 600);
  const gs = L.hero[2] * .9;
  for (let x = (L.block[0] % gs) - gs; x < W; x += gs) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = (L.block[1] % gs) - gs; y < H; y += gs) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.restore();
  // sparks flying from the bomb's fuse
  const [qx, qy, qs] = L.bomb;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const a = rnd() * TAU, d = qs * (.25 + rnd() * .9), x = qx + qs * .17 + Math.cos(a) * d, y = qy - qs * .42 + Math.sin(a) * d * .8, r = qs * (.004 + rnd() * .012);
    const sg = c.createRadialGradient(x, y, 0, x, y, r * 4); sg.addColorStop(0, 'rgba(255,250,210,1)'); sg.addColorStop(1, 'rgba(255,170,40,0)');
    c.fillStyle = sg; c.beginPath(); c.arc(x, y, r * 4, 0, TAU); c.fill();
  }
  c.restore();
  // the block being pushed, with speed lines behind it
  const [kx, ky, ks] = L.block, hh = ks * .24;
  const wl = { k: 'brick', top: '#e07a4e', top2: '#cf6a42', side: '#8a3a26', line: '#5a2414' };
  const spr = mkCanvas(ks, ks + hh); paintWall(spr.getContext('2d'), ks, hh, wl, mulberry32(3));
  c.save(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineCap = 'round';
  for (let i = 0; i < 4; i++) { const yy = ky + ks * (.18 + i * .2), len = ks * (.35 + (i % 2) * .2); c.lineWidth = ks * .035; c.beginPath(); c.moveTo(kx - ks * .62, yy); c.lineTo(kx - ks * .62 - len, yy); c.stroke(); }
  c.restore();
  c.save(); c.shadowColor = 'rgba(60,0,0,.55)'; c.shadowBlur = ks * .12; c.shadowOffsetY = ks * .06;
  c.drawImage(spr, kx - ks / 2, ky - ks * .5); c.restore();
  // the hero, pushing
  const [hx, hy, hs] = L.hero;
  c.save(); c.shadowColor = 'rgba(60,0,0,.45)'; c.shadowBlur = hs * .08;
  drawHero(c, hx, hy, hs, { dir: 3, walk: .3, moving: 1, push: 1, sx: 1, sy: 1, lift: 0, alpha: 1 }); c.restore();
  // the bomb: big, live and about to go
  c.save(); c.shadowColor = 'rgba(60,0,0,.5)'; c.shadowBlur = qs * .08;
  drawBomb(c, qx, qy, qs, 1.3, 1, 0); c.restore();
  // a big push arrow between the block and the bomb
  const [ax, ay, as] = L.arrow;
  c.save(); c.translate(ax, ay);
  c.beginPath(); c.moveTo(-as * .5, -as * .2); c.lineTo(as * .1, -as * .2); c.lineTo(as * .1, -as * .48); c.lineTo(as * .62, 0); c.lineTo(as * .1, as * .48); c.lineTo(as * .1, as * .2); c.lineTo(-as * .5, as * .2); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = as * .16; c.strokeStyle = '#3a0d06'; c.stroke();
  const ag = c.createLinearGradient(0, -as * .5, 0, as * .5); ag.addColorStop(0, '#ffffff'); ag.addColorStop(1, '#ffe08a');
  c.fillStyle = ag; c.fill(); c.restore();
  // the logo: chunky stencil letters, thick outline, a 3D drop, and the burning wick under it
  const lg = L.logo, fs_ = lg.size;
  c.save(); c.font = fs_ + 'px Stencil'; c.textBaseline = 'top'; c.textAlign = lg.align;
  const tw = c.measureText('FUZE').width, lx0 = lg.align === 'center' ? lg.x - tw / 2 : lg.x;
  for (let d = Math.round(fs_ * .07); d > 0; d -= 2) { c.fillStyle = '#5a1208'; c.fillText('FUZE', lg.x, lg.y + d); }
  c.lineJoin = 'round'; c.lineWidth = fs_ * .1; c.strokeStyle = '#2a0703'; c.strokeText('FUZE', lg.x, lg.y);
  const tg = c.createLinearGradient(0, lg.y, 0, lg.y + fs_ * .85); tg.addColorStop(0, '#fff6c2'); tg.addColorStop(.45, '#ffd23a'); tg.addColorStop(1, '#ff8400');
  c.fillStyle = tg; c.fillText('FUZE', lg.x, lg.y);
  // wick
  const wy = lg.y + fs_ * .98, wh = fs_ * .085, burn = .64;
  c.lineWidth = fs_ * .035; c.strokeStyle = '#2a0703';
  c.fillStyle = '#3a2a22'; rr(c, lx0, wy, tw, wh, wh / 2); c.fill(); c.stroke();
  c.save(); rr(c, lx0 + tw * burn, wy, tw * (1 - burn), wh, wh / 2); c.clip();
  c.fillStyle = '#e8c58a'; c.fillRect(lx0, wy, tw, wh);
  c.fillStyle = '#b88a4c'; for (let x = lx0 + tw * burn - wh; x < lx0 + tw; x += wh * .9) { c.beginPath(); c.moveTo(x, wy + wh); c.lineTo(x + wh * .45, wy + wh); c.lineTo(x + wh * .9, wy); c.lineTo(x + wh * .45, wy); c.fill(); }
  c.restore();
  const sx = lx0 + tw * burn, sy = wy + wh / 2, sr = fs_ * .28;
  c.globalCompositeOperation = 'lighter';
  const fl = c.createRadialGradient(sx, sy, 0, sx, sy, sr); fl.addColorStop(0, 'rgba(255,255,255,1)'); fl.addColorStop(.2, 'rgba(255,230,120,.95)'); fl.addColorStop(.5, 'rgba(255,130,20,.55)'); fl.addColorStop(1, 'rgba(255,80,0,0)');
  c.fillStyle = fl; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill();
  c.restore();
  // a soft vignette to hold it together
  const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, R * .62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,0,0,.45)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  document.title = 'done';
}
go();
</script></body></html>`;

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  for (const [name, L] of Object.entries(LAYOUTS)) {
    const html = path.join(OUT, 'tmp.html');
    fs.writeFileSync(html, page(L));
    const p = await b.newPage({ viewport: { width: L.w, height: L.h } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html);
    await p.waitForFunction(() => document.title === 'done', null, { timeout: 10000 }).catch(() => {});
    if (errs.length) console.log(errs);
    await p.locator('#c').screenshot({ path: path.join(OUT, 'poster-' + name + '.png') });
    console.log('poster-' + name + '.png');
    await p.close();
    fs.unlinkSync(html);
  }
  await b.close();
})();

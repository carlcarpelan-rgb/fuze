// Builds the Fuze Tower prototype into one self-contained file: tower/dist/index.html
// It reuses Fuze's drawing helpers, engine frame, sound, input, music and platform code, unchanged.
const fs = require('fs'), p = require('path');
const root = p.join(__dirname, '..');
const rd = f => fs.readFileSync(p.join(root, f), 'utf8');
const b64 = f => fs.readFileSync(p.join(root, f)).toString('base64');
const lines = (f, a, b) => rd(f).split('\n').slice(a - 1, b).join('\n');
const expect = (txt, start) => { if (!txt.trimStart().startsWith(start)) throw new Error('slice moved: expected ' + start + ' got ' + txt.slice(0, 60)); return txt; };

const fuzeGame = [
  expect(lines('src/game.js', 1, 25), '/* ====='),            // canvas, G, V, glow
  expect(lines('src/game.js', 95, 114), 'function spawn'),     // particles
  expect(lines('src/game.js', 273, 391), 'function layout')    // layout + frame around the board
].join('\n');
const fuzeUi = [
  expect(lines('src/ui.js', 1, 13), '/* ====='),              // $, icons, fmt
  expect(lines('src/ui.js', 29, 81), '/* ---------- sound'),  // Snd
  expect(lines('src/ui.js', 82, 142), '/* ---------- input'), // Input, keys, swipe, d-pad
  expect(lines('src/ui.js', 244, 263), 'function panel')      // dialogs
].join('\n');
const main = `
let lastT = 0, lastFuse = -1, lastTxt = '';
function frame(t) {
  requestAnimationFrame(frame);
  if (window.__capture) return;
  let dt = (t - lastT) / 1000; lastT = t;
  if (!(dt > 0)) return; if (dt > .05) dt = .05;
  if (G.mode !== 'paused') update(dt);
  render();
  Platform.gameplay((G.mode === 'play' || G.mode === 'intro') && $('overlay').hidden);
  updateHud();
}
function updateHud() {
  if ($('hud').hidden) return;
  const r = clamp(G.timeLeft / G.time, 0, 1), rr2 = Math.round(r * 500) / 500;
  if (rr2 !== lastFuse) { lastFuse = rr2; $('fuse').style.setProperty('--r', rr2); }
  const tx = fmt(G.timeLeft);
  if (tx !== lastTxt) { lastTxt = tx; $('hudTime').textContent = tx; $('fuse').classList.toggle('urgent', G.timeLeft < 8 && G.mode === 'play'); }
  $('fuse').classList.toggle('hit', G.fuseFlash > 0); $('fuse').classList.toggle('refill', G.refillT > 0);
}
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });
if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(stageEl);
window.addEventListener('resize', () => layout());
(async () => {
  await Platform.init();
  IS_TOUCH = Platform.isMobile();
  app.classList.toggle('touch', IS_TOUCH);
  Save.load();
  $('btnSound').innerHTML = Save.d.mute ? ICON.off : ICON.on;
  if (!anyDone() && !Save.d.all) startLevel(0); else showTitle();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
})();
window.__tower = { G, V, Save, startLevel, showSelect, showTitle, Input, doMove, undo, update, render, updateHud, layout, buildFrame, LEVELS, TowerRules };
`;
const levels = rd('tower/levels/levels.json');
const js = [rd('tower/src/rules.js'), "(() => {\n'use strict';\nconst LEVELS = " + levels + ";",
  rd('src/art.js'), rd('tower/src/art2.js'), fuzeGame, rd('tower/src/core.js'), rd('src/platform.js'), rd('src/music.js'),
  fuzeUi, rd('tower/src/screens.js'), main, '})();'].join('\n');
if (js.includes('</script')) throw new Error('script close in js');

const face = (family, weight, file) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64('src/fonts/' + file)}) format('woff2');}`;
const fonts = '<style>' + [face('Saira Stencil One', 400, 'saira-stencil-one-latin-400-normal.woff2'), face('Barlow Semi Condensed', 500, 'barlow-semi-condensed-latin-500-normal.woff2'),
  face('Barlow Semi Condensed', 600, 'barlow-semi-condensed-latin-600-normal.woff2'), face('Barlow Semi Condensed', 700, 'barlow-semi-condensed-latin-700-normal.woff2')].join('\n') + '</style>';

let html = rd('src/template.html');
const sub = (a, b) => { if (!html.includes(a)) throw new Error('template text missing: ' + a.slice(0, 60)); html = html.replace(a, () => b); };
html = html.replace(/<link rel="preconnect"[^>]*>\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, () => fonts);
sub('<title>Fuze</title>', '<title>Fuze Tower</title>');
sub('<div class="kick">Push walls · Beat the spark</div>', '<div class="kick">Push · Sneak · Ride up</div>');
sub('<h1>FUZE</h1>', '<h1>FUZE<br>TOWER</h1>');
sub('<p class="tag">Someone has hidden bombs in the tunnels under the city. You have a maze, a burning fuse and two hands to push with.</p>',
  '<p class="tag">Someone has wired the tower to blow. Clear a way to the lift on every floor, slip past the guards and climb before the fuse burns down.</p>');
sub('id="btnSelect">Choose level</button>', 'id="btnSelect">Choose floor</button>');
sub('<button class="btn" id="btnArcade">Arcade, 3 tries</button>', '');
sub('<h2>Levels</h2>', '<h2>Floors</h2>');
sub('<span>The more fuse you have left, the more stars you get. Clear a level in the fewest possible pushes to earn its medal.</span>', '<span></span>');
sub('<input type="checkbox" id="chkAll"> Unlock all levels', '<input type="checkbox" id="chkAll"> Unlock all floors');
html = html.replace(/id="titleFoot">[^<]*</, 'id="titleFoot">R restart · Z undo · P pause · M sound<');
sub('</style>', `
.how { display: none; }
h1 { font-size: clamp(56px, 10vw, 120px); }
.lv { aspect-ratio: auto !important; height: 96px; min-height: 0; padding: 10px 6px; }
.lv .fname { font-size: 13px; font-weight: 600; color: var(--muted); text-align: center; line-height: 1.1; }
.lv.next .fname { color: #3a2400; }
.lgrid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
@media (min-width: 760px) { .lgrid { grid-template-columns: repeat(8, minmax(0, 1fr)) !important; } .lv { height: 110px; } }
.lv.boss { box-shadow: inset 0 0 0 2px #ff5340; }
.lv.boss .n::after { content: ' •'; color: #ff5340; }
.fuse.hit .rope { box-shadow: 0 0 0 2px #ff5340, 0 0 16px #ff5340; }
.fuse.hit b { color: #ff5340; }
.fuse.refill .rope { box-shadow: 0 0 0 2px #ffd166, 0 0 18px #ffb224; }
</style>`);
html = html.replace('/*__SCRIPT__*/', () => js);
fs.mkdirSync(p.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(p.join(__dirname, 'dist/index.html'), html);
console.log('built tower/dist/index.html', (fs.statSync(p.join(__dirname, 'dist/index.html')).size / 1024).toFixed(0) + ' kB');

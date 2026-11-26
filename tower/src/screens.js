/* ===== Fuze Tower: saving, extra sounds, screens ===== */
function showHint() { /* Tower shows no in-game text */ }
const Save = {
  d: { done: {}, best: {}, all: false, mute: false, music: true },
  load() { try { const s = Platform.getItem('fuzetower.v1'); if (s) Object.assign(this.d, JSON.parse(s)); } catch (e) { /* start fresh */ } },
  put() { Platform.setItem('fuzetower.v1', JSON.stringify(this.d)); }
};
const isOpen = i => Save.d.all || i === 0 || !!Save.d.done[i - 1] || !!Save.d.done[i];
function nextIdx() { for (let i = 0; i < LEVELS.length; i++) if (!Save.d.done[i]) return i; return 0; }
const anyDone = () => Object.keys(Save.d.done).length > 0;

Object.assign(Snd, {
  crunch() { this.noise(.18, .35, 6000, 1800, 'highpass'); this.noise(.12, .25, 1200, 400); },
  glass() { this.noise(.22, .45, 7000, 2500, 'highpass'); this.tone(1900, .08, 'triangle', .06, 1200); this.tone(180, .12, 'square', .1, 90); },
  takedown() { this.noise(.12, .5, 700, 120); this.tone(110, .18, 'sine', .45, 50); this.tone(880, .06, 'triangle', .06, 1300, .12); },
  refill() { [523, 784, 1047].forEach((f, i) => this.tone(f, .14, 'triangle', .16, f * 1.5, i * .06)); this.noise(.3, .1, 6000, 2500, 'highpass'); },
  roll() { this.noise(.22, .3, 500, 140); this.tone(70, .2, 'sine', .25, 55); },
  ding() { this.tone(1319, .5, 'sine', .16, 1319); this.tone(1047, .7, 'sine', .14, 1047, .16); },
  alarm() { for (let i = 0; i < 4; i++) { this.tone(880, .18, 'square', .12, 660, i * .25); this.tone(660, .07, 'square', .08, 880, i * .25 + .18); } }
});

function setHud() {
  $('hudWorld').textContent = G.theme.name;
  $('hudLevel').textContent = (LEVELS[G.idx].boss ? 'Bomb · ' : '') + 'Floor ' + (G.idx + 1);
  $('hudPush').hidden = true; $('hudArc').hidden = true; $('btnUndo').hidden = false;
  app.style.setProperty('--acc', G.theme.accent);
}
function hideScreens() { $('title').hidden = true; $('select').hidden = true; $('overlay').hidden = true; }
function startLevel(i) {
  Snd.init();
  hideScreens();
  $('hud').hidden = false; app.classList.add('playing');
  Input.clear();
  loadLevel(i);
  G.mode = 'intro';
  Platform.levelsThisSession++;
  Music.set({ world: [8, 2, 1, 9][G.L.theme] || 8, boss: !!LEVELS[i].boss });
  setHud();
  requestAnimationFrame(() => layout(true));
}
function restart() { if (G.mode === 'title') return; startLevel(G.idx); }
function showTitle() {
  hideScreens(); $('title').hidden = false; $('hud').hidden = true; app.classList.remove('playing');
  const n = nextIdx();
  loadLevel(n); G.mode = 'title';
  Music.set({ world: 8, menu: true });
  app.style.setProperty('--acc', G.theme.accent);
  $('btnPlay').textContent = anyDone() ? 'Continue on floor ' + (n + 1) : 'Play';
  requestAnimationFrame(() => layout(true));
}
function showSelect() {
  hideScreens(); $('select').hidden = false; $('hud').hidden = true; app.classList.remove('playing');
  if (G.mode !== 'title') G.mode = 'title';
  Music.set({ world: 8, menu: true });
  const nx = nextIdx();
  // one section per part of the tower, eight floors each
  let html = '';
  for (let a = 0; a < LEVELS.length; a += 8) {
    const th = TTHEMES[LEVELS[a].theme | 0];
    let cells = '', done = 0;
    for (let i = a; i < Math.min(a + 8, LEVELS.length); i++) {
      const lv = LEVELS[i], open = isOpen(i), dn = !!Save.d.done[i];
      if (dn) done++;
      const cls = 'lv' + (open ? '' : ' locked') + (dn ? ' done' : '') + (open && i === nx ? ' next' : '') + (lv.boss ? ' boss' : '');
      cells += '<button class="' + cls + '" data-i="' + i + '"' + (open ? '' : ' disabled') + ' aria-label="Floor ' + (i + 1) + (lv.boss ? ', bomb' : '') + (open ? '' : ', locked') + '">' +
        '<span class="n">' + (i + 1) + '</span>' + (open ? '<span class="fname">' + lv.name + '</span>' : ICON.lock) + '</button>';
    }
    html += '<section class="world" style="--acc:' + th.accent + '"><header><small>Floors ' + (a + 1) + ' to ' + Math.min(a + 8, LEVELS.length) + '</small><h3>' + th.name + '</h3><em>' + th.sub + '</em><b>' + done + ' / ' + Math.min(8, LEVELS.length - a) + '</b></header><div class="lgrid">' + cells + '</div></section>';
  }
  $('worlds').innerHTML = html;
  $('selTotal').textContent = '';
  $('chkAll').checked = !!Save.d.all;
}
$('worlds').addEventListener('click', e => { const b = e.target.closest('.lv'); if (!b || b.disabled) return; Snd.init(); Snd.click(); startLevel(+b.dataset.i); });
$('chkAll').addEventListener('change', e => { Save.d.all = e.target.checked; Save.put(); showSelect(); });
$('btnBack').addEventListener('click', () => { Snd.click(); showTitle(); });
$('btnPlay').addEventListener('click', () => { Snd.init(); Snd.click(); startLevel(nextIdx()); });
$('btnSelect').addEventListener('click', () => { Snd.init(); Snd.click(); showSelect(); });
$('btnPause').addEventListener('click', () => { Snd.click(); pause(); });
$('btnUndo').addEventListener('click', () => { undo(); });
$('btnRestart').addEventListener('click', () => { Snd.click(); restart(); });
$('btnSound').addEventListener('click', () => { Snd.init(); Snd.setMute(!Save.d.mute); Snd.click(); });

function pause() {
  if (G.mode !== 'play' && G.mode !== 'intro') return;
  G.resume = G.mode; G.mode = 'paused';
  panel({ kick: G.theme.name + ' · floor ' + (G.idx + 1), title: 'Paused', body: 'The fuse stops burning while you are paused.',
    btns: [{ label: 'Resume', primary: true, go: () => { $('overlay').hidden = true; G.mode = G.resume; } },
      { label: 'Music: ' + (Save.d.music !== false ? 'on' : 'off'), go: () => { Save.d.music = Save.d.music === false; Save.put(); Music.kick(); G.mode = G.resume; pause(); } },
      { label: 'Restart', retry: true, go: () => startLevel(G.idx) }, { label: 'Floors', go: showSelect }] });
}
function onWin() {
  const i = G.idx;
  Save.d.done[i] = 1;
  if (!(Save.d.best[i] >= G.timeLeft)) Save.d.best[i] = +G.timeLeft.toFixed(1);
  Save.put();
}
function showResult() {
  const i = G.idx, last = i === LEVELS.length - 1, kick = G.theme.name + ' · floor ' + (i + 1);
  if (G.mode === 'won') {
    if (last) return panel({ kick: 'All ' + LEVELS.length + ' floors cleared', title: 'So far, so good', cls: 'good', body: 'That is every floor in this build. The rest of the tower is on its way.',
      btns: [{ label: 'Floors', primary: true, go: showSelect }, { label: 'Play again', retry: true, go: () => startLevel(i) }] });
    return panel({ kick, title: G.goalHit === 'bomb' ? 'Defused' : 'Going up', cls: 'good', body: '<b>' + fmt(G.timeLeft) + ' s</b> left on the fuse.',
      btns: [{ label: 'Next floor', primary: true, go: () => Platform.breakThen(() => startLevel(i + 1)) }, { label: 'Play again', retry: true, go: () => startLevel(i) }, { label: 'Floors', go: showSelect }] });
  }
  const msg = { caught: ['Spotted', 'A guard saw you.'], laser: ['Alarm', 'You walked into a laser.'], boom: ['Boom', 'The fuse burned down before you got there.'] }[G.loseKind] || ['Boom', ''];
  panel({ kick, title: msg[0], cls: 'bad', body: msg[1],
    btns: [{ label: 'Try again', primary: true, retry: true, go: () => Platform.breakThen(() => startLevel(i)) }]
      .concat(G.loseKind === 'boom' ? [] : [{ label: 'Undo last step', go: () => { $('overlay').hidden = true; G.mode = 'play'; G.alarm = 0; G.hero.alpha = 1; undo(); G.gv.forEach(v => { v.alert = 0; }); } }])
      .concat([{ label: 'Floors', go: showSelect }]) });
}

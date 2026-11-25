/* ===== Saving, sound, input, menus, main loop ===== */
const $ = id => document.getElementById(id);
const app = $('app');
let IS_TOUCH = false;
const ICON = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.3l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg>',
  lock: '<svg class="lock" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 20 11.500V20a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 20v-8.500A1.500 1.500 0 0 1 5.500 10zm2.500 0h5V7a2.500 2.500 0 0 0-5 0z"/></svg>',
  medal: '<svg class="md" viewBox="0 0 24 24"><path d="M7 2h4l2 6h-4zM13 2h4l-2 6h-4z" fill="#3f7fb8"/><circle cx="12" cy="15" r="7" fill="currentColor"/><circle cx="12" cy="15" r="4.6" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1.4"/><path d="M10 15.2l1.4 1.4 2.8-3" fill="none" stroke="#0b2233" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  scroll: '<svg class="sc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l6 6-6 6M13 6l6 6-6 6"/></svg>',
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z" fill="currentColor"/><path d="M15.500 9a4.200 4.200 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z" fill="currentColor"/><path d="M16 9.500l5 5M21 9.500l-5 5"/></svg>'
};
const fmt = t => (Math.max(0, t)).toFixed(1);

/* ---------- save (this browser only) ---------- */
const Save = {
  d: { stars: {}, medal: {}, all: false, mute: false, music: true, hi: 0 },
  load() { try { const s = Platform.getItem('stubin.v1'); if (s) Object.assign(this.d, JSON.parse(s)); } catch (e) { /* corrupt or missing save: start fresh */ } if (!this.d.medal) this.d.medal = {}; },
  put() { Platform.setItem('stubin.v1', JSON.stringify(this.d)); }
};
const starsOf = i => Save.d.stars[i] | 0;
const isOpen = i => Save.d.all || i === 0 || starsOf(i - 1) > 0 || starsOf(i) > 0;
function nextIdx() { for (let i = 0; i < LEVELS.length; i++) if (!starsOf(i)) return i; return 0; }
const hasMedal = i => !!Save.d.medal[i];
function totalMedals() { let n = 0; for (let i = 0; i < LEVELS.length; i++) if (hasMedal(i)) n++; return n; }
const parCount = () => LEVELS.filter(l => l.p).length;
function totalStars() { let n = 0; for (let i = 0; i < LEVELS.length; i++) n += starsOf(i); return n; }

/* ---------- sound: everything is synthesised ---------- */
const Snd = {
  ac: null, out: null, nz: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ac = new AC(); this.out = this.ac.createGain(); this.out.gain.value = 0; this.out.connect(this.ac.destination); this.applyGain();
      const n = this.ac.sampleRate, buf = this.ac.createBuffer(1, n, n), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.nz = buf;
      Music.kick();
    } catch (e) { this.ac = null; }
  },
  silent() { return Save.d.mute || Platform.sysMute || Platform.adBusy; },
  applyGain() { if (this.out) try { this.out.gain.setTargetAtTime(this.silent() ? 0 : .55, this.ac.currentTime, .03); } catch (e) { /* ignore */ } },
  setMute(m) { Save.d.mute = m; Save.put(); this.applyGain(); $('btnSound').innerHTML = m ? ICON.off : ICON.on; },
  tone(f, dur, type, vol, to, when) {
    const ac = this.ac; if (!ac || this.silent()) return;
    try {
      const t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + .03);
    } catch (e) { /* ignore */ }
  },
  noise(dur, vol, f0, f1, type, when) {
    const ac = this.ac; if (!ac || !this.nz || this.silent()) return;
    try {
      const t = ac.currentTime + (when || 0), s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = this.nz; s.loop = true; fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t, Math.random() * .5); s.stop(t + dur + .03);
    } catch (e) { /* ignore */ }
  },
  step() { this.noise(.05, .1, 2400, 900, 'bandpass'); },
  push() { this.noise(.2, .4, 700, 110); this.tone(95, .14, 'sine', .3, 55); },
  bump() { this.tone(120, .08, 'square', .1, 70); this.noise(.05, .12, 400, 150); },
  land() { this.noise(.12, .25, 500, 120); this.tone(160, .1, 'sine', .2, 70); },
  beep(hi) { this.tone(hi ? 1480 : 990, .07, 'square', .1); },
  tick() { this.tone(64, .07, 'sine', .22, 44); this.noise(.06, .06, 300, 120); },
  undo() { this.tone(520, .07, 'triangle', .12, 330); },
  click() { this.tone(700, .04, 'triangle', .12, 900); },
  star(i) { this.tone([784, 988, 1319][i] || 784, .22, 'triangle', .2, null, .12 + i * .18); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .16, 'triangle', .22, null, i * .085)); this.noise(.25, .12, 6000, 2000, 'highpass'); },
  boom() { this.noise(1.3, .95, 1800, 50); this.tone(130, 1.0, 'sine', .7, 28); this.noise(.12, .6, 5000, 800, 'highpass'); },
  clank() { this.tone(330, .06, 'square', .08, 250); this.tone(1250, .05, 'triangle', .05); },
  slide(n) { this.noise(.08 + n * .07, .22, 5200, 1400, 'bandpass'); this.tone(1800, .05 + n * .05, 'sine', .04, 900); },
  thud() { this.noise(.22, .45, 420, 60); this.tone(70, .2, 'sine', .35, 38); },
  medal() { [880, 1175, 1568].forEach((f, i) => this.tone(f, .2, 'triangle', .16, null, .75 + i * .09)); },
  squash() { this.noise(.3, .6, 900, 80); this.tone(220, .25, 'sawtooth', .22, 50); }
};

/* ---------- input ---------- */
const Input = {
  held: [], queue: [], t0: 0,
  press(d) { showHint(''); if (!this.held.includes(d)) this.held.push(d); this.t0 = performance.now(); this.queue.push(d); if (this.queue.length > 2) this.queue.shift(); },
  release(d) { const i = this.held.indexOf(d); if (i >= 0) this.held.splice(i, 1); },
  tap(d) { showHint(''); this.queue.push(d); if (this.queue.length > 2) this.queue.shift(); },
  clear() { this.held.length = 0; this.queue.length = 0; }
};
// keys are read by physical position, so WASD also works as ZQSD on AZERTY keyboards
const KEYDIR = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3, KeyW: 0, KeyS: 1, KeyA: 2, KeyD: 3 };

window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  Snd.init();
  const k = e.code;
  const overlayOpen = !$('overlay').hidden;
  if (k in KEYDIR && !overlayOpen && (G.mode === 'play' || G.mode === 'intro')) { e.preventDefault(); if (!e.repeat) Input.press(KEYDIR[k]); return; }
  if (k in KEYDIR || k === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (overlayOpen) {
    if (Platform.adBusy) return;
    if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') { e.preventDefault(); const b = document.querySelector('#card .btn.primary'); if (b) b.click(); }
    else if (k === 'KeyR') { const b = document.querySelector('#card [data-retry]'); if (b) b.click(); }
    return;
  }
  if (G.mode === 'play' || G.mode === 'intro') {
    if (k === 'KeyR') restart();
    else if (k === 'KeyZ' || k === 'KeyU' || k === 'Backspace') { e.preventDefault(); undo(); }
    else if (k === 'KeyP') pause();
    else if (k === 'KeyM') Snd.setMute(!Save.d.mute);
    return;
  }
  if (!$('title').hidden && (k === 'Enter' || k === 'Space')) { e.preventDefault(); $('btnPlay').click(); }
});
window.addEventListener('keyup', e => { if (e.code in KEYDIR) Input.release(KEYDIR[e.code]); });
// iOS only lets audio start inside a touchend or click handler
document.addEventListener('touchend', () => Snd.init(), { passive: true });
document.addEventListener('click', () => Snd.init());
window.addEventListener('blur', () => { Input.clear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { Input.clear(); pause(); } });

// swipe on the board
let sw = null;
stageEl.addEventListener('pointerdown', e => { Snd.init(); if (e.pointerType === 'mouse' || e.target.closest('#pad')) return; sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
stageEl.addEventListener('pointermove', e => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y, th = 26;
  if (Math.abs(dx) < th && Math.abs(dy) < th) return;
  Input.tap(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 0 : 1));
  sw.x = e.clientX; sw.y = e.clientY;
});
const swEnd = e => { if (sw && e.pointerId === sw.id) sw = null; };
stageEl.addEventListener('pointerup', swEnd); stageEl.addEventListener('pointercancel', swEnd);
document.querySelectorAll('#pad button').forEach(b => {
  const d = +b.dataset.d;
  const up = () => { b.classList.remove('dn'); Input.release(d); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); Snd.init(); b.classList.add('dn'); Input.press(d); try { b.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } });
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});

/* ---------- screens ---------- */
function onPush() {
  $('hudPushN').textContent = G.pushes;
  const par = G.L.par;
  $('hudPush').classList.toggle('over', !!par && G.pushes > par);
}
function setHud() {
  const wi = Math.floor(G.idx / 12);
  $('hudWorld').textContent = THEMES[wi].name + (G.st.scroll && G.st.cam > 0 ? ' · ' + G.st.cam + ' to go' : '');
  $('hudLevel').textContent = 'Level ' + (G.idx + 1);
  app.style.setProperty('--acc', G.theme.accent);
  $('btnUndo').hidden = G.st.scroll;
  $('hudPush').hidden = G.st.scroll;
  $('hudPar').textContent = G.L.par ? 'best ' + G.L.par : '';
  onPush();
  $('btnRestart').hidden = !!G.arcade;
  $('hudArc').hidden = !G.arcade;
  if (G.arcade) {
    $('hudScore').textContent = G.arcade.score;
    $('hudMiss').querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < G.arcade.misses));
  }
}
function onTick() { $('hudWorld').textContent = G.theme.name + (G.st.cam > 0 ? ' · ' + G.st.cam + ' to go' : ' · arrived'); }
let hintTimer = 0;
function showHint(text, ms) {
  const el = $('hint');
  clearTimeout(hintTimer);
  if (!text) { el.classList.add('off'); return; }
  el.textContent = text; el.classList.remove('off');
  hintTimer = setTimeout(() => el.classList.add('off'), ms || 5000);
}
let firstMulti = -1, firstScroll = -1, firstX = -1, firstO = -1, firstI = -1;
function hintFor() {
  // no in-game text: every mechanic explains itself the first time you bump into it
  return '';
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
  Music.set({ world: Math.floor(i / 12), boss: !!LEVELS[i].s });
  setHud();
  showHint(hintFor(i));
  requestAnimationFrame(() => layout(true));
}
function restart() { if (G.mode === 'title' || G.arcade) return; const keepHint = !$('hint').classList.contains('off'); startLevel(G.idx); if (!keepHint) showHint(''); }
function showTitle() {
  hideScreens(); $('title').hidden = false; $('hud').hidden = true; app.classList.remove('playing'); showHint('');
  G.arcade = null;
  const n = nextIdx();
  loadLevel(n); G.mode = 'title';
  Music.set({ world: Math.floor(n / 12), menu: true });
  app.style.setProperty('--acc', G.theme.accent);
  const any = totalStars() > 0;
  $('btnPlay').textContent = any ? 'Continue at level ' + (n + 1) : 'Play';
  $('titleFoot').textContent = LEVELS.length + ' levels in 10 worlds · R restart · Z undo · P pause · M sound' + (Save.d.hi ? ' · Arcade best ' + Save.d.hi : '');
  requestAnimationFrame(() => layout(true));
}
function showSelect() {
  hideScreens(); $('select').hidden = false; $('hud').hidden = true; app.classList.remove('playing'); showHint('');
  if (G.mode !== 'title') { G.arcade = null; G.mode = 'title'; }
  Music.set({ world: Math.floor(nextIdx() / 12), menu: true });
  const nx = nextIdx();
  let html = '';
  for (let w = 0; w < LEVELS.length / 12; w++) {
    const th = THEMES[w]; let got = 0, cells = '';
    for (let k = 0; k < 12; k++) {
      const i = w * 12 + k, st = starsOf(i), open = isOpen(i); got += st;
      const cls = 'lv' + (open ? '' : ' locked') + (st ? ' done' : '') + (open && i === nx ? ' next' : '');
      let stars = ''; for (let q = 0; q < 3; q++) stars += ICON.star.replace('<svg', '<svg' + (q < st ? ' class="on"' : ''));
      cells += '<button class="' + cls + '" data-i="' + i + '"' + (open ? '' : ' disabled') + ' aria-label="Level ' + (i + 1) + (LEVELS[i].s ? ', boss level' : '') + (open ? '' : ', locked') + '">' +
        (LEVELS[i].s ? ICON.scroll : '') + (hasMedal(i) ? ICON.medal : '') + '<span class="n">' + (i + 1) + '</span>' + (open ? '<span class="st">' + stars + '</span>' : ICON.lock) + '</button>';
    }
    html += '<section class="world" style="--acc:' + th.accent + '"><header><small>World ' + (w + 1) + '</small><h3>' + th.name + '</h3><em>' + th.sub + '</em><b>' + got + ' / 36</b></header><div class="lgrid">' + cells + '</div></section>';
  }
  $('worlds').innerHTML = html;
  $('selTotal').innerHTML = ICON.star + totalStars() + ' / ' + LEVELS.length * 3 + '<span class="sep"></span>' + ICON.medal + totalMedals() + ' / ' + parCount();
  $('chkAll').checked = !!Save.d.all;
  const cur = $('worlds').querySelector('.lv.next');
  if (cur) cur.scrollIntoView({ block: 'center' });
}
$('worlds').addEventListener('click', e => {
  const b = e.target.closest('.lv'); if (!b || b.disabled) return;
  Snd.init(); Snd.click(); G.arcade = null; startLevel(+b.dataset.i);
});
$('chkAll').addEventListener('change', e => { Save.d.all = e.target.checked; Save.put(); showSelect(); });
$('btnBack').addEventListener('click', () => { Snd.click(); showTitle(); });
$('btnPlay').addEventListener('click', () => { Snd.init(); Snd.click(); G.arcade = null; startLevel(nextIdx()); });
$('btnSelect').addEventListener('click', () => { Snd.init(); Snd.click(); showSelect(); });
$('btnArcade').addEventListener('click', () => { Snd.init(); Snd.click(); G.arcade = { score: 0, misses: 0 }; startLevel(0); });
$('btnPause').addEventListener('click', () => { Snd.click(); pause(); });
$('btnUndo').addEventListener('click', () => { undo(); });
$('btnRestart').addEventListener('click', () => { Snd.click(); restart(); });
$('btnSound').addEventListener('click', () => { Snd.init(); Snd.setMute(!Save.d.mute); Snd.click(); });

function panel(o) {
  let h = '';
  if (o.kick) h += '<div class="kick">' + o.kick + '</div>';
  h += '<h2 class="' + (o.cls || '') + '">' + o.title + '</h2>';
  if (o.stars != null) { h += '<div class="stars">'; for (let q = 0; q < 3; q++) h += ICON.star.replace('<svg', '<svg' + (q < o.stars ? ' class="on"' : '')); h += '</div>'; }
  if (o.body) h += '<p>' + o.body + '</p>';
  if (o.push) h += o.push;
  h += '<div class="cbtns">';
  o.btns.forEach((b, i) => {
    if (i === 1 && o.btns.length > 2) h += '<div class="row">';
    h += '<button class="btn' + (b.primary ? ' primary' : '') + '" data-k="' + i + '"' + (b.esc ? ' data-esc' : '') + (b.retry ? ' data-retry' : '') + '>' + b.label + '</button>';
    if (i === o.btns.length - 1 && o.btns.length > 2) h += '</div>';
  });
  h += '</div>';
  const card = $('card'); card.innerHTML = h;
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  card.onclick = e => { const b = e.target.closest('.btn'); if (!b || Platform.adBusy) return; Snd.init(); Snd.click(); o.btns[+b.dataset.k].go(); };
  $('overlay').hidden = false;
  Input.clear();
}
function pause() {
  if (G.mode !== 'play' && G.mode !== 'intro') return;
  G.resume = G.mode; G.mode = 'paused';
  panel({ kick: THEMES[Math.floor(G.idx / 12)].name + ' · level ' + (G.idx + 1), title: 'Paused', body: 'The fuse stops burning while you are paused.',
    btns: [{ label: 'Resume', primary: true, esc: true, go: () => { $('overlay').hidden = true; G.mode = G.resume; } },
      { label: 'Music: ' + (Save.d.music !== false ? 'on' : 'off'), go: () => { Save.d.music = Save.d.music === false; Save.put(); Music.kick(); G.mode = G.resume; pause(); } },
      G.arcade ? { label: 'End run', go: () => arcadeOver(false) } : { label: 'Restart', retry: true, go: () => startLevel(G.idx) }].concat(G.arcade ? [] : [{ label: 'Levels', go: showSelect }]) });
}
function onWin() {
  G.medal = !!G.L.par && G.pushes <= G.L.par;
  G.newMedal = G.medal && !hasMedal(G.idx);
  if (G.arcade) { G.arcade.gain = Math.round(G.timeLeft * 10) + 50 + (G.medal ? 100 : 0); G.arcade.score += G.arcade.gain; setHud(); }
  else {
    if (G.stars > starsOf(G.idx)) Save.d.stars[G.idx] = G.stars;
    if (G.medal) Save.d.medal[G.idx] = 1;
    Save.put();
  }
}
function onLose() { if (G.arcade) { G.arcade.misses++; setHud(); } }
function pushLine() {
  if (!G.L.par) return '';
  if (G.medal) return '<div class="pushres good">' + ICON.medal + '<span><b>' + G.pushes + ' pushes</b>, the fewest possible.' + (G.newMedal ? ' New medal!' : '') + '</span></div>';
  return '<div class="pushres">' + ICON.medal + '<span><b>' + G.pushes + ' pushes</b>. It can be done in ' + G.L.par + '. Play again for the medal.</span></div>';
}
function showResult() {
  const i = G.idx, last = i === LEVELS.length - 1, kick = THEMES[Math.floor(i / 12)].name + ' · level ' + (i + 1);
  showHint('');
  if (G.mode === 'won') {
    for (let q = 0; q < G.stars; q++) Snd.star(q);
    if (G.medal) Snd.medal();
    if ((i + 1) % 12 === 0 || LEVELS[i].s) Platform.happy();
    if (G.arcade) {
      if (last) return arcadeOver(true);
      return panel({ kick, title: 'Defused', cls: 'good', stars: G.stars, push: pushLine(), body: '<b>+' + G.arcade.gain + '</b> points' + (G.medal ? ', including 100 for the fewest pushes' : '') + '. Total <b>' + G.arcade.score + '</b>.',
        btns: [{ label: 'Next level', primary: true, go: () => Platform.breakThen(() => startLevel(i + 1)) }, { label: 'End run', esc: true, go: () => arcadeOver(false) }] });
    }
    if (last) return panel({ kick: 'All ' + LEVELS.length + ' levels cleared', title: 'The city is safe', cls: 'good', stars: G.stars, body: 'You have ' + totalStars() + ' of ' + LEVELS.length * 3 + ' stars. Replay any level to improve it.',
      btns: [{ label: 'Levels', primary: true, esc: true, go: showSelect }, { label: 'Play again', retry: true, go: () => Platform.breakThen(() => startLevel(i)) }] });
    const newWorld = (i + 1) % 12 === 0;
    return panel({ kick, title: 'Defused', cls: 'good', stars: G.stars, push: pushLine(), body: '<b>' + fmt(G.timeLeft) + ' s</b> left on the fuse.' + (newWorld ? ' Next world: ' + THEMES[(i + 1) / 12].name + '.' : ''),
      btns: [{ label: 'Next level', primary: true, go: () => Platform.breakThen(() => startLevel(i + 1)) }, { label: 'Play again', retry: true, go: () => Platform.breakThen(() => startLevel(i)) }, { label: 'Levels', esc: true, go: showSelect }] });
  }
  const sq = G.loseKind === 'squash';
  if (G.arcade && G.arcade.misses >= 3) return arcadeOver(false);
  panel({ kick, title: sq ? 'Crushed' : 'Boom', cls: 'bad', body: (sq ? 'The walls pushed you into the right edge.' : 'The fuse burned down before you got there.') + (G.arcade ? ' Miss ' + G.arcade.misses + ' of 3.' : ''),
    btns: [{ label: 'Try again', primary: true, retry: true, go: () => Platform.breakThen(() => startLevel(i)) }, G.arcade ? { label: 'End run', esc: true, go: () => arcadeOver(false) } : { label: 'Levels', esc: true, go: showSelect }] });
}
function arcadeOver(all) {
  const sc = G.arcade.score, best = sc > (Save.d.hi | 0);
  if (best) { Save.d.hi = sc; Save.put(); }
  panel({ kick: 'Arcade', title: all ? 'All levels cleared' : 'Out of tries', cls: all ? 'good' : 'bad', body: 'You reached level <b>' + (G.idx + 1) + '</b> with <b>' + sc + '</b> points.' + (best && sc ? ' New high score.' : Save.d.hi ? ' Your best is ' + Save.d.hi + '.' : ''),
    btns: [{ label: 'New run', primary: true, go: () => { G.arcade = { score: 0, misses: 0 }; startLevel(0); } }, { label: 'Main menu', esc: true, go: showTitle }] });
}

document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });

/* ---------- main loop ---------- */
let lastT = 0, lastFuse = -1, lastTxt = '';
function frame(t) {
  requestAnimationFrame(frame);
  if (window.__capture) return; // frames are stepped by hand when recording the trailer
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
  if (tx !== lastTxt) { lastTxt = tx; $('hudTime').textContent = tx; $('fuse').classList.toggle('urgent', G.timeLeft < 10 && G.mode === 'play'); }
}
if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(stageEl);
window.addEventListener('resize', () => layout());
(async () => {
  await Platform.init();
  IS_TOUCH = Platform.isMobile();
  app.classList.toggle('touch', IS_TOUCH);
  Save.load();
  $('btnSound').innerHTML = Save.d.mute ? ICON.off : ICON.on;
  // a new player lands straight in level 1; returning players see the menu
  if (totalStars() === 0 && !Save.d.all) startLevel(0); else showTitle();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
})();
window.__stubin = { G, V, Save, startLevel, showSelect, showTitle, Rules, Input, doMove, update, render, updateHud, layout, buildFrame, LEVELS, Platform, Music };

/* ===== Game state, simulation and rendering ===== */
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const stageEl = document.getElementById('stage');
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const MOVE_D = 0.115, PUSH_D = 0.14;

const G = { mode: 'title', idx: 0, arcade: null, clock: 0, particles: [], motes: [] };
const V = { cw: 0, ch: 0, dpr: 1, s: 48, ft: 20, hh: 12, ox: 0, oy: 0, C: 9, R: 7, spritesKey: '', frameKey: '' };
const glowCache = new Map();

function glow(col) {
  let g = glowCache.get(col);
  if (!g) {
    g = mkCanvas(64, 64); const c = g.getContext('2d');
    const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + col + ',1)'); gr.addColorStop(.3, 'rgba(' + col + ',.55)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    glowCache.set(col, g);
  }
  return g;
}

/* ---------- level loading ---------- */
function loadLevel(idx) {
  const lv = LEVELS[idx];
  G.idx = idx;
  G.L = Rules.parseLevel(lv);
  G.st = Rules.makeState(G.L);
  G.themeIdx = Math.floor(idx / 12) % THEMES.length;
  G.theme = THEMES[G.themeIdx];
  G.time = lv.t; G.timeLeft = lv.t;
  G.f = 0; G.tickDur = (lv.s || 0) / 1000; G.scrollDone = false;
  G.wv = G.st.walls.map((w, i) => ({ v: (i * 7 + idx * 3 + ((w.x * 5 + w.y * 3) % 4)) % 6, ox: 0, oy: 0, t: 1, d: .1, shake: 0, fall: 0, landed: false }));
  G.pushes = 0;
  G.hero = { dir: 1, walk: 0, moving: 0, push: 0, ox: 0, oy: 0, t: 1, d: MOVE_D, bx: 0, by: 0, bt: 1, sx: 1, sy: 1, lift: 0, alpha: 1 };
  G.bombState = G.st.bombs.map(() => 0);
  G.history = []; G.particles.length = 0;
  G.shake = 0; G.flash = 0; G.introT = 0; G.endT = 0; G.panelShown = false;
  G.fog = 1; G.blockCool = 0; G.blockDir = -1; G.moves = 0; G.lastBeep = 99; G.loseKind = '';
  G.motes = [];
  const rnd = mulberry32(idx * 31 + 7);
  for (let i = 0; i < 34; i++) G.motes.push({ x: rnd() * G.st.vw, y: rnd() * G.st.h, ph: rnd() * TAU, sp: .5 + rnd(), sz: .5 + rnd() });
  layout(true);
}

function snapshot() {
  const st = G.st, a = new Int16Array(st.walls.length * 3), hs = new Int16Array(st.holes.length);
  for (let i = 0; i < st.walls.length; i++) { const w = st.walls[i]; a[i * 3] = w.x; a[i * 3 + 1] = w.y; a[i * 3 + 2] = w.gone ? 1 : 0; }
  for (let i = 0; i < st.holes.length; i++) hs[i] = st.holes[i].filled ? st.holes[i].by + 1 : 0;
  return { px: st.px, py: st.py, a, hs, dir: G.hero.dir, pushes: G.pushes };
}
function undo() {
  if (G.mode !== 'play' || G.st.scroll || !G.history.length) return false;
  const sn = G.history.pop(), st = G.st, h = G.hero;
  const hb = heroDrawn();
  const before = st.walls.map((w, i) => wallDrawn(i));
  st.wallAt.fill(0); st.holeAt.fill(0);
  for (let i = 0; i < st.holes.length; i++) {
    const ho = st.holes[i]; ho.filled = sn.hs[i] > 0; ho.by = sn.hs[i] - 1;
    if (!ho.filled) st.holeAt[ho.y * st.w + ho.x] = i + 1;
  }
  for (let i = 0; i < st.walls.length; i++) {
    const w = st.walls[i], v = G.wv[i];
    w.x = sn.a[i * 3]; w.y = sn.a[i * 3 + 1]; w.gone = sn.a[i * 3 + 2] === 1;
    if (!w.gone) { st.wallAt[w.y * st.w + w.x] = i + 1; v.fall = 0; v.landed = false; }
    const nx = w.x - st.cam, ny = w.y;
    if (before[i][0] !== nx || before[i][1] !== ny) { v.ox = before[i][0] - nx; v.oy = before[i][1] - ny; v.t = 0; v.d = .12; }
  }
  st.px = sn.px; st.py = sn.py; h.dir = sn.dir; G.pushes = sn.pushes; onPush();
  const ha = heroBase(); h.ox = hb[0] - ha[0]; h.oy = hb[1] - ha[1]; h.t = 0; h.d = .1; h.moving = 1;
  Snd.undo();
  return true;
}

/* ---------- positions (in screen cells, float) ---------- */
function heroBase() {
  const st = G.st; let x = st.px - st.cam;
  if (st.scroll && st.px > 0 && st.wallAt[st.py * st.w + st.px - 1]) x += G.f;
  return [x, st.py];
}
function heroDrawn() {
  const h = G.hero, b = heroBase(), k = 1 - easeOut(h.t);
  const bump = h.bt < 1 ? Math.sin(h.bt * Math.PI) * .13 : 0;
  return [b[0] + h.ox * k + h.bx * bump, b[1] + h.oy * k + h.by * bump];
}
function wallBase(i) { const st = G.st, w = st.walls[i]; return [w.x - st.cam + (st.scroll ? G.f : 0), w.y]; }
function wallDrawn(i) {
  const v = G.wv[i], b = wallBase(i), k = 1 - easeOut(v.t);
  return [b[0] + v.ox * k, b[1] + v.oy * k];
}

/* ---------- particles ---------- */
function spawn(p) { if (G.particles.length < 700) G.particles.push(p); }
function burst(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const a = (o.a0 || 0) + Math.random() * (o.spread == null ? TAU : o.spread), sp = o.sp * (.35 + Math.random() * .9);
    spawn({ x: x + (Math.random() - .5) * (o.jit || 0), y: y + (Math.random() - .5) * (o.jit || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0, max: o.life * (.6 + Math.random() * .7), size: o.size * (.6 + Math.random() * .8), col: o.col, add: o.add !== false, drag: o.drag == null ? 3 : o.drag, grow: o.grow || 0, type: o.type || 'dot' });
  }
}
function dust(x, y, dx, dy) {
  burst(x, y, 7, { a0: Math.atan2(-dy, -dx) - .9, spread: 1.8, sp: 1.6, life: .45, size: .16, col: '215,205,190', add: false, grow: .5, type: 'smoke', jit: .3 });
}
function explode(x, y) {
  burst(x, y, 46, { sp: 9, life: .7, size: .42, col: '255,170,60', drag: 3.2 });
  burst(x, y, 26, { sp: 5, life: .9, size: .6, col: '255,90,30', drag: 2.6 });
  burst(x, y, 16, { sp: 13, life: .5, size: .2, col: '255,245,200', drag: 2.2, type: 'spark' });
  burst(x, y, 10, { sp: 2.2, life: 1.5, size: .4, col: '28,24,22', add: false, grow: .9, type: 'smoke', drag: 1.6, jit: .5 });
  spawn({ x, y, vx: 0, vy: 0, life: 0, max: .55, size: .4, col: '255,220,160', add: true, drag: 0, grow: 9, type: 'ring' });
}

/* ---------- moves ---------- */
function doMove(d) {
  const st = G.st, h = G.hero, dx = DIRS[d][0], dy = DIRS[d][1];
  h.dir = d;
  const hb = heroDrawn();
  const tx = st.px + dx, ty = st.py + dy;
  const wi = Rules.inWin(st, tx, ty) ? st.wallAt[ty * st.w + tx] - 1 : -1;
  const wb = wi >= 0 ? wallDrawn(wi) : null;
  const snap = st.scroll ? null : snapshot();
  const r = Rules.tryMove(st, dx, dy);
  if (r.t === 'blocked') {
    h.bx = dx; h.by = dy; h.bt = 0; G.blockCool = .26; G.blockDir = d;
    if (wi >= 0) G.wv[wi].shake = 1;
    if (r.pillar) Snd.clank(); else Snd.bump();
    return false;
  }
  if (snap) { G.history.push(snap); if (G.history.length > 800) G.history.shift(); }
  G.moves++;
  const ha = heroBase();
  h.ox = hb[0] - ha[0]; h.oy = hb[1] - ha[1]; h.t = 0; h.d = r.t === 'push' ? PUSH_D : MOVE_D; h.moving = 1;
  if (r.t === 'push') {
    const v = G.wv[wi], wa = wallBase(wi);
    v.ox = wb[0] - wa[0]; v.oy = wb[1] - wa[1]; v.t = 0; v.d = r.ice ? .05 + .07 * r.dist : PUSH_D; h.push = 1;
    v.fall = 0; v.landed = false;
    G.pushes++; onPush();
    if (r.ice) { Snd.slide(r.dist); burst(wb[0] + .5, wb[1] + .6, 6, { a0: Math.atan2(-dy, -dx) - .6, spread: 1.2, sp: 2, life: .4, size: .08, col: '220,245,255', drag: 3, type: 'spark' }); }
    else { dust(wa[0] + .5 - dx * .5, wa[1] + .55 - dy * .5, dx, dy); Snd.push(); }
  } else Snd.step();
  if (r.t === 'win') winLevel();
  return true;
}

function winLevel() {
  const st = G.st;
  G.mode = 'won'; G.endT = 0; G.panelShown = false;
  for (let i = 0; i < st.bombs.length; i++) if (st.bombs[i].x === st.px && st.bombs[i].y === st.py) G.bombState[i] = 1;
  const ratio = G.timeLeft / G.time;
  // rolling boards cannot be finished before the last column arrives, so they are rated on the time left after that
  G.stars = st.scroll ? (G.timeLeft >= 5 ? 3 : G.timeLeft >= 3 ? 2 : 1) : (ratio >= .5 ? 3 : ratio >= .25 ? 2 : 1);
  const x = st.px - st.cam + .5, y = st.py + .5;
  const n = parseInt(G.theme.accent.slice(1), 16), ac = (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255);
  burst(x, y, 34, { sp: 6, life: .9, size: .22, col: '120,255,170', drag: 2.4, type: 'spark' });
  burst(x, y, 24, { sp: 4, life: 1.1, size: .3, col: ac, drag: 2 });
  spawn({ x, y, vx: 0, vy: 0, life: 0, max: .6, size: .3, col: '120,255,170', add: true, drag: 0, grow: 6, type: 'ring' });
  Snd.win();
  onWin();
}

function loseLevel(kind) {
  const st = G.st;
  G.mode = 'lost'; G.loseKind = kind; G.endT = 0; G.panelShown = false;
  if (kind === 'boom') {
    let any = false;
    for (const b of st.bombs) {
      const sx = b.x - st.cam + (st.scroll ? G.f : 0);
      if (sx > -2 && sx < st.vw + 2) { explode(sx + .5, b.y + .5); any = true; }
    }
    if (!any) { const p = heroDrawn(); explode(p[0] + .5 - 2, p[1] + .5); }
    G.flash = 1; G.shake = 1; G.hero.alpha = 0;
    const p = heroDrawn(); burst(p[0] + .5, p[1] + .5, 14, { sp: 4, life: .8, size: .3, col: '255,150,60', drag: 2.5 });
    Snd.boom();
  } else {
    const p = heroDrawn();
    burst(p[0] + .5, p[1] + .5, 22, { a0: Math.PI * .5, spread: Math.PI, sp: 6, life: .6, size: .2, col: '255,200,120', drag: 3, type: 'spark' });
    burst(p[0] + .5, p[1] + .5, 10, { sp: 2, life: .7, size: .4, col: '210,200,190', add: false, grow: .8, type: 'smoke' });
    G.shake = .7; Snd.squash();
  }
  onLose(kind);
}

/* ---------- update ---------- */
function update(dt) {
  G.clock += dt;
  const st = G.st, h = G.hero;
  if (!st) return;
  h.t = Math.min(1, h.t + dt / h.d);
  h.bt = Math.min(1, h.bt + dt / .15);
  if (h.t < 1) h.walk += dt * 4.4;
  else { h.moving = Math.max(0, h.moving - dt * 9); h.push = Math.max(0, h.push - dt * 7); }
  for (let i = 0; i < G.wv.length; i++) {
    const v = G.wv[i];
    if (v.t < 1) v.t = Math.min(1, v.t + dt / v.d);
    if (v.shake > 0) v.shake = Math.max(0, v.shake - dt * 7);
    if (st.walls[i].gone && v.t >= 1 && !v.landed) {
      v.fall = Math.min(1, v.fall + dt / .32);
      if (v.fall >= 1) {
        v.landed = true;
        const w = st.walls[i], x = w.x - st.cam + .5, y = w.y + .5;
        burst(x, y, 12, { sp: 2.4, life: .55, size: .2, col: '205,195,180', add: false, grow: .6, type: 'smoke', jit: .5 });
        G.shake = Math.max(G.shake, .25); Snd.thud();
      }
    }
  }
  G.shake = Math.max(0, G.shake - dt * 1.6);
  G.flash = Math.max(0, G.flash - dt * 1.9);
  G.blockCool = Math.max(0, G.blockCool - dt);
  // particles
  const ps = G.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]; p.life += dt;
    if (p.life >= p.max) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
    const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.size += p.grow * dt;
  }
  if (G.mode === 'intro') {
    G.introT += dt;
    if (G.introT >= .7) {
      G.mode = 'play';
      const p = heroBase(); burst(p[0] + .5, p[1] + .85, 9, { a0: Math.PI, spread: Math.PI, sp: 2.2, life: .5, size: .18, col: '215,205,190', add: false, grow: .5, type: 'smoke' });
      Snd.land();
    }
  }
  if (G.mode === 'play') {
    G.timeLeft -= dt;
    const sec = Math.ceil(G.timeLeft * (G.timeLeft < 5 ? 2 : 1));
    if (G.timeLeft < 10 && sec !== G.lastBeep) { G.lastBeep = sec; Snd.beep(G.timeLeft < 5); }
    if (h.t >= 1) {
      let d = -1, fromHeld = false;
      if (Input.queue.length) d = Input.queue.shift();
      else if (Input.held.length && performance.now() - Input.t0 > 230) {
        // a held key keeps walking over free floor after a short delay, but never pushes:
        // every push needs its own key press
        d = Input.held[Input.held.length - 1]; fromHeld = true;
        const tx = st.px + DIRS[d][0], ty = st.py + DIRS[d][1];
        const ti = ty * st.w + tx;
        if (!Rules.inWin(st, tx, ty) || st.wallAt[ti] || st.pil[ti] || st.holeAt[ti]) d = -1;
      }
      if (d >= 0) doMove(d);
    }
    if (G.mode === 'play' && st.scroll && !G.scrollDone) {
      G.f += dt / G.tickDur;
      while (G.f >= 1 && G.mode === 'play' && !G.scrollDone) {
        G.f -= 1;
        const r = Rules.tick(st);
        Snd.tick(); onTick();
        if (r.dead) { G.f = 0; loseLevel('squash'); break; }
        if (r.win) { G.f = 0; winLevel(); break; }
        if (r.end) { G.scrollDone = true; G.f = 0; }
      }
    }
    if (G.mode === 'play' && G.timeLeft <= 0) { G.timeLeft = 0; loseLevel('boom'); }
    // fuse sparks on live bombs
    if (Math.random() < dt * 22) {
      const b = st.bombs[(Math.random() * st.bombs.length) | 0];
      const sx = b.x - st.cam + (st.scroll ? G.f : 0);
      if (sx > -1 && sx < st.vw) spawn({ x: sx + .69, y: b.y + .16, vx: (Math.random() - .5) * 1.6, vy: -Math.random() * 1.6, life: 0, max: .3 + Math.random() * .3, size: .07, col: '255,210,120', add: true, drag: 2, grow: 0, type: 'dot' });
    }
  }
  if (G.mode === 'won') {
    G.endT += dt;
    h.lift = Math.abs(Math.sin(Math.min(G.endT, .9) / .9 * Math.PI * 2)) * .16;
    if (!G.panelShown && G.endT > .95) { G.panelShown = true; showResult(); }
  } else if (G.mode === 'lost') {
    G.endT += dt;
    if (G.loseKind === 'squash') { h.sx = lerp(h.sx, .12, Math.min(1, dt * 22)); h.alpha = Math.max(0, 1 - G.endT * 1.4); }
    if (!G.panelShown && G.endT > 1.25) { G.panelShown = true; showResult(); }
  }
}

/* ---------- layout + cached art ---------- */
function layout(force) {
  const r = stageEl.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.max(60, Math.round(r.width * dpr)), ch = Math.max(60, Math.round(r.height * dpr));
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; force = true; }
  V.cw = cw; V.ch = ch; V.dpr = dpr;
  if (!G.st) return;
  const C = G.st.vw, R = G.st.h;
  // on touch devices the d-pad gets its own strip, so it never covers the board
  const ap = document.getElementById('app');
  const pad = ap.classList.contains('touch') && ap.classList.contains('playing') ? Math.round(212 * dpr) : 0;
  // in portrait, also leave room for a hint between the board and the pad
  const aw = cw > ch ? cw - pad : cw, ah = cw > ch ? ch : ch - pad - (pad ? Math.round(118 * dpr) : 0);
  let s = Math.floor(Math.min(aw / (C + 1.3), ah / (R + 2.05)));
  s = clamp(s, 10, Math.round(96 * dpr));
  if (window.__zoom) s = Math.round(s * window.__zoom); // used only when rendering store covers
  V.s = s; V.ft = Math.round(s * .42); V.hh = Math.round(s * .24); V.C = C; V.R = R;
  V.ox = Math.round((aw - C * s) / 2); V.oy = Math.round((ah - R * s) / 2 + V.hh * .35);
  // portrait with a d-pad: board at the top, so the gap above the pad is free for hints
  if (pad && ch >= cw) V.oy = Math.min(V.oy, V.hh + V.ft + Math.round(10 * dpr));
  const sk = G.themeIdx + ':' + s;
  if (V.spritesKey !== sk) {
    V.spritesKey = sk;
    const th = G.theme, rnd = mulberry32(1000 + G.themeIdx * 77);
    V.floors = []; for (let i = 0; i < 8; i++) { const c = mkCanvas(s, s); paintFloor(c.getContext('2d'), s, th.floor, rnd); V.floors.push(c); }
    V.wallsS = []; for (let i = 0; i < 6; i++) { const c = mkCanvas(s, s + V.hh); paintWall(c.getContext('2d'), s, V.hh, th.wall, rnd); V.wallsS.push(c); }
    V.pillarS = mkCanvas(s, s + V.hh); paintPillar(V.pillarS.getContext('2d'), s, V.hh, th);
    V.iceS = mkCanvas(s, s + V.hh); paintIce(V.iceS.getContext('2d'), s, V.hh, mulberry32(4242));
    V.holeS = mkCanvas(s, s); paintHole(V.holeS.getContext('2d'), s, th);
    V.plugW = mkCanvas(s, s); paintPlug(V.plugW.getContext('2d'), s, V.wallsS[0]);
    V.plugI = mkCanvas(s, s); paintPlug(V.plugI.getContext('2d'), s, V.iceS);
    V.shPad = Math.ceil(s * .35);
    V.shadow = mkCanvas(s + V.shPad * 2, s + V.shPad * 2); paintShadow(V.shadow.getContext('2d'), s, V.shPad);
  }
  const fk = [sk, C, R, cw, ch, G.st.scroll, G.L.sx, V.ox, V.oy].join(':');
  if (V.frameKey !== fk || force) { V.frameKey = fk; buildFrame(); }
  const lw = Math.ceil(cw / 4), lh = Math.ceil(ch / 4);
  if (!V.light || V.light.width !== lw || V.light.height !== lh) { V.light = mkCanvas(lw, lh); V.lctx = V.light.getContext('2d'); }
}

function buildFrame() {
  const { cw, ch, s, ft, hh, ox, oy, C, R } = V, th = G.theme, scroll = G.st.scroll;
  V.back = mkCanvas(cw, ch);
  const b = V.back.getContext('2d');
  const bg = b.createRadialGradient(cw / 2, ch * .45, s, cw / 2, ch * .5, Math.max(cw, ch) * .72);
  bg.addColorStop(0, th.bg); bg.addColorStop(1, th.bg2);
  b.fillStyle = bg; b.fillRect(0, 0, cw, ch);
  // faint masonry in the dark around the board
  const rnd = mulberry32(G.themeIdx * 13 + 3);
  const bh = s * .5, bw = s * 1.1;
  for (let y = 0, j = 0; y < ch + bh; y += bh, j++) for (let x = -((j % 2) * bw / 2); x < cw; x += bw) {
    b.fillStyle = 'rgba(255,255,255,' + (.012 + rnd() * .03) + ')';
    rr(b, x + 2, y + 2, bw - 4, bh - 4, s * .05); b.fill();
  }
  // floor base under the play area (seen for a moment where tiles slide in)
  b.fillStyle = th.floor.g; b.fillRect(ox, oy - hh, C * s, R * s + hh);
  // front face of the top rim
  const fg = b.createLinearGradient(0, oy - hh, 0, oy);
  fg.addColorStop(0, shade(th.frame, -.2)); fg.addColorStop(1, shade(th.frame, -.62));
  b.fillStyle = fg; b.fillRect(ox, oy - hh, C * s, hh);
  b.strokeStyle = 'rgba(0,0,0,.35)'; b.lineWidth = Math.max(1, s * .02);
  for (let i = 0; i <= C * 2; i++) { const x = ox + i * s / 2 + (i % 2 ? 0 : 0); b.beginPath(); b.moveTo(x, oy - hh + (i % 2 ? hh / 2 : 0)); b.lineTo(x, oy - (i % 2 ? 0 : hh / 2)); b.stroke(); }
  b.beginPath(); b.moveTo(ox, oy - hh / 2); b.lineTo(ox + C * s, oy - hh / 2); b.stroke();

  V.front = mkCanvas(cw, ch);
  const f = V.front.getContext('2d');
  const X0 = ox - ft, Y0 = oy - hh - ft, X1 = ox + C * s + ft, Y1 = oy + R * s + ft, rad = s * .16;
  // outer front face along the bottom
  const og = f.createLinearGradient(0, Y1 - rad, 0, Y1 + hh);
  og.addColorStop(0, shade(th.frame, -.3)); og.addColorStop(1, shade(th.frame, -.7));
  f.fillStyle = og; rr(f, X0, Y1 - rad * 2, X1 - X0, hh + rad * 2, rad); f.fill();
  f.strokeStyle = 'rgba(0,0,0,.6)'; f.lineWidth = 1; f.stroke();
  // top faces of the rim (ring)
  const ring = () => { rr(f, X0, Y0, X1 - X0, Y1 - Y0, rad); f.rect(ox, oy - hh, C * s, R * s + hh); };
  f.save(); f.beginPath(); ring(); f.clip('evenodd');
  const tg = f.createLinearGradient(X0, Y0, X1, Y1);
  tg.addColorStop(0, shade(th.frame, .22)); tg.addColorStop(1, shade(th.frame, -.12));
  f.fillStyle = tg; f.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  // slab joints
  f.strokeStyle = 'rgba(0,0,0,.28)'; f.lineWidth = Math.max(1, s * .025);
  for (let i = 0; i <= C; i++) { const x = ox + i * s; f.beginPath(); f.moveTo(x, Y0); f.lineTo(x, oy - hh); f.moveTo(x, oy + R * s); f.lineTo(x, Y1); f.stroke(); }
  for (let j = 0; j <= R; j++) { const y = oy + j * s - hh * .5; f.beginPath(); f.moveTo(X0, y); f.lineTo(ox, y); f.moveTo(ox + C * s, y); f.lineTo(X1, y); f.stroke(); }
  for (let i = 0; i < 220; i++) { f.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.1)'; const d = Math.max(1, s * .025); f.fillRect(X0 + rnd() * (X1 - X0), Y0 + rnd() * (Y1 - Y0), d, d); }
  if (scroll) {
    // the crusher: hazard stripes on the right rim
    f.save(); f.beginPath(); f.rect(ox + C * s, Y0, ft, Y1 - Y0); f.clip();
    f.fillStyle = '#e9c93a'; f.fillRect(ox + C * s, Y0, ft, Y1 - Y0);
    f.fillStyle = '#1d1e18';
    const st = ft * .9;
    for (let y = Y0 - ft; y < Y1 + ft; y += st * 2) { f.beginPath(); f.moveTo(ox + C * s, y + ft); f.lineTo(ox + C * s + ft, y); f.lineTo(ox + C * s + ft, y + st); f.lineTo(ox + C * s, y + ft + st); f.fill(); }
    f.restore();
  }
  f.restore();
  // rim edges
  f.lineWidth = Math.max(1.5, s * .035);
  f.strokeStyle = 'rgba(255,255,255,.28)'; rr(f, X0 + f.lineWidth / 2, Y0 + f.lineWidth / 2, X1 - X0 - f.lineWidth, Y1 - Y0 - f.lineWidth, rad); f.stroke();
  f.strokeStyle = 'rgba(0,0,0,.7)'; f.lineWidth = Math.max(1, s * .03);
  f.beginPath(); f.moveTo(ox, oy - hh); f.lineTo(ox, oy + R * s); f.lineTo(ox + C * s, oy + R * s); f.lineTo(ox + C * s, oy - hh); f.stroke();
  f.strokeStyle = 'rgba(255,255,255,.22)'; f.beginPath(); f.moveTo(ox, oy - hh); f.lineTo(ox + C * s, oy - hh); f.stroke();
  if (scroll) {
    // steel teeth on the crusher, darkness where the maze rolls in
    const n = R * 3, th2 = (R * s) / n;
    for (let i = 0; i < n; i++) {
      const y = oy + i * th2;
      const tg2 = f.createLinearGradient(ox + C * s - s * .2, 0, ox + C * s, 0);
      tg2.addColorStop(0, '#f1f4f8'); tg2.addColorStop(1, '#6d7684');
      f.fillStyle = tg2; f.beginPath(); f.moveTo(ox + C * s + 1, y); f.lineTo(ox + C * s - s * .2, y + th2 / 2); f.lineTo(ox + C * s + 1, y + th2); f.fill();
      f.strokeStyle = 'rgba(0,0,0,.55)'; f.lineWidth = 1; f.stroke();
    }
  }
  // vignette
  const vg = f.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * .35, cw / 2, ch / 2, Math.max(cw, ch) * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
  f.fillStyle = vg; f.fillRect(0, 0, cw, ch);
}

/* ---------- render ---------- */
const items = [];
function render() {
  const st = G.st; if (!st || !V.back) return;
  const { cw, ch, s, hh, ox, oy, C, R } = V, c = ctx, h = G.hero;
  c.setTransform(1, 0, 0, 1, 0, 0);
  let shx = 0, shy = 0;
  if (G.shake > 0 && !REDUCE) { const m = G.shake * G.shake * s * .3; shx = (Math.random() - .5) * m; shy = (Math.random() - .5) * m; }
  c.fillStyle = G.theme.bg2; c.fillRect(0, 0, cw, ch);
  c.save(); c.translate(shx, shy);
  c.drawImage(V.back, 0, 0);
  const f = st.scroll ? G.f : 0, cam = st.cam;
  c.save(); c.beginPath(); c.rect(ox, oy - hh, C * s, R * s + hh); c.clip();
  // floor
  for (let y = 0; y < R; y++) for (let sx = (f > 0 ? -1 : 0); sx < C; sx++) {
    const wx = cam + sx;
    c.drawImage(V.floors[(hash2(wx, y, G.idx + 11) * 8) | 0], ox + Math.round((sx + f) * s), oy + y * s);
  }
  // rim shadows on the floor
  let sg = c.createLinearGradient(0, oy, 0, oy + s * .45);
  sg.addColorStop(0, 'rgba(0,0,0,.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg; c.fillRect(ox, oy, C * s, s * .45);
  sg = c.createLinearGradient(ox, 0, ox + s * .3, 0);
  sg.addColorStop(0, 'rgba(0,0,0,.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg; c.fillRect(ox, oy, s * .3, R * s);
  // holes, and holes a block has filled
  for (const ho of st.holes) {
    const hx0 = ox + (ho.x - cam + f) * s, hy0 = oy + ho.y * s;
    if (ho.filled && G.wv[ho.by].landed) c.drawImage(st.walls[ho.by].k === 'i' ? V.plugI : V.plugW, hx0, hy0);
    else c.drawImage(V.holeS, hx0, hy0);
  }
  // collect drawables
  items.length = 0;
  for (let i = 0; i < st.walls.length; i++) {
    const w = st.walls[i], bx = w.x - cam, v = G.wv[i];
    if (bx < -2 || bx > C + 1) continue;
    if (w.gone && v.landed) continue;
    const p = wallDrawn(i);
    let px = ox + p[0] * s, py = oy + p[1] * s;
    if (v.shake > 0) px += Math.sin(v.shake * 20) * v.shake * s * .04;
    const sink = w.gone && v.t >= 1 ? v.fall * v.fall : 0;
    items.push({ y: p[1] - (w.gone ? .5 : 0), k: 0, x: px, py, v: v.v, ice: w.k === 'i', sink, cy: w.y });
    if (!w.gone) c.drawImage(V.shadow, px - V.shPad + s * (w.k === 'i' ? .08 : .13), py - V.shPad + s * (w.k === 'i' ? .08 : .13));
  }
  for (const pl of st.pillars) {
    const bx = pl.x - cam + f; if (bx < -2 || bx > C + 1) continue;
    const px = ox + bx * s, py = oy + pl.y * s;
    c.drawImage(V.shadow, px - V.shPad + s * .15, py - V.shPad + s * .15);
    items.push({ y: pl.y, k: 3, x: px, py });
  }
  const urg = clamp(1 - G.timeLeft / Math.min(G.time, 12), 0, 1);
  for (let i = 0; i < st.bombs.length; i++) {
    const bm = st.bombs[i], bx = bm.x - cam + f;
    if (bx < -1 || bx > C) continue;
    if (G.mode === 'lost' && G.loseKind === 'boom') continue;
    items.push({ y: bm.y + .01, k: 1, x: ox + (bx + .5) * s, py: oy + (bm.y + .44) * s, v: G.bombState[i] });
  }
  const hp = heroDrawn();
  let hx = hp[0], hy = hp[1], sqx = h.sx, hyOff = 0, alpha = h.alpha;
  if (G.mode === 'intro') {
    const t = clamp(G.introT / .7, 0, 1);
    hyOff = -(1 - t * t) * 2.2; alpha = clamp(t * 3, 0, 1);
    h.sy = 1; if (t > .92) h.sy = .86;
  } else if (G.mode !== 'lost') { h.sy = lerp(h.sy, 1, .2); }
  if (st.scroll && G.mode === 'play' && hx > C - 1) { const over = hx - (C - 1); sqx = Math.max(.25, 1 - over * .8); hx -= over * .55; }
  if (G.mode === 'title') alpha = 1;
  items.push({ y: hy + .02, k: 2, x: ox + (hx + .5) * s, py: oy + (hy + .43 + hyOff) * s, a: alpha, sqx });
  items.sort((a, b) => a.y - b.y);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.k === 0) {
      const spr = it.ice ? V.iceS : V.wallsS[it.v];
      if (it.sink > 0) {
        c.save(); c.beginPath(); c.rect(it.x - 2, oy - hh, s + 4, oy + (it.cy + 1) * s - (oy - hh)); c.clip();
        c.drawImage(spr, Math.round(it.x), Math.round(it.py - hh + it.sink * s * .95));
        c.fillStyle = 'rgba(0,0,0,' + it.sink * .55 + ')'; c.fillRect(it.x, it.py - hh + it.sink * s * .95, s, s + hh);
        c.restore();
      } else c.drawImage(spr, Math.round(it.x), Math.round(it.py - hh));
    }
    else if (it.k === 3) c.drawImage(V.pillarS, Math.round(it.x), Math.round(it.py - hh));
    else if (it.k === 1) drawBomb(c, it.x, it.py, s, G.clock, urg, it.v);
    else if (it.a > 0.01) drawHero(c, it.x, it.py, s, { dir: h.dir, walk: h.walk, moving: h.moving, push: h.push, sx: it.sqx, sy: h.sy * (1 + Math.sin(G.clock * 3) * .012 * (1 - h.moving)), lift: h.lift, alpha: it.a });
  }
  if (st.scroll) {
    // darkness where the maze rolls in; lifts once the scrolling has stopped
    G.fog = lerp(G.fog == null ? 1 : G.fog, st.cam <= 1 ? 0 : 1, .06);
    if (G.fog > .01) {
      const dg = c.createLinearGradient(ox, 0, ox + s * 1.5, 0);
      dg.addColorStop(0, 'rgba(0,0,0,' + .85 * G.fog + ')'); dg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = dg; c.fillRect(ox, oy - hh, s * 1.5, R * s + hh);
    }
  }
  c.restore();
  c.drawImage(V.front, 0, 0);

  // light map: ambient darkness with pools of light, multiplied over the scene
  const lc = V.lctx, k = V.light.width / cw, a = G.theme.amb;
  lc.globalCompositeOperation = 'source-over';
  lc.fillStyle = 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')'; lc.fillRect(0, 0, V.light.width, V.light.height);
  lc.globalCompositeOperation = 'lighter';
  const L = (x, y, r, col, al) => {
    x *= k; y *= k; r *= k;
    const g = lc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + col + ',' + al + ')'); g.addColorStop(.5, 'rgba(' + col + ',' + al * .45 + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
    lc.fillStyle = g; lc.fillRect(x - r, y - r, r * 2, r * 2);
  };
  if (alpha > 0.01) L(ox + (hx + .5) * s, oy + (hy + .4 + hyOff * .3) * s, s * 4.6, '255,236,200', .95 * alpha);
  for (const it of items) if (it.k === 1 && !it.v) L(it.x, it.py, s * 2.3, '255,80,50', .32 + .26 * (.5 + .5 * Math.sin(G.clock * (4 + urg * 10))));
  if (G.mode === 'intro' || (G.mode === 'title')) L(ox + (hx + .5) * s, oy - hh, s * 3, '255,240,210', .5 * (G.mode === 'title' ? .6 : 1 - G.introT / .7));
  if (st.scroll) L(ox + C * s, oy + R * s / 2, s * 3.2, '255,70,40', .16 + .1 * Math.sin(G.clock * 6));
  if (G.flash > 0) L(cw / 2, ch / 2, Math.max(cw, ch), '255,220,170', G.flash);
  for (let i = 0, n = 0; i < G.particles.length && n < 14; i++) { const p = G.particles[i]; if (p.add && p.size > .25) { n++; L(ox + p.x * s, oy + p.y * s, s * p.size * 4, p.col, .35 * (1 - p.life / p.max)); } }
  c.globalCompositeOperation = 'multiply';
  c.drawImage(V.light, 0, 0, cw, ch);
  // warm bloom from the headlamp
  if (alpha > 0.01) {
    c.globalCompositeOperation = 'lighter';
    const lx = ox + (hx + .5) * s, ly = oy + (hy + .35 + hyOff * .3) * s, lr = s * 3.4;
    const bl = c.createRadialGradient(lx, ly, 0, lx, ly, lr);
    bl.addColorStop(0, 'rgba(255,214,150,' + .2 * alpha + ')'); bl.addColorStop(.4, 'rgba(255,200,130,' + .08 * alpha + ')'); bl.addColorStop(1, 'rgba(255,200,130,0)');
    c.fillStyle = bl; c.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
  }
  c.globalCompositeOperation = 'source-over';

  // ambient motes
  const mk = G.theme.mote, mg = glow(mk.c);
  c.globalCompositeOperation = 'lighter';
  for (const m of G.motes) {
    const t = G.clock * m.sp;
    let mx = m.x, my = m.y, al = .22, sz = s * .09 * m.sz;
    if (mk.k === 'drip') { my = (m.y + t * 1.3) % (R + 1) - .5; al = .28; sz *= .8; }
    else if (mk.k === 'snow') { my = (m.y + t * .35) % (R + 1) - .5; mx = m.x + Math.sin(t + m.ph) * .3; al = .4; }
    else if (mk.k === 'ember') { my = R - ((m.y + t * .5) % (R + 1)) + .5; mx = m.x + Math.sin(t * 2 + m.ph) * .2; al = .3 + .3 * Math.sin(t * 5 + m.ph); sz *= .9; }
    else if (mk.k === 'steam') { my = R - ((m.y + t * .3) % (R + 1)) + .5; mx = m.x + Math.sin(t + m.ph) * .4; al = .07; sz *= 5; }
    else if (mk.k === 'spark') { al = Math.max(0, Math.sin(t * 1.7 + m.ph)) * .55; sz *= 1.2; }
    else { mx = m.x + Math.sin(t * .4 + m.ph) * .5; my = m.y + Math.cos(t * .3 + m.ph) * .4; al = .1 + .1 * Math.sin(t + m.ph); }
    c.globalAlpha = clamp(al, 0, 1);
    c.drawImage(mg, ox + mx * s - sz, oy + my * s - sz, sz * 2, sz * 2);
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

  // particles
  for (let i = 0; i < G.particles.length; i++) {
    const p = G.particles[i], t = p.life / p.max, px = ox + p.x * s, py = oy + p.y * s, sz = p.size * s;
    if (p.type === 'ring') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - t) * .8;
      c.strokeStyle = 'rgb(' + p.col + ')'; c.lineWidth = s * .12 * (1 - t) + 1; c.beginPath(); c.arc(px, py, sz, 0, TAU); c.stroke();
    } else if (p.type === 'spark') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - t;
      c.strokeStyle = 'rgb(' + p.col + ')'; c.lineWidth = Math.max(1, sz * .25); c.lineCap = 'round';
      c.beginPath(); c.moveTo(px, py); c.lineTo(px - p.vx * s * .04, py - p.vy * s * .04); c.stroke();
    } else if (p.type === 'smoke') {
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = (1 - t) * .45;
      c.fillStyle = 'rgb(' + p.col + ')'; c.beginPath(); c.arc(px, py, sz, 0, TAU); c.fill();
    } else {
      c.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; c.globalAlpha = 1 - t * t;
      c.drawImage(glow(p.col), px - sz, py - sz, sz * 2, sz * 2);
    }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.restore();
  if (G.flash > 0) { c.fillStyle = 'rgba(255,235,200,' + (G.flash * (REDUCE ? .25 : .7)) + ')'; c.fillRect(0, 0, cw, ch); }
}

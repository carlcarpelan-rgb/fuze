/* ===== Fuze Tower: level state, turn animation and drawing ===== */
const PUSH_D_T = 0.14;

function loadLevel(idx) {
  const lv = LEVELS[idx];
  G.idx = idx;
  G.L = TowerRules.parseLevel(lv);
  G.st = TowerRules.makeState(G.L);
  G.st.vw = G.st.w; G.st.scroll = false; G.st.cam = 0;
  G.themeIdx = 100 + G.L.theme; G.theme = TTHEMES[G.L.theme];
  G.time = lv.t; G.timeLeft = lv.t;
  G.hero = { dir: 1, walk: 0, moving: 0, push: 0, ox: 0, oy: 0, t: 1, d: MOVE_D, bx: 0, by: 0, bt: 1, sx: 1, sy: 1, lift: 0, alpha: 1 };
  G.bv = G.st.blocks.map((b, i) => ({ v: (i * 5 + idx * 3 + b.x + b.y) % 6, ox: 0, oy: 0, t: 1, d: .1, shake: 0 }));
  G.cv = G.st.cars.map((c, i) => ({ col: (G.L.cars[i].v || (i * 3 + idx * 5 + c.x * 7 + c.y)) % CAR_COLS.length, ox: 0, oy: 0, t: 1, d: .1, shake: 0 }));
  G.gv = G.st.guards.map(() => ({ ox: 0, oy: 0, t: 1, d: MOVE_D, walk: 0, moving: 0, ko: 0, alert: 0, bx: 0, by: 0, bt: 1 }));
  G.history = []; G.particles.length = 0;
  G.shake = 0; G.flash = 0; G.alarm = 0; G.introT = 0; G.endT = 0; G.panelShown = false; G.loseKind = ''; G.fuseFlash = 0; G.refillT = 0;
  G.blockCool = 0; G.blockDir = -1; G.lastBeep = 99; G.goalHit = null; G.liftIn = 0; G.liftOpen = {}; G.dinged = false; G.lit = false;
  G.ventT = 0; G.powerT = 0; G.lightsT = 0; G.radioOn = {};
  G.motes = [];
  const rnd = mulberry32(idx * 31 + 7);
  for (let i = 0; i < 26; i++) G.motes.push({ x: rnd() * G.st.w, y: rnd() * G.st.h, ph: rnd() * TAU, sp: .5 + rnd(), sz: .5 + rnd() });
  layout(true);
}

/* ---------- positions (cells, float) ---------- */
function heroBase() { return [G.st.px, G.st.py]; }
function heroDrawn() {
  const h = G.hero, k = 1 - easeOut(h.t), bump = h.bt < 1 ? Math.sin(h.bt * Math.PI) * .13 : 0;
  return [G.st.px + h.ox * k + h.bx * bump, G.st.py + h.oy * k + h.by * bump];
}
function blockDrawn(i) { const b = G.st.blocks[i], v = G.bv[i], k = 1 - easeOut(v.t); return [b.x + v.ox * k, b.y + v.oy * k]; }
function carDrawn(i) { const b = G.st.cars[i], v = G.cv[i], k = 1 - easeOut(v.t); return [b.x + v.ox * k, b.y + v.oy * k]; }
function guardDrawn(i) {
  const g = G.st.guards[i], v = G.gv[i], k = 1 - easeOut(v.t), bump = v.bt < 1 ? Math.sin(v.bt * Math.PI) * .35 : 0;
  return [g.x + v.ox * k + v.bx * bump, g.y + v.oy * k + v.by * bump];
}

/* ---------- a move ---------- */
function doMove(d) {
  const st = G.st, h = G.hero, dx = TowerRules.DX[d], dy = TowerRules.DY[d];
  h.dir = d;
  const hb = heroDrawn(), bd = st.blocks.map((_, i) => blockDrawn(i)), cd = st.cars.map((_, i) => carDrawn(i)), gd = st.guards.map((_, i) => guardDrawn(i));
  const snap = TowerRules.clone(st);
  const r = TowerRules.step(st, d);
  if (r.t === 'blocked') {
    h.bx = dx; h.by = dy; h.bt = 0; G.blockCool = .26; G.blockDir = d;
    if (r.block != null) G.bv[r.block].shake = 1;
    if (r.car != null) G.cv[r.car].shake = 1;
    Snd.bump();
    return false;
  }
  G.history.push({ st: snap, time: G.timeLeft });
  G.lit = true; // the fuse catches on your first step: look as long as you like before that
  const ha = heroBase();
  h.ox = hb[0] - ha[0]; h.oy = hb[1] - ha[1]; h.t = 0; h.d = r.t === 'push' ? PUSH_D_T : MOVE_D; h.moving = 1;
  if (r.vent) { // into the vent, out of the other end: no slide across the floor
    h.ox = 0; h.oy = 0; h.t = 1; h.sy = .6; G.ventT = 1;
    for (const [vx, vy] of [[r.vent[0], r.vent[1]], [r.vent[2], r.vent[3]]]) burst(vx + .5, vy + .5, 12, { sp: 2.5, life: .5, size: .12, col: '200,215,230', drag: 3, type: 'smoke' });
    Snd.vent();
  }
  if (r.radio != null) { // music: a bump against the radio, notes, and guards nearby spin round to look
    const rx = r.radio % st.w, ry = (r.radio - rx) / st.w;
    h.bx = dx; h.by = dy; h.bt = 0; G.radioOn = G.radioOn || {}; G.radioOn[r.radio] = 1;
    for (let j = 0; j < 3; j++) spawn({ x: rx + .5 + (j - 1) * .2, y: ry + .1, vx: (j - 1) * .5, vy: -1.6 - j * .3, life: 0, max: 1.1 - j * .15, size: .16, col: '255,230,140', add: true, drag: .5, grow: 0, type: 'spark' });
    spawn({ x: rx + .5, y: ry + .4, vx: 0, vy: 0, life: 0, max: .8, size: .3, col: '255,230,140', add: true, drag: 0, grow: 6, type: 'ring' });
    for (const k of r.heard) { const gv = G.gv[k]; gv.alert = .001; gv.bt = 0; gv.bx = 0; gv.by = -.4; }
    Snd.radio();
  }
  if (r.power != null) { Snd.power(r.power); G.powerT = 1; }
  if (r.lights) { Snd.power(1); G.lightsT = 1; }
  st.blocks.forEach((b, i) => { if (bd[i][0] !== b.x || bd[i][1] !== b.y) { const v = G.bv[i]; v.ox = bd[i][0] - b.x; v.oy = bd[i][1] - b.y; v.t = 0; v.d = PUSH_D_T; } });
  st.cars.forEach((b, i) => { if (cd[i][0] !== b.x || cd[i][1] !== b.y) { const v = G.cv[i]; v.ox = cd[i][0] - b.x; v.oy = cd[i][1] - b.y; v.t = 0; v.d = PUSH_D_T * 1.3; } });
  st.guards.forEach((g, i) => { const v = G.gv[i]; if (gd[i][0] !== g.x || gd[i][1] !== g.y) { v.ox = gd[i][0] - g.x; v.oy = gd[i][1] - g.y; v.t = 0; v.d = MOVE_D * 1.1; v.moving = 1; } });
  if (r.t === 'push') {
    h.push = 1;
    if (r.car != null) { const cr = st.cars[r.car]; dust(st.px + .5 + dx * .5, st.py + .55 + dy * .5, dx, dy); Snd.roll(); }
    else { const b = st.blocks[r.block]; dust(b.x + .5 - dx * .5, b.y + .55 - dy * .5, dx, dy); Snd.push(); }
    if (r.crushed) for (const ci of r.crushed) { const cx = ci % st.w, cy = (ci - cx) / st.w; glassBurst(cx + .5, cy + .5, 16); Snd.crunch(); }
  } else if (r.t === 'takedown') {
    G.gv[r.g].ko = .001; G.shake = Math.max(G.shake, .35); Snd.takedown();
    burst(st.px + .5, st.py + .4, 10, { sp: 3, life: .4, size: .12, col: '255,240,200', drag: 3, type: 'spark' });
  } else Snd.step();
  if (r.cost) { G.timeLeft -= r.cost; G.fuseFlash = 1; glassBurst(st.px + .5, st.py + .7, 8); Snd.glass(); }
  if (r.refill) { G.timeLeft = G.time; G.refillT = 1; Snd.refill(); burst(st.px + .5, st.py + .4, 26, { sp: 4, life: .8, size: .18, col: '255,200,90', drag: 2.4, type: 'spark' }); }
  if (r.t === 'win') winLevel(r.goal);
  else if (r.t === 'caught') loseLevel(r.by === 'laser' ? 'laser' : 'caught', r);
  else if (G.timeLeft <= 0) { G.timeLeft = 0; loseLevel('boom'); }
  return true;
}
function undo() {
  if (G.mode !== 'play' || !G.history.length) return false;
  const sn = G.history.pop(), h = G.hero;
  const hb = heroDrawn(), bd = G.st.blocks.map((_, i) => blockDrawn(i)), cd = G.st.cars.map((_, i) => carDrawn(i)), gd = G.st.guards.map((_, i) => guardDrawn(i));
  G.st = Object.assign(sn.st, { vw: G.st.w, scroll: false, cam: 0 });
  const st = G.st;
  st.blocks.forEach((b, i) => { const v = G.bv[i]; if (bd[i][0] !== b.x || bd[i][1] !== b.y) { v.ox = bd[i][0] - b.x; v.oy = bd[i][1] - b.y; v.t = 0; v.d = .12; } });
  st.cars.forEach((b, i) => { const v = G.cv[i]; if (cd[i][0] !== b.x || cd[i][1] !== b.y) { v.ox = cd[i][0] - b.x; v.oy = cd[i][1] - b.y; v.t = 0; v.d = .12; } });
  st.guards.forEach((g, i) => { const v = G.gv[i]; if (g.alive) v.ko = 0; if (gd[i][0] !== g.x || gd[i][1] !== g.y) { v.ox = gd[i][0] - g.x; v.oy = gd[i][1] - g.y; v.t = 0; v.d = .12; } });
  h.ox = hb[0] - st.px; h.oy = hb[1] - st.py; h.t = 0; h.d = .1; h.moving = 1;
  Snd.undo();
  return true;
}
function glassBurst(x, y, n) { burst(x, y, n, { sp: 3.2, life: .5, size: .07, col: '210,240,255', drag: 3, type: 'spark', jit: .4 }); }

function winLevel(goal) {
  const st = G.st;
  G.mode = 'won'; G.endT = 0; G.panelShown = false; G.goalHit = goal;
  const x = st.px + .5, y = st.py + .5;
  if (goal === 'bomb') {
    burst(x, y, 34, { sp: 6, life: .9, size: .22, col: '120,255,170', drag: 2.4, type: 'spark' });
    spawn({ x, y, vx: 0, vy: 0, life: 0, max: .6, size: .3, col: '120,255,170', add: true, drag: 0, grow: 6, type: 'ring' });
  } else {
    burst(x, y, 20, { a0: -Math.PI * .75, spread: Math.PI * .5, sp: 5, life: 1, size: .16, col: '120,255,180', drag: 1.5, type: 'spark' });
  }
  Snd.win();
  onWin();
}
function loseLevel(kind, r) {
  const st = G.st;
  G.mode = 'lost'; G.loseKind = kind; G.endT = 0; G.panelShown = false;
  if (kind === 'boom') {
    const p = heroDrawn();
    explode(p[0] + .5, p[1] + .5); G.flash = 1; G.shake = 1; G.hero.alpha = 0; Snd.boom();
  } else {
    G.alarm = 1; G.shake = .5;
    if (kind === 'caught' && r && r.g != null) { G.gv[r.g].alert = .001; const gv = G.gv[r.g], g = st.guards[r.g]; gv.bx = TowerRules.DX[g.face]; gv.by = TowerRules.DY[g.face]; gv.bt = 0; }
    Snd.alarm();
  }
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
  for (const v of G.bv.concat(G.cv)) { if (v.t < 1) v.t = Math.min(1, v.t + dt / v.d); if (v.shake > 0) v.shake = Math.max(0, v.shake - dt * 7); }
  for (const v of G.gv) {
    if (v.t < 1) { v.t = Math.min(1, v.t + dt / v.d); v.walk += dt * 4.4; } else v.moving = Math.max(0, v.moving - dt * 9);
    if (v.ko > 0 && v.ko < 1) v.ko = Math.min(1, v.ko + dt * 5);
    if (v.alert > 0) v.alert += dt;
    v.bt = Math.min(1, v.bt + dt / .25);
  }
  G.shake = Math.max(0, G.shake - dt * 1.6);
  G.flash = Math.max(0, G.flash - dt * 1.9);
  G.fuseFlash = Math.max(0, G.fuseFlash - dt * 2.5);
  G.refillT = Math.max(0, G.refillT - dt * 1.5);
  G.ventT = Math.max(0, G.ventT - dt * 3); G.powerT = Math.max(0, G.powerT - dt * 2); G.lightsT = Math.max(0, G.lightsT - dt * 1.2);
  if (G.ventT <= 0) h.sy = lerp(h.sy, 1, .3);
  G.blockCool = Math.max(0, G.blockCool - dt);
  const ps = G.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]; p.life += dt;
    if (p.life >= p.max) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
    const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.size += p.grow * dt;
  }
  if (G.mode === 'intro') {
    G.introT += dt;
    if (G.introT >= .7) { G.mode = 'play'; burst(st.px + .5, st.py + .85, 9, { a0: Math.PI, spread: Math.PI, sp: 2.2, life: .5, size: .18, col: '215,205,190', add: false, grow: .5, type: 'smoke' }); Snd.land(); }
  }
  if (G.mode === 'play') {
    if (G.lit) G.timeLeft -= dt;
    const sec = Math.ceil(G.timeLeft * (G.timeLeft < 5 ? 2 : 1));
    if (G.lit && G.timeLeft < 8 && sec !== G.lastBeep) { G.lastBeep = sec; Snd.beep(G.timeLeft < 4); }
    if (h.t >= 1 && G.gv.every(v => v.t >= 1)) {
      let d = -1;
      if (Input.queue.length) d = Input.queue.shift();
      else if (Input.held.length && performance.now() - Input.t0 > 230) {
        // a held key keeps walking over open floor, but never pushes, never walks into a guard
        d = Input.held[Input.held.length - 1];
        const tx = st.px + TowerRules.DX[d], ty = st.py + TowerRules.DY[d], ti = ty * st.w + tx;
        if (tx < 0 || ty < 0 || tx >= st.w || ty >= st.h || st.blockAt[ti] || st.carAt[ti] || st.wall[ti] || st.goal[ti] || st.recv[ti] || st.vent[ti] >= 0 || st.sw[ti] || st.radio[ti] || (st.door[ti] && TowerRules.shut(st, ti)) || st.guards.some(g => g.alive && g.x === tx && g.y === ty)) d = -1;
      }
      if (d >= 0) doMove(d);
    }
    if (G.mode === 'play' && G.timeLeft <= 0) { G.timeLeft = 0; loseLevel('boom'); }
  }
  if (G.mode === 'won') {
    G.endT += dt;
    if (G.goalHit === 'lift') { G.liftIn = easeInOut(Math.min(1, G.endT / .4)); h.walk += dt * 4; h.moving = G.endT < .4 ? 1 : 0; if (G.endT > .55 && !G.dinged) { G.dinged = true; Snd.ding(); } }
    else h.lift = Math.abs(Math.sin(Math.min(G.endT, .9) / .9 * Math.PI * 2)) * .16;
    if (!G.panelShown && G.endT > 1.05) { G.panelShown = true; showResult(); }
  } else if (G.mode === 'lost') {
    G.endT += dt;
    if (!G.panelShown && G.endT > 1.1) { G.panelShown = true; showResult(); }
  }
  G.alarm = G.mode === 'lost' && G.loseKind !== 'boom' ? 1 : Math.max(0, G.alarm - dt);
}

/* ---------- sprites that only Tower needs ---------- */
function towerSprites() {
  const key = G.themeIdx + ':' + V.s;
  if (V.towerKey === key) return;
  V.towerKey = key;
  const s = V.s, rnd = mulberry32(777 + G.themeIdx);
  V.glassS = []; for (let i = 0; i < 4; i++) { const cvs = mkCanvas(s, s); paintGlass(cvs.getContext('2d'), s, rnd); V.glassS.push(cvs); }
  V.crateS = []; for (let i = 0; i < 6; i++) { const cvs = mkCanvas(s, s + V.hh); paintWall(cvs.getContext('2d'), s, V.hh, G.theme.wall, rnd); V.crateS.push(cvs); }
  V.colS = mkCanvas(s, s + V.hh); paintColumn(V.colS.getContext('2d'), s, V.hh, G.theme);
  V.carS = {};
}

function carSprite(h, col) {
  const k = h + ':' + col;
  if (!V.carS[k]) { const s = V.s, cvs = h ? mkCanvas(s * 2, s + V.hh) : mkCanvas(s, s * 2 + V.hh); paintCar(cvs.getContext('2d'), s, V.hh, h, CAR_COLS[col], mulberry32(col)); V.carS[k] = cvs; }
  return V.carS[k];
}
const LIFT_H = .62; // the lift's front, as a part of a cell

/* ---------- render ---------- */
const items = [];
function render() {
  const st = G.st; if (!st || !V.back) return;
  towerSprites();
  const { cw, ch, s, hh, ox, oy, C, R } = V, c = ctx, h = G.hero, t = G.clock;
  c.setTransform(1, 0, 0, 1, 0, 0);
  let shx = 0, shy = 0;
  if (G.shake > 0 && !REDUCE) { const m = G.shake * G.shake * s * .3; shx = (Math.random() - .5) * m; shy = (Math.random() - .5) * m; }
  c.fillStyle = G.theme.bg2; c.fillRect(0, 0, cw, ch);
  c.save(); c.translate(shx, shy);
  c.drawImage(V.back, 0, 0);
  c.save(); c.beginPath(); c.rect(ox, oy - hh, C * s, R * s + hh); c.clip();
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) c.drawImage(V.floors[(hash2(x, y, G.idx + 11) * 8) | 0], ox + x * s, oy + y * s);
  if (G.theme.line) { // painted parking bays in the garage
    c.strokeStyle = hexA(G.theme.line, .35); c.lineWidth = Math.max(1, s * .04);
    for (let x = 2; x < C; x += 3) { c.beginPath(); c.moveTo(ox + x * s, oy + s * .1); c.lineTo(ox + x * s, oy + s * 1.4); c.moveTo(ox + x * s, oy + R * s - s * 1.4); c.lineTo(ox + x * s, oy + R * s - s * .1); c.stroke(); }
  }
  let sg = c.createLinearGradient(0, oy, 0, oy + s * .45);
  sg.addColorStop(0, 'rgba(0,0,0,.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg; c.fillRect(ox, oy, C * s, s * .45);
  // glass, shadows, switches and vents on the floor
  for (let i = 0; i < st.glass.length; i++) if (st.glass[i]) { const x = i % st.w, y = (i - x) / st.w; c.drawImage(V.glassS[(x * 3 + y) % 4], ox + x * s, oy + y * s); }
  for (let i = 0; i < st.shadow.length; i++) if (st.shadow[i]) { const x = i % st.w, y = (i - x) / st.w; drawShadowPatch(c, ox + x * s, oy + y * s, s); }
  for (let i = 0; i < st.sw.length; i++) if (st.sw[i]) { const x = i % st.w, y = (i - x) / st.w; drawSwitch(c, ox + x * s, oy + y * s, s, st.sw[i], st.sw[i] === 1 ? st.power : st.lit, t); }
  const prs = TowerRules.pressed(st);
  for (const i of st.plates) { const x = i % st.w, y = (i - x) / st.w; drawPlate(c, ox + x * s, oy + y * s, s, prs, t); }
  for (let i = 0; i < st.door.length; i++) if (st.door[i] && !TowerRules.shut(st, i)) { const x = i % st.w, y = (i - x) / st.w; drawDoorOpen(c, ox + x * s, oy + y * s, s); }
  G.L.ventPairs.forEach((v, k) => { drawVent(c, ox + v[0] * s, oy + v[1] * s, s, k); drawVent(c, ox + v[2] * s, oy + v[3] * s, s, k); });
  // what the guards can see: lit floor, brightest close to him, so danger reads at a glance
  const seen = new Set(), caughtNow = G.mode === 'lost' && G.loseKind === 'caught';
  st.guards.forEach((g, k) => {
    if (!g.alive) return;
    const cells = TowerRules.sight(st, g);
    for (let j = 0; j < cells.length; j += 2) {
      const ci = cells[j], kk = cells[j + 1];
      if (st.shadow[ci]) continue; // the torch does not reach into the shadows
      seen.add(ci);
      const x = ci % st.w, y = (ci - x) / st.w, a = kk === 0 ? .42 : .5, col = caughtNow ? '255,70,60,' : '255,220,120,';
      c.fillStyle = 'rgba(' + col + a + ')';
      rr(c, ox + x * s + s * .05, oy + y * s + s * .05, s * .9, s * .9, s * .12); c.fill();
      c.strokeStyle = 'rgba(' + col + (a + .25) + ')'; c.lineWidth = Math.max(1, s * .02); c.stroke();
    }
  });
  if (G.mode === 'play' || G.mode === 'intro' || G.mode === 'title') st.guards.forEach(g => drawGuardPlan(c, ox, oy, s, g, t, .9));
  // laser beams also mark the floor, so it is clear which squares are live
  st.lasers.forEach(l => {
    const on = TowerRules.laserOn(st, l), green = l.c === 'g', fc = l.on ? '60,150,255,' : '255,50,60,';
    if (green) return; // green light is harmless: no warning on the floor
    TowerRules.beam(st, l).forEach(ci => {
      const x = ci % st.w, y = (ci - x) / st.w;
      if (on) { c.fillStyle = 'rgba(' + fc + (.16 + .05 * Math.sin(t * 9)) + ')'; c.fillRect(ox + x * s + 1, oy + y * s + 1, s - 2, s - 2); }
      else { c.strokeStyle = 'rgba(' + fc + '.45)'; c.setLineDash([s * .08, s * .08]); c.lineWidth = Math.max(1, s * .02); c.strokeRect(ox + x * s + s * .08, oy + y * s + s * .08, s * .84, s * .84); c.setLineDash([]); }
    });
  });
  // collect drawables
  items.length = 0;
  st.blocks.forEach((b, i) => {
    const p = blockDrawn(i), v = G.bv[i];
    let px = ox + p[0] * s; const py = oy + p[1] * s;
    if (v.shake > 0) px += Math.sin(v.shake * 20) * v.shake * s * .04;
    c.drawImage(V.shadow, px - V.shPad + s * .13, py - V.shPad + s * .13);
    items.push({ y: p[1], k: 0, x: px, py, v: v.v, m: b.m });
  });
  for (let i = 0; i < st.door.length; i++) if (st.door[i] && TowerRules.shut(st, i)) { const x = i % st.w, y = (i - x) / st.w; items.push({ y, k: 9, x: ox + x * s, py: oy + y * s }); }
  for (let i = 0; i < st.radio.length; i++) if (st.radio[i]) { const x = i % st.w, y = (i - x) / st.w; c.drawImage(V.shadow, ox + x * s - V.shPad + s * .1, oy + y * s - V.shPad + s * .1); items.push({ y, k: 10, x: ox + x * s, py: oy + y * s, i }); }
  for (let i = 0; i < st.recv.length; i++) if (st.recv[i]) { const x = i % st.w, y = (i - x) / st.w; items.push({ y, k: 8, x: ox + x * s, py: oy + y * s, i }); }
  st.cars.forEach((cr, i) => {
    const p = carDrawn(i), v = G.cv[i];
    let px = ox + p[0] * s, py = oy + p[1] * s;
    if (v.shake > 0) { const m = Math.sin(v.shake * 20) * v.shake * s * .04; if (cr.h) py += m * .5; else px += m * .5; }
    c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, px + s * .1, py + s * .16, cr.h ? s * 1.9 : s * .9, cr.h ? s * .9 : s * 1.9, s * .2); c.fill();
    items.push({ y: p[1] + (cr.h ? 0 : 1), k: 6, x: px, py, h: cr.h, col: v.col });
  });
  for (let i = 0; i < st.wall.length; i++) if (st.wall[i]) {
    const x = i % st.w, y = (i - x) / st.w, px = ox + x * s, py = oy + y * s;
    c.drawImage(V.shadow, px - V.shPad + s * .15, py - V.shPad + s * .15);
    items.push({ y, k: 3, x: px, py });
  }
  for (let i = 0; i < st.fuse.length; i++) if (st.fuse[i]) { const x = i % st.w, y = (i - x) / st.w; items.push({ y: y + .01, k: 5, x: ox + (x + .5) * s, py: oy + (y + .5) * s }); }
  const urg = clamp(1 - G.timeLeft / Math.min(G.time, 10), 0, 1);
  for (let i = 0; i < st.goal.length; i++) if (st.goal[i]) {
    const x = i % st.w, y = (i - x) / st.w;
    if (st.goal[i] === 2) {
      if (G.mode === 'lost' && G.loseKind === 'boom') continue;
      items.push({ y: y + .01, k: 1, x: ox + (x + .5) * s, py: oy + (y + .44) * s, v: G.mode === 'won' && G.goalHit === 'bomb' ? 1 : 0 });
    } else items.push({ y, k: 7, x: ox + x * s, py: oy + y * s, i });
  }
  st.guards.forEach((g, i) => { const p = guardDrawn(i); items.push({ y: p[1] + .01, k: 4, x: ox + (p[0] + .5) * s, py: oy + (p[1] + .43) * s, g: i }); });
  const hp = heroDrawn();
  let hx = hp[0], hy = hp[1], hyOff = 0, alpha = h.alpha;
  if (G.mode === 'intro') { const k = clamp(G.introT / .7, 0, 1); hyOff = -(1 - k * k) * 2.2; alpha = clamp(k * 3, 0, 1); h.sy = k > .92 ? .86 : 1; }
  else h.sy = lerp(h.sy, 1, .2);
  if (G.mode === 'title') alpha = 1;
  const riding = G.mode === 'won' && G.goalHit === 'lift';
  const heroIt = { y: hy + .02, k: 2, x: ox + (hx + .5) * s, py: oy + (hy + .43 + hyOff) * s, a: alpha };
  if (!riding) items.push(heroIt);
  items.sort((a, b) => a.y - b.y);
  const H = s * LIFT_H;
  const recvLit = new Set(); st.lasers.forEach(l => { if (l.c === 'g' && TowerRules.laserOn(st, l)) { const b = TowerRules.beam(st, l); if (b.hit >= 0) recvLit.add(b.hit); } });
  const liftOk = TowerRules.liftWorks(st);
  for (const it of items) {
    if (it.k === 0) { c.drawImage(V.crateS[it.v], Math.round(it.x), Math.round(it.py - hh)); if (it.m) drawMirror(c, it.x, it.py, s, hh, it.m); }
    else if (it.k === 8) drawReceiver(c, it.x, it.py, s, hh, recvLit.has(it.i), t);
    else if (it.k === 9) drawDoorShut(c, it.x, it.py, s, hh, t);
    else if (it.k === 10) drawRadio(c, it.x, it.py, s, hh, !!(G.radioOn && G.radioOn[it.i]), t);
    else if (it.k === 3) c.drawImage(V.colS, Math.round(it.x), Math.round(it.py - hh));
    else if (it.k === 6) c.drawImage(carSprite(it.h, it.col), Math.round(it.x), Math.round(it.py - hh));
    else if (it.k === 1) drawBomb(c, it.x, it.py, s, t, urg, it.v);
    else if (it.k === 5) drawFuseCoil(c, it.x, it.py, s, t);
    else if (it.k === 4) { const g = st.guards[it.g], v = G.gv[it.g]; drawGuard(c, it.x, it.py, s, { face: g.face, walk: v.walk, moving: v.moving, ko: g.alive ? 0 : Math.max(v.ko, 1), alert: v.alert, t }); }
    else if (it.k === 7) {
      // the lift opens when you are right in front of it, and you ride it up when you step in
      const lx = it.i % st.w, near = Math.abs(hx - lx) + Math.abs(hy - 1);
      let want = !liftOk ? 0 : near < .1 ? 1 : near <= 1.05 ? .35 : 0;
      const here = riding && Math.abs(hx - lx) < .5;
      if (here) want = G.endT < .5 ? 1 : 0;
      const cur = G.liftOpen[it.i] || 0;
      const o = G.liftOpen[it.i] = cur + (want - cur) * .22;
      const inside = here ? () => {
        const k = G.liftIn || 0;
        drawHero(c, it.x + s / 2, lerp(oy + (1.43) * s, it.py + s - H * .55, k), s * (1 - .2 * k), { dir: k < .95 ? 0 : 1, walk: h.walk, moving: h.moving, push: 0, sx: 1, sy: 1, lift: 0, alpha: 1 });
      } : null;
      drawLift(c, it.x, it.py, s, H, o, t, here && G.endT > .6, inside, !liftOk);
    }
    else if (it.a > 0.01) drawHero(c, it.x, it.py, s, { dir: h.dir, walk: h.walk, moving: h.moving, push: h.push, sx: 1, sy: h.sy * (1 + Math.sin(t * 3) * .012 * (1 - h.moving)), lift: h.lift, alpha: it.a * (st.shadow[st.py * st.w + st.px] && h.t >= 1 ? .45 : 1) });
  }
  // darkness: a dark floor once the fuse is lit (until the lights go on), or any floor with the power cut
  const dark = G.mode !== 'title' && ((st.dark && !st.lit && G.lit) || (st.hasPower && !st.power));
  if (dark || G.lightsT > 0) {
    if (!V.darkC || V.darkC.width !== cw || V.darkC.height !== ch) { V.darkC = mkCanvas(cw, ch); }
    const dc = V.darkC.getContext('2d');
    dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, cw, ch);
    dc.fillStyle = 'rgba(2,3,6,' + (dark ? .95 : .95 * G.lightsT) + ')'; dc.fillRect(0, 0, cw, ch);
    dc.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { const g = dc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(.55, 'rgba(0,0,0,' + a * .8 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = g; dc.fillRect(x - r, y - r, r * 2, r * 2); };
    hole(ox + (hx + .5) * s , oy + (hy + .45) * s, s * 1.9, 1);
    // guards carry torches: you see them, and what they light
    st.guards.forEach((g, k) => { if (!g.alive) return; const p = guardDrawn(k); hole(ox + (p[0] + .5) * s, oy + (p[1] + .4) * s, s * .9, .9); const sc = TowerRules.sight(st, g); for (let j = 0; j < sc.length; j += 2) { const ci = sc[j], x = ci % st.w, y = (ci - x) / st.w; hole(ox + (x + .5) * s, oy + (y + .5) * s, s * .7, .7); } });
    // switches glow so you can find them again
    for (let i = 0; i < st.sw.length; i++) if (st.sw[i]) { const x = i % st.w, y = (i - x) / st.w; hole(ox + (x + .5) * s, oy + (y + .5) * s, s * .6, .7); }
    for (let i = 0; i < st.goal.length; i++) if (st.goal[i]) { const x = i % st.w, y = (i - x) / st.w; hole(ox + (x + .5) * s, oy + (y + .2) * s, s * .55, .5); }
    c.restore(); c.save(); c.drawImage(V.darkC, 0, 0);
  }
  // laser beams at waist height, turning at mirrors
  c.globalCompositeOperation = 'lighter';
  st.lasers.forEach(l => {
    const on = TowerRules.laserOn(st, l), green = l.c === 'g';
    const nextOn = l.on ? TowerRules.laserOn(st, l, st.n + 1) : on;
    const dx = TowerRules.DX[l.d], dy = TowerRules.DY[l.d], lift = hh * .55;
    const x0 = ox + (l.x + .5 + dx * .5) * s, y0 = oy + (l.y + .5 + dy * .5) * s - lift;
    // the emitter: a lamp that shows whether it will fire after your next step
    const col = green ? '80,255,150' : l.on ? '80,160,255' : '255,70,70';
    c.fillStyle = 'rgba(' + col + ',' + (on ? .95 : .25) + ')'; ell(c, x0, y0, s * .07, s * .07); c.fill();
    if (l.on) { c.strokeStyle = 'rgba(' + col + ',' + (nextOn ? .9 : .25) + ')'; c.lineWidth = Math.max(1.5, s * .03); ell(c, x0, y0, s * .13, s * .13); c.stroke(); }
    if (!on) return;
    const b = TowerRules.beam(st, l), pts = [[x0, y0]];
    let d = l.d, lx = l.x, ly = l.y;
    for (let j = 0; j < b.turns.length; j += 3) { const ci = b.turns[j], x = ci % st.w, y = (ci - x) / st.w; pts.push([ox + (x + .5) * s, oy + (y + .5) * s - lift]); d = b.turns[j + 2]; lx = x; ly = y; }
    // end: the far edge of the last open cell
    let ex, ey;
    if (b.length) { const ci = b[b.length - 1], x = ci % st.w, y = (ci - x) / st.w; ex = ox + (x + .5 + TowerRules.DX[d] * .5) * s; ey = oy + (y + .5 + TowerRules.DY[d] * .5) * s - lift; }
    else { ex = x0; ey = y0; }
    if (b.hit >= 0) { const x = b.hit % st.w, y = (b.hit - x) / st.w; ex = ox + (x + .5) * s; ey = oy + (y + .5) * s - lift; } // straight into the lens
    pts.push([ex, ey]);
    const fl = .75 + .25 * Math.sin(t * 40 + l.x);
    const line = (w, a) => { c.strokeStyle = 'rgba(' + (green ? '60,255,140,' : l.on ? '60,140,255,' : '255,40,50,') + a * fl + ')'; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, j) => j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); };
    line(s * .16, .35); line(Math.max(1.5, s * .035), .9);
    if (b.length || b.hit >= 0) { const g = c.createRadialGradient(ex, ey, 0, ex, ey, s * .2); g.addColorStop(0, 'rgba(' + (green ? '120,255,170' : l.on ? '130,190,255' : '255,120,110') + ',.8)'); g.addColorStop(1, 'rgba(255,60,60,0)'); c.fillStyle = g; ell(c, ex, ey, s * .2, s * .2); c.fill(); }
  });
  c.globalCompositeOperation = 'source-over';
  c.restore();
  c.drawImage(V.front, 0, 0);

  // light map
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
  if (alpha > 0.01) L(ox + (hx + .5) * s, oy + (hy + .4 + hyOff * .3) * s, s * 4.2, '255,236,200', .9 * alpha);
  for (const ci of seen) { const x = ci % st.w, y = (ci - x) / st.w; L(ox + (x + .5) * s, oy + (y + .5) * s, s * 1.3, '255,235,180', .5); }
  st.guards.forEach(g => { if (g.alive) L(ox + (g.x + .5) * s, oy + (g.y + .5) * s, s * 1.6, '255,235,180', .45); });
  st.lasers.forEach(l => { const cells = TowerRules.beam(st, l); cells.forEach((ci, j) => { if (j % 2) return; const x = ci % st.w, y = (ci - x) / st.w; L(ox + (x + .5) * s, oy + (y + .2) * s, s * 1.2, '255,60,60', .35); }); });
  for (let i = 0; i < st.goal.length; i++) if (st.goal[i]) { const x = i % st.w, y = (i - x) / st.w; if (st.goal[i] === 1) { L(ox + (x + .5) * s, oy + (y + 1) * s, s * 2, '255,225,170', .5 + .4 * (G.liftOpen[i] || 0)); L(ox + (x + .5) * s, oy + y * s - s * .2, s * 1.3, '90,255,160', .45); } else L(ox + (x + .5) * s, oy + (y + .5) * s, s * 2.4, '255,80,50', .45 + .15 * Math.sin(t * 4)); }
  for (let i = 0; i < st.fuse.length; i++) if (st.fuse[i]) { const x = i % st.w, y = (i - x) / st.w; L(ox + (x + .5) * s, oy + (y + .5) * s, s * 1.8, '255,190,80', .5); }
  if (G.alarm > 0) L(cw / 2, ch / 2, Math.max(cw, ch), '255,40,40', .35 * G.alarm * (.5 + .5 * Math.sin(t * 14)));
  if (G.flash > 0) L(cw / 2, ch / 2, Math.max(cw, ch), '255,220,170', G.flash);
  for (let i = 0, n = 0; i < G.particles.length && n < 14; i++) { const p = G.particles[i]; if (p.add && p.size > .25) { n++; L(ox + p.x * s, oy + p.y * s, s * p.size * 4, p.col, .35 * (1 - p.life / p.max)); } }
  c.globalCompositeOperation = 'multiply';
  c.drawImage(V.light, 0, 0, cw, ch);
  c.globalCompositeOperation = 'source-over';
  // motes and particles
  const mg = glow(G.theme.mote.c);
  c.globalCompositeOperation = 'lighter';
  for (const m of G.motes) {
    const tt = t * m.sp, mx = m.x + Math.sin(tt * .4 + m.ph) * .5, my = m.y + Math.cos(tt * .3 + m.ph) * .4, sz = s * .09 * m.sz;
    c.globalAlpha = clamp(.1 + .1 * Math.sin(tt + m.ph), 0, 1);
    c.drawImage(mg, ox + mx * s - sz, oy + my * s - sz, sz * 2, sz * 2);
  }
  c.globalAlpha = 1;
  for (let i = 0; i < G.particles.length; i++) {
    const p = G.particles[i], tt = p.life / p.max, px = ox + p.x * s, py = oy + p.y * s, sz = p.size * s;
    if (p.type === 'ring') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - tt) * .8; c.strokeStyle = 'rgb(' + p.col + ')'; c.lineWidth = s * .12 * (1 - tt) + 1; c.beginPath(); c.arc(px, py, sz, 0, TAU); c.stroke(); }
    else if (p.type === 'spark') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - tt; c.strokeStyle = 'rgb(' + p.col + ')'; c.lineWidth = Math.max(1, sz * .25); c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py); c.lineTo(px - p.vx * s * .04, py - p.vy * s * .04); c.stroke(); }
    else if (p.type === 'smoke') { c.globalCompositeOperation = 'source-over'; c.globalAlpha = (1 - tt) * .45; c.fillStyle = 'rgb(' + p.col + ')'; c.beginPath(); c.arc(px, py, sz, 0, TAU); c.fill(); }
    else { c.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; c.globalAlpha = 1 - tt * tt; c.drawImage(glow(p.col), px - sz, py - sz, sz * 2, sz * 2); }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.restore();
  if (G.flash > 0) { c.fillStyle = 'rgba(255,235,200,' + (G.flash * (REDUCE ? .25 : .7)) + ')'; c.fillRect(0, 0, cw, ch); }
}

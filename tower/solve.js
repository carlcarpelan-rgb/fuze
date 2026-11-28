// Fuze Tower solvers.
//   solve(lv, {budget, cap})  exact, step by step (guards move with every step). Cost is fuse time.
//   quick(lv, {cap, frozen})  for floors without guards, lasers or spare fuses: only pushes change the floor,
//                             so it searches push to push with the walk between them as the cost. Same answer, much faster.
// Time is counted in tenths of a second: a step is 3 (a quick player), a step on glass 3 + 30.
//   node tower/solve.js        -> solves tower/levels/levels.json, writes solutions.json, prints a report
const fs = require('fs'), path = require('path');
const R = require('./src/rules.js');
const STEP = 3, GLASS = R.GLASS_COST * 10;
const DC = 'UDLR';

/* ---------- exact step solver: Dijkstra with a bucket queue ---------- */
function solve(lv, opts) {
  opts = opts || {};
  const L = typeof lv.m === 'string' ? R.parseLevel(lv) : lv, st0 = R.makeState(L);
  const budget = (opts.budget || 1e6) * 10, cap = opts.cap || 600000;
  const best = new Map([[R.key(st0), 0]]);
  const buckets = [[{ st: st0, t: 0, since: 0, par: null, d: -1, r: null }]];
  let f = 0, pops = 0;
  for (;;) {
    while (f < buckets.length && !(buckets[f] && buckets[f].length)) f++;
    if (f >= buckets.length) return null;
    const nd = buckets[f].pop();
    if (++pops > cap) return { overflow: true, explored: pops };
    const s0 = nd.st;
    for (let d = 0; d < 4; d++) {
      const tx = s0.px + R.DX[d], ty = s0.py + R.DY[d];
      if (tx < 0 || ty < 0 || tx >= s0.w || ty >= s0.h) continue;
      const ti = ty * s0.w + tx;
      if (s0.wall[ti] || (s0.goal[ti] === 1 && d !== 0)) continue;
      const st = R.clone(s0), r = R.step(st, d);
      if (r.t === 'blocked' || r.t === 'caught') continue;
      const dt = STEP + (r.cost ? GLASS : 0);
      let since = nd.since + dt;
      if (since > budget) continue;
      if (r.refill) since = 0;
      const n = { st, t: nd.t + dt, since, par: nd, d, r };
      if (r.t === 'win') return report(n, pops);
      const k = R.key(st);
      const o = best.get(k);
      if (o !== undefined && o <= n.t) continue;
      best.set(k, n.t);
      (buckets[n.t] || (buckets[n.t] = [])).push(n);
    }
  }
}
function report(n, pops) {
  const steps = []; let pushes = 0, glass = 0, takedowns = 0, refills = 0, crushed = 0, maxSince = 0, since = 0, carPush = 0, crates = new Set(), cars = new Set();
  for (let m = n; m.par; m = m.par) steps.push(m);
  steps.reverse();
  const seq = [];
  for (const m of steps) {
    if (m.r.t === 'push') seq.push(m.r.car != null ? 'c' + m.r.car : 'b' + m.r.block);
    if (m.r.t === 'push' || (m.r.t === 'win' && (m.r.block != null || m.r.car != null))) { pushes++; if (m.r.car != null) { carPush++; cars.add(m.r.car); } else crates.add(m.r.block); }
    if (m.r.t === 'takedown') takedowns++;
    if (m.r.cost) glass++;
    if (m.r.crushed) crushed++;
    since += STEP + (m.r.cost ? GLASS : 0); maxSince = Math.max(maxSince, since);
    if (m.r.refill) { refills++; since = 0; }
  }
  return { moves: steps.map(m => DC[m.d]).join(''), seq, steps: steps.length, time: n.t / 10, pushes, carPush, distinct: crates.size + cars.size, glass, crushed, takedowns, refills, maxSince: maxSince / 10, explored: pops };
}

/* ---------- push-to-push solver for floors without anything that moves on its own ---------- */
function quick(lv, opts) {
  opts = opts || {};
  const L = typeof lv.m === 'string' ? R.parseLevel(lv) : lv;
  const w = L.w, h = L.h, N = w * h, cap = opts.cap || 200000;
  const st0 = R.makeState(L);
  if (st0.guards.length || st0.lasers.length || L.fuses.length) throw new Error('quick() cannot handle guards, lasers or spare fuses');
  const nb = new Int16Array(N * 4);
  for (let i = 0; i < N; i++) { const x = i % w, y = (i - x) / w; for (let d = 0; d < 4; d++) { const nx = x + R.DX[d], ny = y + R.DY[d]; nb[i * 4 + d] = (nx < 0 || ny < 0 || nx >= w || ny >= h) ? -1 : ny * w + nx; } }
  const dist = new Int32Array(N), prevD = new Int8Array(N), heapA = [];
  // walking distances from p over floor (glass costs more)
  const q = new Int32Array(N);
  function walk(st, p, anyGlass) {
    dist.fill(1 << 29); dist[p] = 0; prevD[p] = -1;
    if (!anyGlass) { // plain breadth-first
      let head = 0, tail = 0; q[tail++] = p;
      while (head < tail) {
        const c = q[head++], dc = dist[c] + STEP;
        for (let d = 0; d < 4; d++) {
          const ni = nb[c * 4 + d]; if (ni < 0 || dist[ni] !== 1 << 29) continue;
          if (st.wall[ni] || st.blockAt[ni] || st.carAt[ni] || st.goal[ni]) continue;
          dist[ni] = dc; prevD[ni] = d; q[tail++] = ni;
        }
      }
      return;
    }
    const B = [[p]]; let f = 0, live = 1;
    while (live) {
      const bk = B[f]; if (!bk || !bk.length) { f++; continue; }
      const c = bk.pop(); live--;
      if (dist[c] !== f) continue;
      for (let d = 0; d < 4; d++) {
        const ni = nb[c * 4 + d]; if (ni < 0) continue;
        if (st.wall[ni] || st.blockAt[ni] || st.carAt[ni] || st.goal[ni]) continue;
        const nd = f + STEP + (st.glass[ni] ? GLASS : 0);
        if (nd < dist[ni]) { dist[ni] = nd; prevD[ni] = d; (B[nd] || (B[nd] = [])).push(ni); live++; }
      }
    }
  }
  // would a push from c in direction d move something? (cheap check before copying the state)
  const freeAt = (st, i) => i >= 0 && !(st.wall[i] || st.blockAt[i] || st.carAt[i] || st.goal[i] || st.fuse[i]);
  function canPush(st, ni, d) {
    if (st.blockAt[ni]) return freeAt(st, nb[ni * 4 + d]);
    const car = st.cars[st.carAt[ni] - 1];
    if (car.h !== (d >= 2 ? 1 : 0)) return false;
    const other = car.y * w + car.x === ni ? (car.h ? ni + 1 : ni + w) : (car.h ? ni - 1 : ni - w);
    const front = (nb[ni * 4 + d] === other) ? nb[other * 4 + d] : nb[ni * 4 + d];
    return freeAt(st, front);
  }
  function path(st, p, to) { // moves from p to `to`, using the last walk()
    let s = ''; for (let c = to; c !== p; ) { const d = prevD[c]; s = DC[d] + s; c = nb[c * 4 + (d ^ 1)]; } return s;
  }
  const key = st => { let s = String.fromCharCode(48 + st.px + st.py * w); for (const b of st.blocks) s += String.fromCharCode(48 + b.x + b.y * w); s += '|'; for (const c of st.cars) s += String.fromCharCode(48 + c.x + c.y * w); for (let i = 0; i < N; i++) if (st.glass[i]) s += String.fromCharCode(200 + i); return s; };
  const NONE = [];
  const lean = (st, g) => ({ w, h, px: st.px, py: st.py, blockAt: st.blocks.length ? st.blockAt.slice() : st.blockAt, carAt: st.cars.length ? st.carAt.slice() : st.carAt,
    wall: st.wall, glass: g ? st.glass.slice() : st.glass, fuse: st.fuse, goal: st.goal,
    recv: st.recv, sw: st.sw, shadow: st.shadow, vent: st.vent, n: 0, power: 1, lit: 1, hasPower: false, hasRecv: false,
    blocks: st.blocks.map(b => ({ x: b.x, y: b.y, m: b.m })), cars: st.cars.map(c => ({ x: c.x, y: c.y, h: c.h })), guards: NONE, lasers: NONE });
  const frozen = opts.frozen; // 'all' -> nothing may be pushed (is the floor solvable by walking?)
  const root = { st: st0, t: 0, par: null, moves: '', push: null };
  const best = new Map([[key(st0), 0]]);
  const buckets = [[root]];
  let f = 0, pops = 0;
  for (;;) {
    while (f < buckets.length && !(buckets[f] && buckets[f].length)) f++;
    if (f >= buckets.length) return null;
    const nd = buckets[f].pop();
    if (best.get(key(nd.st)) < nd.t) continue;
    if (nd.win) return quickReport(nd, pops);
    if (++pops > cap) return { overflow: true, explored: pops };
    const st = nd.st, p = st.py * w + st.px;
    let anyGlass = false; for (let i = 0; i < N; i++) if (st.glass[i]) { anyGlass = true; break; }
    walk(st, p, anyGlass);
    const reach = [];
    for (let c = 0; c < N; c++) if (dist[c] < 1 << 29) reach.push(c);
    for (const c of reach) {
      for (let d = 0; d < 4; d++) {
        const ni = nb[c * 4 + d]; if (ni < 0) continue;
        const isGoal = st.goal[ni] && (st.goal[ni] === 2 || d === 0);
        const pushable = st.blockAt[ni] || st.carAt[ni];
        if (!isGoal && (!pushable || frozen || !canPush(st, ni, d))) continue;
        const s2 = lean(st, anyGlass); s2.px = c % w; s2.py = (c - s2.px) / w;
        const r = R.step(s2, d);
        if (r.t === 'blocked') continue;
        const t = nd.t + dist[c] + STEP;
        const n = { st: s2, t, par: nd, moves: path(st, p, c) + DC[d], r, win: r.t === 'win' };
        if (n.win) { (buckets[t] || (buckets[t] = [])).push(n); continue; }
        const k = key(s2), o = best.get(k);
        if (o !== undefined && o <= t) continue;
        best.set(k, t); (buckets[t] || (buckets[t] = [])).push(n);
      }
    }
  }
}
function quickReport(n, pops) {
  const chain = []; for (let m = n; m.par; m = m.par) chain.push(m); chain.reverse();
  let moves = '', pushes = 0, carPush = 0, crushed = 0; const crates = new Set(), cars = new Set();
  const seq = [];
  for (const m of chain) { moves += m.moves; if (m.r.t === 'push') { pushes++; if (m.r.car != null) { carPush++; cars.add(m.r.car); seq.push('c' + m.r.car); } else { crates.add(m.r.block); seq.push('b' + m.r.block); } } if (m.r.crushed) crushed++; }
  // glass walked on, counted from the time
  const glass = Math.round((n.t - moves.length * STEP) / GLASS);
  return { moves, seq, steps: moves.length, time: n.t / 10, pushes, carPush, distinct: crates.size + cars.size, glass, crushed, takedowns: 0, refills: 0, maxSince: n.t / 10, explored: pops };
}
// anything beyond crates, cars and glass needs the step-by-step search
const hasMovers = lv => (lv.guards && lv.guards.length) || (lv.lasers && lv.lasers.length) || (lv.vents && lv.vents.length) || /[FqpRPLsV]/.test(lv.m);
function best(lv, opts) { return hasMovers(lv) ? solve(lv, opts) : quick(lv, opts); }

module.exports = { solve, quick, best, STEP, GLASS };

if (require.main === module) {
  const file = path.join(__dirname, 'levels/levels.json');
  const levels = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sols = [];
  levels.forEach((lv, i) => {
    const r = best(lv, { budget: lv.t });
    if (!r || r.overflow) { console.log(`${i + 1} ${lv.name}: ${r ? 'too big' : 'UNSOLVABLE'}`); sols.push(''); return; }
    sols.push(r.moves);
    console.log(`${String(i + 1).padStart(2)} ${lv.name.padEnd(18)} steps=${r.steps} time=${r.time}s pushes=${r.pushes} glass=${r.glass} crushed=${r.crushed} takedowns=${r.takedowns} refills=${r.refills} fuse=${lv.t}`);
  });
  fs.writeFileSync(path.join(__dirname, 'levels/solutions.json'), JSON.stringify(sols));
}

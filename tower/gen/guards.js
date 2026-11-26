'use strict';
// Lobby floors: guards with torches (Hitman GO style). Everything moves only when you move.
//   post    a guard standing still, facing one way
//   turner  a guard standing still, turning through a short list of directions
//   patrol  walks a straight line back and forth (turning around costs him a step)
// Crates hide you and stop a patrol (he turns around at them). Walk into a guard's back to knock him out.
const { mulberry32, occupancy, encode, climb, S } = require('./common.js');
const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];

function randGuard(p, rand, o) {
  const kinds = o.kinds || ['post', 'turner', 'patrol'];
  const kind = kinds[Math.floor(rand() * kinds.length)];
  const x = Math.floor(rand() * p.w), y = 1 + Math.floor(rand() * (p.h - 3));
  if (kind === 'post') return { path: [[x, y]], face: Math.floor(rand() * 4) };
  if (kind === 'turner') {
    const a = Math.floor(rand() * 4), pat = rand() < .5 ? [a, a ^ 1] : [a, a, a ^ 1, a ^ 1];
    if (rand() < .3) { const b = a < 2 ? 2 : 0; pat.splice(0, pat.length, a, b, a ^ 1, b ^ 1); }
    return { path: [[x, y]], look: pat };
  }
  const d = Math.floor(rand() * 4), len = 2 + Math.floor(rand() * (o.maxPatrol || 4));
  const path = []; for (let i = 0; i < len; i++) path.push([x + DX[d] * i, y + DY[d] * i]);
  return { path };
}
function init(rand, o) {
  const { w, h } = o, cell = new Uint8Array(w * h), cx = (w - 1) >> 1;
  const p = { w, h, cell, crates: [], cars: [], start: [o.sx != null ? o.sx : cx, h - 1], lift: [o.lx != null ? o.lx : cx, 0], bomb: null, guards: [] };
  if (o.bomb) { p.bomb = [cx, o.by || 1]; p.lift = null; }
  for (let i = 0; i < 40 && p.guards.length < o.guards; i++) { p.guards.push(randGuard(p, rand, o)); if (!occupancy(p)) p.guards.pop(); }
  for (let i = 0; i < 40 && p.crates.length < (o.crates || 0); i++) { p.crates.push([Math.floor(rand() * w), Math.floor(rand() * h)]); if (!occupancy(p)) p.crates.pop(); }
  for (let i = 0; i < (o.pillars || 0); i++) { const x = Math.floor(rand() * w), y = 1 + Math.floor(rand() * (h - 2)); cell[y * w + x] = 1; if (o.sym) cell[y * w + w - 1 - x] = 1; }
  return p;
}
function mutate(o) {
  return (p, rand) => {
    const r = rand() * 10;
    if (r < 2.2 && p.guards.length) { // move a guard
      const g = p.guards[Math.floor(rand() * p.guards.length)], dx = Math.floor(rand() * 3) - 1, dy = Math.floor(rand() * 3) - 1;
      g.path.forEach(q => { q[0] += dx; q[1] += dy; });
    } else if (r < 3.4 && p.guards.length) { // reshape a guard
      const g = p.guards[Math.floor(rand() * p.guards.length)];
      if (g.path.length > 1) {
        const a = g.path[0], b = g.path[1], d = [b[0] - a[0], b[1] - a[1]];
        if (rand() < .5 && g.path.length < (o.maxPatrol || 4) + 1) { const l = g.path[g.path.length - 1]; g.path.push([l[0] + d[0], l[1] + d[1]]); }
        else if (g.path.length > 2) g.path.pop();
        else g.path.reverse();
      } else if (g.look) { g.look = g.look.map(f => rand() < .3 ? Math.floor(rand() * 4) : f); }
      else g.face = Math.floor(rand() * 4);
    } else if (r < 4.2) { // swap a guard for a new one
      const ng = randGuard(p, rand, o);
      if (p.guards.length) p.guards[Math.floor(rand() * p.guards.length)] = ng; else p.guards.push(ng);
    } else if (r < 4.6 && p.guards.length < (o.maxGuards || o.guards)) p.guards.push(randGuard(p, rand, o));
    else if (r < 4.9 && p.guards.length > (o.minGuards || 1)) p.guards.splice(Math.floor(rand() * p.guards.length), 1);
    else if (r < 6.6 && o.maxCrates) { // crates
      if (p.crates.length && rand() < .6) { const c = p.crates[Math.floor(rand() * p.crates.length)]; c[0] += Math.floor(rand() * 3) - 1; c[1] += Math.floor(rand() * 3) - 1; }
      else if (p.crates.length < o.maxCrates && rand() < .6) p.crates.push([Math.floor(rand() * p.w), Math.floor(rand() * p.h)]);
      else if (p.crates.length > (o.minCrates || 0)) p.crates.splice(Math.floor(rand() * p.crates.length), 1);
    } else if (r < 8.4) { // pillars
      const x = Math.floor(rand() * p.w), y = 1 + Math.floor(rand() * (p.h - 2)), i = y * p.w + x, v = p.cell[i] === 1 ? 0 : 1;
      p.cell[i] = v; if (o.sym) p.cell[y * p.w + p.w - 1 - x] = v;
    } else if (r < 9.2 && !o.fixStart) p.start[0] = Math.floor(rand() * p.w);
    else if (p.lift && !o.fixLift) p.lift[0] = Math.floor(rand() * p.w);
  };
}
function scorer(o) {
  return p => {
    if (p.crates.some(c => c[0] < 0 || c[1] < 0 || c[0] >= p.w || c[1] >= p.h)) return { v: -Infinity };
    const lv = encode(p);
    // the floor without guards: the guards have to cost you something
    const free = encode(Object.assign({}, p, { guards: [] }));
    const r0 = S.quick(free, { cap: 4000 }) || S.solve(free, { cap: 4000 });
    if (!r0 || r0.overflow) return { v: -Infinity };
    const r = S.solve(lv, { cap: o.cap || 60000 });
    if (!r || r.overflow) return { v: -Infinity };
    // start must not be in sight already
    const st = require('../src/rules.js').makeState(require('../src/rules.js').parseLevel(lv));
    if (require('../src/rules.js').spotted(st)) return { v: -Infinity };
    const detour = r.steps - r0.steps;
    if (detour < (o.minDetour || 2) && !r.takedowns) return { v: -Infinity };
    let pill = 0; for (let i = 0; i < p.cell.length; i++) if (p.cell[i] === 1) pill++;
    // guards that never come into it are clutter: count those whose removal leaves the time unchanged (cheap proxy: far from the route)
    // every guard has to matter: without him the floor would be quicker (or he gets knocked out)
    let idle = 0;
    if (p.guards.length > 1) for (let k = 0; k < p.guards.length; k++) {
      const q = encode(Object.assign({}, p, { guards: p.guards.filter((_, j) => j !== k) }));
      const rk = S.solve(q, { cap: o.cap || 60000 });
      if (rk && !rk.overflow && rk.steps >= r.steps && !r.takedowns) idle++;
      else if (rk && !rk.overflow && rk.steps >= r.steps) { /* may be the one knocked out */ const t2 = rk.takedowns; if (t2 >= r.takedowns) idle++; }
    }
    const moving = p.guards.filter(g => g.path.length > 1 || (g.look && g.look.length > 1)).length;
    let v = detour * 1.6 + r.steps * .25 + r.takedowns * (o.takedown || 3) + Math.min(r.pushes, 6) * .8 - pill * .12 - p.crates.length * .5 - idle * 5;
    if (o.needMoving && moving < o.needMoving) v -= (o.needMoving - moving) * 7;
    if (o.maxMoving != null && moving > o.maxMoving) v -= (moving - o.maxMoving) * 9;
    // forgiving: block one square of the best route at a time; a good floor still has another way nearly as quick
    let alt = 0, tried = 0;
    { let x = p.start[0], y = p.start[1]; const seen = new Set();
      for (let i = 0; i < r.moves.length - 1; i++) {
        const d = 'UDLR'.indexOf(r.moves[i]); x += [0, 0, -1, 1][d]; y += [-1, 1, 0, 0][d];
        const ci = y * p.w + x; if (seen.has(ci) || p.cell[ci] !== 0 || p.crates.some(c => c[0] === x && c[1] === y) || p.guards.some(g => g.path.some(q => q[0] === x && q[1] === y))) continue;
        seen.add(ci); tried++;
        const q = Object.assign({}, p, { cell: p.cell.slice() }); q.cell[ci] = 1;
        const ra = S.solve(encode(q), { cap: 20000 });
        if (ra && !ra.overflow && ra.steps <= r.steps + (o.altSlack || 6)) alt++;
      } }
    const altFrac = tried ? alt / tried : 0;
    v += altFrac * (o.altWeight || 14);
    // stepping back and forth to wait for a guard is legal, but a floor built on it is dull
    let rev = 0; for (let i = 1; i < r.moves.length; i++) if ('UDLR'.indexOf(r.moves[i]) === ('UDLR'.indexOf(r.moves[i - 1]) ^ 1)) rev++;
    v -= rev * (o.revCost || 2.2);
    if (o.wantTakedown && !r.takedowns) v -= 8;
    if (o.wantPush && !r.pushes) v -= 8;
    if (o.maxSteps && r.steps > o.maxSteps) v -= (r.steps - o.maxSteps) * 1.5;
    return { v, r, r0, detour, rev, lv, seg: detour, used: p.guards.length, idle, alt: altFrac };
  };
}
function make(seed, o) {
  const rand = mulberry32(seed), sc = scorer(o);
  let p0 = init(rand, o), tries = 0;
  while (sc(p0).v === -Infinity && tries++ < 800) p0 = init(rand, o);
  if (tries > 800) return null;
  return climb(rand, p0, mutate(o), sc, o.iters || 800, { temp: 2.5 });
}
module.exports = { make, scorer };

if (require.main === module) {
  const o = JSON.parse(process.argv[2]), seed = +process.argv[3] || 1;
  const t0 = Date.now(), res = make(seed, o);
  if (!res) { console.log('no start'); process.exit(); }
  const s = res.s;
  console.log(s.lv.m.split('/').join('\n'));
  console.log(JSON.stringify(s.lv.guards), 'detour', s.detour, 'steps', s.r.steps, 'free', s.r0.steps, 'takedowns', s.r.takedowns, 'rev', s.rev, 'pushes', s.r.pushes, 'v', s.v.toFixed(1), s.r.moves, (Date.now() - t0) + 'ms');
}

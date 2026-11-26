'use strict';
// Generator for floors where only pushing changes anything: the garage (cars) and the loading dock (crates).
//   cars   roll only along their length, one bay per push, pushed from either end (Rush Hour on foot)
//   crates go one step in any direction (as in Fuze); the dock is laid out mirror-symmetric
//   glass  broken glass: walking on it costs fuse, pushing something over it crushes it
const { mulberry32, occupancy, encode, climb, S } = require('./common.js');

function mirrorX(p, x) { return p.w - 1 - x; }
function init(rand, o) {
  const { w, h } = o, N = w * h, cell = new Uint8Array(N);
  const cx = (w - 1) >> 1;
  const p = { w, h, cell, crates: [], cars: [], start: [o.sx != null ? o.sx : cx, h - 1], lift: [o.lx != null ? o.lx : cx, 0], bomb: null, guards: [] };
  if (o.bomb) { p.bomb = [o.bx != null ? o.bx : cx, o.by != null ? o.by : 0]; p.lift = null; }
  for (let i = 0; i < (o.cars || 0) * 4 && p.cars.length < o.cars; i++) addCar(p, rand);
  for (let i = 0; i < (o.crates || 0) * 4 && p.crates.length < o.crates; i++) addCrate(p, rand, o);
  for (let i = 0; i < (o.pillars || 0); i++) togglePillar(p, rand, o);
  return p;
}
function addCar(p, rand) {
  const h = rand() < .5 ? 1 : 0, x = Math.floor(rand() * (p.w - h)), y = Math.floor(rand() * (p.h - (1 - h)));
  p.cars.push({ x, y, h });
  if (!occupancy(p)) p.cars.pop();
}
function addCrate(p, rand, o) {
  const x = Math.floor(rand() * p.w), y = Math.floor(rand() * p.h);
  const n = p.crates.length;
  p.crates.push([x, y]);
  if (o.sym && x !== mirrorX(p, x)) p.crates.push([mirrorX(p, x), y]);
  if (!occupancy(p)) p.crates.length = n;
}
function removeCrate(p, rand, o) {
  const c = p.crates[Math.floor(rand() * p.crates.length)];
  p.crates = p.crates.filter(d => !(d[1] === c[1] && (d[0] === c[0] || (o.sym && d[0] === mirrorX(p, c[0])))));
}
function togglePillar(p, rand, o) {
  const x = Math.floor(rand() * p.w), y = 1 + Math.floor(rand() * (p.h - 2)), i = y * p.w + x;
  const v = p.cell[i] === 1 ? 0 : 1;
  p.cell[i] = v; if (o.sym) p.cell[y * p.w + mirrorX(p, x)] = v;
}
function toggleGlass(p, rand, o) {
  const x = Math.floor(rand() * p.w), y = Math.floor(rand() * p.h), i = y * p.w + x;
  if (p.cell[i] === 1) return;
  const v = p.cell[i] === 2 ? 0 : 2;
  p.cell[i] = v; if (o.sym && o.symGlass) { const j = y * p.w + mirrorX(p, x); if (p.cell[j] !== 1) p.cell[j] = v; }
}
function mutate(o) {
  return (p, rand) => {
    const r = rand() * 10;
    if (o.cars) {
      if (r < 2.5 && p.cars.length) { const c = p.cars[Math.floor(rand() * p.cars.length)]; c.x += Math.floor(rand() * 3) - 1; c.y += Math.floor(rand() * 3) - 1; return; }
      if (r < 3.2 && p.cars.length) { p.cars[Math.floor(rand() * p.cars.length)].h ^= 1; return; }
      if (r < 3.8 && p.cars.length > o.minCars) { p.cars.splice(Math.floor(rand() * p.cars.length), 1); return; }
      if (r < 4.5 && p.cars.length < o.maxCars) { addCar(p, rand); return; }
      if (r < 5 && p.cars.length) { const c = p.cars[Math.floor(rand() * p.cars.length)]; c.x = Math.floor(rand() * (p.w - c.h)); c.y = Math.floor(rand() * (p.h - 1 + c.h)); return; }
    }
    if (o.crates) {
      if (r < 6.2 && p.crates.length) {
        // nudge a crate (and its mirror image)
        const k = Math.floor(rand() * p.crates.length), c = p.crates[k], dx = Math.floor(rand() * 3) - 1, dy = Math.floor(rand() * 3) - 1;
        const mk = o.sym ? p.crates.findIndex((d, j) => j !== k && d[1] === c[1] && d[0] === mirrorX(p, c[0])) : -1;
        c[0] += dx; c[1] += dy; if (mk >= 0) { p.crates[mk][0] -= dx; p.crates[mk][1] += dy; }
        if (o.sym && mk < 0 && c[0] !== mirrorX(p, c[0])) p.crates.push([mirrorX(p, c[0]), c[1]]);
        if (o.sym && mk >= 0 && c[0] === mirrorX(p, c[0])) p.crates.splice(mk, 1);
        return;
      }
      if (r < 7 && p.crates.length > o.minCrates) { removeCrate(p, rand, o); return; }
      if (r < 7.8 && p.crates.length < o.maxCrates) { addCrate(p, rand, o); return; }
    }
    if (r < 8.6 && o.pillars != null) { togglePillar(p, rand, o); return; }
    if (r < 9.4 && o.glass) { toggleGlass(p, rand, o); return; }
    if (!o.sym) {
      if (rand() < .5) p.start[0] = Math.floor(rand() * p.w);
      else if (p.lift) p.lift[0] = Math.floor(rand() * p.w);
      else if (p.bomb && !o.fixBomb) { p.bomb[0] = Math.floor(rand() * p.w); p.bomb[1] = Math.floor(rand() * Math.ceil(p.h / 2)); }
    }
  };
}
function segments(seq) { let n = 0; for (let i = 0; i < seq.length; i++) if (i === 0 || seq[i] !== seq[i - 1]) n++; return n; }
function scorer(o) {
  return p => {
    if (p.cars.some(c => c.x < 0 || c.y < 0 || c.x + c.h >= p.w || c.y + (1 - c.h) >= p.h)) return { v: -Infinity };
    if (p.crates.some(c => c[0] < 0 || c[1] < 0 || c[0] >= p.w || c[1] >= p.h)) return { v: -Infinity };
    if (o.sym && p.crates.some(c => !p.crates.some(d => d[1] === c[1] && d[0] === mirrorX(p, c[0])))) return { v: -Infinity };
    const lv = encode(p);
    const r = S.quick(lv, { cap: o.cap || 15000 });
    if (!r || r.overflow) return { v: -Infinity };
    if (S.quick(lv, { cap: 3000, frozen: true })) return { v: -Infinity }; // something has to be pushed
    const seg = segments(r.seq), used = new Set(r.seq).size, objs = p.cars.length + p.crates.length, idle = objs - used;
    let glassN = 0, pill = 0; for (let i = 0; i < p.cell.length; i++) { if (p.cell[i] === 2) glassN++; if (p.cell[i] === 1) pill++; }
    let v = seg * 4 + used * 2.5 + r.pushes * .8 + r.steps * .05 - idle * (o.idleCost || .6) - pill * (o.pillarCost || .15);
    if (o.glass) {
      // glass has to matter: crushed, or crossed because it is quicker than the long way round
      // crossing a pane or two is a choice; a route paved with glass is not
      v += Math.min(r.crushed, 4) * 2.5 + Math.min(r.glass, 2) * 1.5 - Math.max(0, r.glass - 2) * 4 - Math.max(0, glassN - o.glass) * 2;
      if (!r.crushed && !r.glass) v -= 8;
    }
    if (o.target && seg > o.target) v -= (seg - o.target) * 6;
    if (o.minSeg && seg < o.minSeg) v -= (o.minSeg - seg) * 3;
    return { v, r, seg, used, idle, lv, glassN };
  };
}
function make(seed, o) {
  const rand = mulberry32(seed), sc = scorer(o);
  let p0 = init(rand, o), tries = 0;
  while (sc(p0).v === -Infinity && tries++ < 600) p0 = init(rand, o);
  if (tries > 600) return null;
  return climb(rand, p0, mutate(o), sc, o.iters || 2000, { temp: 3 });
}
module.exports = { make, segments, scorer };

if (require.main === module) {
  const o = JSON.parse(process.argv[2]);
  const seed = +process.argv[3] || 1;
  const t0 = Date.now(), res = make(seed, o);
  if (!res) { console.log('no start'); process.exit(); }
  const s = res.s;
  console.log(s.lv.m.split('/').join('\n'));
  console.log(JSON.stringify(s.lv.cars || []), 'seg', s.seg, 'used', s.used, 'idle', s.idle, 'pushes', s.r.pushes, 'steps', s.r.steps, 'crushed', s.r.crushed, 'glass', s.r.glass, 'v', s.v.toFixed(1), (Date.now() - t0) + 'ms');
}

'use strict';
// Shared pieces for the Fuze Tower floor generators: a floor plan, its encoding, and a hill climber.
const S = require('../solve.js');

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// A plan: { w, h, cell: Uint8Array (0 floor, 1 pillar, 2 glass, 3 spare fuse), crates: [[x,y]], cars: [{x,y,h}],
//           start: [x,y], lift: [x,y] | null, bomb: [x,y] | null, guards: [{path, look, face}] }
const CH = '.XgF';
function copy(p) {
  return { w: p.w, h: p.h, cell: p.cell.slice(), crates: p.crates.map(c => c.slice()), cars: p.cars.map(c => ({ ...c })), start: p.start.slice(),
    lift: p.lift && p.lift.slice(), bomb: p.bomb && p.bomb.slice(), guards: (p.guards || []).map(g => ({ path: g.path.map(q => q.slice()), look: g.look && g.look.slice(), face: g.face })), lasers: (p.lasers || []).map(l => ({ ...l })) };
}
// which object sits on each cell: 0 free, 1 pillar, 2 crate, 3 car, 4 start, 5 goal, 6 guard path
function occupancy(p) {
  const o = new Uint8Array(p.w * p.h);
  for (let i = 0; i < o.length; i++) if (p.cell[i] === 1) o[i] = 1;
  const put = (x, y, v) => { if (x < 0 || y < 0 || x >= p.w || y >= p.h) return false; const i = y * p.w + x; if (o[i]) return false; o[i] = v; return true; };
  let ok = true;
  if (!put(p.start[0], p.start[1], 4)) ok = false;
  if (p.lift && !put(p.lift[0], p.lift[1], 5)) ok = false;
  if (p.bomb && !put(p.bomb[0], p.bomb[1], 5)) ok = false;
  for (const c of p.crates) if (!put(c[0], c[1], 2)) ok = false;
  for (const c of p.cars) { if (!put(c.x, c.y, 3)) ok = false; if (!put(c.x + (c.h ? 1 : 0), c.y + (c.h ? 0 : 1), 3)) ok = false; }
  for (const g of p.guards || []) g.path.forEach((q, j) => { const i = q[1] * p.w + q[0]; if (q[0] < 0 || q[1] < 0 || q[0] >= p.w || q[1] >= p.h || (o[i] && o[i] !== 6) || (j === 0 && o[i] === 6)) ok = false; else o[i] = 6; });
  return ok ? o : null;
}
function encode(p, extra) {
  const rows = [];
  for (let y = 0; y < p.h; y++) {
    let s = '';
    for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x;
      if (p.start[0] === x && p.start[1] === y) s += 'S';
      else if (p.lift && p.lift[0] === x && p.lift[1] === y) s += 'E';
      else if (p.bomb && p.bomb[0] === x && p.bomb[1] === y) s += 'B';
      else if (p.crates.some(c => c[0] === x && c[1] === y)) s += '#';
      else s += CH[p.cell[i]];
    }
    rows.push(s);
  }
  const lv = Object.assign({ m: rows.join('/') }, extra || {});
  if (p.cars.length) lv.cars = p.cars.map(c => ({ x: c.x, y: c.y, h: c.h }));
  if (p.guards && p.guards.length) lv.guards = p.guards.map(g => { const o = { path: g.path }; if (g.look) o.look = g.look; if (g.face != null && g.path.length < 2 && !g.look) o.face = g.face; return o; });
  if (p.lasers && p.lasers.length) lv.lasers = p.lasers;
  return lv;
}
// hill climbing with occasional acceptance of worse plans; keeps the best seen
function climb(rand, plan0, mutate, score, iters, opts) {
  opts = opts || {};
  let cur = plan0, cs = score(cur), best = cur, bs = cs;
  let temp = opts.temp || 2;
  for (let it = 0; it < iters; it++) {
    const nx = copy(cur);
    const k = 1 + Math.floor(rand() * (opts.burst || 2));
    for (let j = 0; j < k; j++) mutate(nx, rand);
    if (!occupancy(nx)) continue;
    const s = score(nx);
    if (s.v === -Infinity) continue;
    if (s.v >= cs.v || rand() < Math.exp((s.v - cs.v) / temp)) { cur = nx; cs = s; }
    if (s.v > bs.v) { best = nx; bs = s; if (opts.log) opts.log(it, bs); }
    temp = Math.max(.3, temp * .9995);
  }
  return { plan: best, s: bs };
}
module.exports = { mulberry32, copy, occupancy, encode, climb, S };

'use strict';
// Generator for harder test floors, one idea at a time. A floor is a grid of characters plus lasers, guards and vents.
// It climbs towards floors that take many separate pushes and a long route, rejects floors that can be solved
// without the idea, and penalises routes built on stepping back and forth to wait.
//   node tower/gen/labgen.js <idea> <seed> [iters]   -> prints the best floor as JSON
const S = require('../solve.js'), R = require('../src/rules.js');

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clone = o => JSON.parse(JSON.stringify(o));

// what each idea starts with and may move around
const IDEAS = {
  laser:  { w: 7, h: 8, crates: [3, 5], pillars: 3, lasers: { n: [2, 3], c: 'r' }, ablate: lv => ({ ...lv, m: lv.m.replace(/#/g, '.') }) },
  green:  { cap: 25000, w: 7, h: 8, crates: [1, 3], mirrors: [2, 3], pillars: 3, recv: 1, lasers: { n: [1, 1], c: 'g' }, red: [0, 1], ablate: lv => ({ ...lv, m: lv.m.replace(/[qp]/g, '#') }) },
  radio:  { w: 7, h: 8, crates: [0, 1], pillars: 4, radios: [1, 2], guards: [2, 3], ablate: lv => ({ ...lv, m: lv.m.replace(/N/g, 'X') }) },
  power:  { w: 7, h: 8, crates: [1, 3], pillars: 3, switches: [1, 2], lasers: { n: [2, 3], c: 'r' }, ablate: lv => ({ ...lv, m: lv.m.replace(/P/g, '.') }) },
  blink:  { w: 7, h: 8, crates: [0, 2], pillars: 4, lasers: { n: [2, 4], c: 'r', blink: true }, ablate: lv => ({ ...lv, lasers: lv.lasers.map(l => ({ ...l, on: null })) }) },
  vents:  { w: 7, h: 9, crates: [2, 3], pillars: 2, rooms: [3, 6], vents: [2, 3], ablate: lv => ({ ...lv, vents: [] }) },
  plate:  { w: 7, h: 8, crates: [2, 4], pillars: 3, rooms: [3], doors: [1, 2], plates: [1, 2], ablate: lv => ({ ...lv, m: lv.m.replace(/o/g, '.') }) }
};
const ri = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));

function emptyPlan(sp, rand) {
  const g = [];
  for (let y = 0; y < sp.h; y++) g.push(Array(sp.w).fill('.'));
  const p = { w: sp.w, h: sp.h, g, lasers: [], guards: [], vents: [] };
  p.g[0][ri(rand, 1, sp.w - 2)] = 'E';
  p.g[sp.h - 1][ri(rand, 1, sp.w - 2)] = 'S';
  // walls across the floor split it into rooms, with one gap each (doors go in the gaps on plate floors)
  for (const ry of sp.rooms || []) { for (let x = 0; x < sp.w; x++) p.g[ry][x] = 'X'; if (!sp.vents) p.g[ry][ri(rand, 1, sp.w - 2)] = sp.doors ? 'D' : '.'; }
  return p;
}
function freeCells(p, rows) {
  const out = [];
  for (let y = 1; y < p.h - 1; y++) if (!rows || rows.includes(y)) for (let x = 0; x < p.w; x++) if (p.g[y][x] === '.' && !p.guards.some(g => g.path.some(q => q[0] === x && q[1] === y)) && !p.vents.some(v => (v[0] === x && v[1] === y) || (v[2] === x && v[3] === y))) out.push([x, y]);
  return out;
}
function place(p, rand, ch) { const f = freeCells(p); if (!f.length) return false; const [x, y] = f[Math.floor(rand() * f.length)]; p.g[y][x] = ch; return true; }
function randLaser(p, rand, L) {
  // fired from outside the floor, across a row or up a column
  const side = Math.floor(rand() * 3), l = {};
  if (side === 0) { l.x = -1; l.y = ri(rand, 1, p.h - 2); l.d = 3; }
  else if (side === 1) { l.x = p.w; l.y = ri(rand, 1, p.h - 2); l.d = 2; }
  else { l.x = ri(rand, 0, p.w - 1); l.y = p.h; l.d = 0; }
  if (L.c === 'g') l.c = 'g';
  if (L.blink) { const n = ri(rand, 2, 4); l.on = []; for (let i = 0; i < n; i++) l.on.push(i === 0 ? 1 : rand() < .5 ? 1 : 0); if (!l.on.includes(0)) l.on[n - 1] = 0; }
  return l;
}
function randGuard(p, rand) { const f = freeCells(p); if (!f.length) return null; const [x, y] = f[Math.floor(rand() * f.length)]; return { path: [[x, y]], face: Math.floor(rand() * 4) }; }
function init(sp, rand) {
  const p = emptyPlan(sp, rand);
  for (let i = 0; i < sp.pillars; i++) place(p, rand, 'X');
  for (let i = 0, n = ri(rand, ...sp.crates); i < n; i++) place(p, rand, '#');
  if (sp.mirrors) for (let i = 0, n = ri(rand, ...sp.mirrors); i < n; i++) place(p, rand, rand() < .5 ? 'q' : 'p');
  if (sp.radios) for (let i = 0, n = ri(rand, ...sp.radios); i < n; i++) place(p, rand, 'N');
  if (sp.switches) for (let i = 0, n = ri(rand, ...sp.switches); i < n; i++) place(p, rand, 'P');
  if (sp.plates) for (let i = 0, n = ri(rand, ...sp.plates); i < n; i++) place(p, rand, 'o');
  if (sp.recv) { // a receiver in the back wall or a side wall
    const y = ri(rand, 0, 2), x = rand() < .5 ? 0 : p.w - 1; if (p.g[y][x] === '.') p.g[y][x] = 'R'; else place(p, rand, 'R');
  }
  if (sp.lasers) for (let i = 0, n = ri(rand, ...sp.lasers.n); i < n; i++) p.lasers.push(randLaser(p, rand, sp.lasers));
  if (sp.red) for (let i = 0, n = ri(rand, ...sp.red); i < n; i++) p.lasers.push(randLaser(p, rand, { c: 'r' }));
  if (sp.guards) for (let i = 0, n = ri(rand, ...sp.guards); i < n; i++) { const g = randGuard(p, rand); if (g) p.guards.push(g); }
  if (sp.vents) for (let i = 0, n = ri(rand, ...sp.vents); i < n; i++) addVent(p, rand);
  return p;
}
function addVent(p, rand) { const f = freeCells(p); if (f.length < 2) return; const a = f[Math.floor(rand() * f.length)]; let b = a; for (let k = 0; k < 9 && b === a; k++) b = f[Math.floor(rand() * f.length)]; if (b !== a) p.vents.push([a[0], a[1], b[0], b[1]]); }
const isVent = (p, x, y) => p.vents.some(v => (v[0] === x && v[1] === y) || (v[2] === x && v[3] === y));
function cellsOf(p, chs) { const out = []; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (chs.includes(p.g[y][x])) out.push([x, y]); return out; }

function mutate(sp, p, rand) {
  const ops = ['pillar', 'move', 'move', 'move'];
  if (sp.crates) ops.push('crate');
  if (sp.mirrors) ops.push('flip', 'move');
  if (sp.lasers || sp.red) ops.push('laser', 'laser');
  if (sp.guards) ops.push('guard', 'guard');
  if (sp.vents) ops.push('vent', 'vent');
  if (sp.rooms) ops.push('gap');
  const op = ops[Math.floor(rand() * ops.length)];
  const movable = '#qpNPoR' + (sp.recv ? '' : '');
  if (op === 'pillar') {
    const y = ri(rand, 1, p.h - 2), x = ri(rand, 0, p.w - 1);
    if ((sp.rooms || []).includes(y) || isVent(p, x, y)) return;
    if (p.g[y][x] === 'X') p.g[y][x] = '.'; else if (p.g[y][x] === '.') p.g[y][x] = 'X';
  } else if (op === 'move') {
    const c = cellsOf(p, movable); if (!c.length) return;
    const [x, y] = c[Math.floor(rand() * c.length)], ch = p.g[y][x];
    const nx = x + ri(rand, -1, 1), ny = y + ri(rand, -1, 1);
    if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) return;
    if (ch === 'R') { if (p.g[ny][nx] === '.' && (nx === 0 || nx === p.w - 1 || ny === 0)) { p.g[ny][nx] = 'R'; p.g[y][x] = '.'; } return; }
    if (ny === 0 || ny === p.h - 1 || p.g[ny][nx] !== '.' || isVent(p, nx, ny)) return;
    p.g[ny][nx] = ch; p.g[y][x] = '.';
  } else if (op === 'crate') {
    const c = cellsOf(p, '#');
    if (c.length > sp.crates[0] && (rand() < .5 || c.length >= sp.crates[1])) { const [x, y] = c[Math.floor(rand() * c.length)]; p.g[y][x] = '.'; }
    else if (c.length < sp.crates[1]) place(p, rand, '#');
  } else if (op === 'flip') {
    const c = cellsOf(p, 'qp'); if (!c.length) return; const [x, y] = c[Math.floor(rand() * c.length)]; p.g[y][x] = p.g[y][x] === 'q' ? 'p' : 'q';
  } else if (op === 'laser') {
    const k = Math.floor(rand() * p.lasers.length), old = p.lasers[k];
    const L = old.c === 'g' ? { c: 'g' } : sp.lasers && sp.lasers.blink ? sp.lasers : { c: 'r' };
    if (rand() < .5) p.lasers[k] = Object.assign(randLaser(p, rand, L), old.c === 'g' ? { c: 'g' } : {});
    else if (old.d === 0) old.x = Math.max(0, Math.min(p.w - 1, old.x + ri(rand, -1, 1)));
    else old.y = Math.max(1, Math.min(p.h - 2, old.y + ri(rand, -1, 1)));
    if (L.blink && rand() < .3) p.lasers[k].on = randLaser(p, rand, L).on;
  } else if (op === 'guard') {
    if (!p.guards.length) return;
    const g = p.guards[Math.floor(rand() * p.guards.length)];
    if (rand() < .4) g.face = Math.floor(rand() * 4);
    else { const nx = g.path[0][0] + ri(rand, -1, 1), ny = g.path[0][1] + ri(rand, -1, 1); if (nx >= 0 && ny > 0 && nx < p.w && ny < p.h - 1 && p.g[ny][nx] === '.') g.path[0] = [nx, ny]; }
  } else if (op === 'vent') {
    if (!p.vents.length) return;
    const v = p.vents[Math.floor(rand() * p.vents.length)], e = rand() < .5 ? 0 : 2, f = freeCells(p);
    if (f.length) { const [x, y] = f[Math.floor(rand() * f.length)]; v[e] = x; v[e + 1] = y; }
  } else if (op === 'gap') {
    const ry = sp.rooms[Math.floor(rand() * sp.rooms.length)];
    const gaps = []; for (let x = 0; x < p.w; x++) if (p.g[ry][x] !== 'X') gaps.push(x);
    const nx = ri(rand, 0, p.w - 1); if (p.g[ry][nx] !== 'X') return;
    const ch = gaps.length ? p.g[ry][gaps[0]] : (sp.doors ? 'D' : '.');
    const most = sp.doors ? sp.doors[1] : 1;
    if (gaps.length && (gaps.length >= most || rand() < .7)) p.g[ry][gaps[Math.floor(rand() * gaps.length)]] = 'X';
    if (sp.vents) return; // vent floors keep their walls whole
    p.g[ry][nx] = ch;
  }
}
const encode = p => {
  const lv = { m: p.g.map(r => r.join('')).join('/') };
  if (p.lasers.length) lv.lasers = p.lasers;
  if (p.guards.length) lv.guards = p.guards;
  if (p.vents.length) lv.vents = p.vents;
  return lv;
};
function segments(seq) { let n = 0; for (let i = 0; i < seq.length; i++) if (i === 0 || seq[i] !== seq[i - 1]) n++; return n; }
function score(sp, p, cap) {
  // sanity: vents on floor cells, guards on floor cells, nothing doubled up
  for (const v of p.vents) { if (p.g[v[1]][v[0]] !== '.' || p.g[v[3]][v[2]] !== '.') return { v: -Infinity }; }
  for (const g of p.guards) if (p.g[g.path[0][1]][g.path[0][0]] !== '.') return { v: -Infinity };
  const lv = encode(p);
  const st = R.makeState(R.parseLevel(lv));
  if (R.spotted(st)) return { v: -Infinity };
  const r = S.solve(lv, { cap });
  if (!r || r.overflow) return { v: -Infinity };
  const r2 = S.solve(sp.ablate(lv), { cap });
  if (r2 && !r2.overflow && r2.steps <= r.steps + 4) return { v: -Infinity }; // the idea has to matter
  let rev = 0; for (let i = 1; i < r.moves.length; i++) if ('UDLR'.indexOf(r.moves[i]) === ('UDLR'.indexOf(r.moves[i - 1]) ^ 1)) rev++;
  const seg = segments(r.seq), used = new Set(r.seq).size;
  let pill = 0; for (const row of p.g) for (const ch of row) if (ch === 'X') pill++;
  const v = r.steps * .35 + r.pushes * .9 + seg * 2.5 + used * 1.5 + r.takedowns * 2 - rev * 1.6 - pill * .08;
  return { v, r, lv, rev, seg };
}
function make(idea, seed, iters) {
  const sp = IDEAS[idea], rand = mulberry32(seed), cap = sp.cap || 50000;
  let cur, cs, tries = 0;
  do { cur = init(sp, rand); cs = score(sp, cur, cap); } while (cs.v === -Infinity && ++tries < 3000);
  if (cs.v === -Infinity) return null;
  let best = cur, bs = cs, temp = 2.5;
  for (let it = 0; it < iters; it++) {
    const nx = clone(cur);
    for (let k = 0, n = 1 + Math.floor(rand() * 2); k < n; k++) mutate(sp, nx, rand);
    const s = score(sp, nx, cap);
    if (s.v === -Infinity) continue;
    if (s.v >= cs.v || rand() < Math.exp((s.v - cs.v) / temp)) { cur = nx; cs = s; }
    if (s.v > bs.v) { best = nx; bs = s; }
    temp = Math.max(.3, temp * .996);
  }
  return bs;
}
module.exports = { make, IDEAS };

if (require.main === module) {
  const [idea, seed = 1, iters = 400] = process.argv.slice(2);
  const t0 = Date.now(), b = make(idea, +seed, +iters);
  if (!b) { console.log(JSON.stringify({ idea, seed: +seed, fail: true })); process.exit(); }
  console.log(JSON.stringify({ idea, seed: +seed, v: +b.v.toFixed(1), steps: b.r.steps, pushes: b.r.pushes, seg: b.seg, rev: b.rev, td: b.r.takedowns, ms: Date.now() - t0, lv: b.lv, moves: b.r.moves }));
}

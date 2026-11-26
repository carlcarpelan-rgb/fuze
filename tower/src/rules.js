// Fuze Tower rules. Shared by the game (browser) and the solver/generator (node).
// Map: '.' floor, '#' crate (push one step), 'X' fixed pillar, 'S' start,
//      'E' lift: a solid cell in the back row, entered by walking up into it (goal),
//      'B' bomb (goal on boss floors), 'g' broken glass (walkable, costs fuse; anything pushed onto it crushes it),
//      'F' spare fuse (refills the fuse).
// Level extras:
//   cars   [{x,y,h}]  two cells long, h=1 lies left-right, h=0 lies up-down. A push along its length moves it one step;
//                     a push from the side does nothing.
//   guards [{path:[[x,y],...], face, look:[faces]}]  walk the path back and forth, one step per player step.
//                     A guard standing still can turn through `look`, one entry per player step.
//                     A guard sees the square in front of him and the squares on either side. Never behind his back.
//                     Walking into his back knocks him out.
//   lasers [{x,y,d}]  fire from a cell in direction d (0 up, 1 down, 2 left, 3 right) until something solid.
(function (root) {
  'use strict';
  const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
  const GLASS_COST = 3; // seconds of fuse per step on glass

  function parseLevel(lv) {
    const rows = lv.m.split('/'), h = rows.length, w = rows[0].length;
    const L = { w, h, blocks: [], walls: [], glass: [], fuses: [], goals: [], sx: 0, sy: 0, time: lv.t, theme: lv.theme | 0, name: lv.name || '' };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === '#') L.blocks.push({ x, y });
      else if (c === 'X') L.walls.push({ x, y });
      else if (c === 'g') L.glass.push({ x, y });
      else if (c === 'F') L.fuses.push({ x, y });
      else if (c === 'E') L.goals.push({ x, y, k: 'lift' });
      else if (c === 'B') L.goals.push({ x, y, k: 'bomb' });
      else if (c === 'S') { L.sx = x; L.sy = y; }
    }
    L.cars = (lv.cars || []).map(c => ({ x: c.x, y: c.y, h: c.h ? 1 : 0, v: c.v | 0 }));
    L.guards = (lv.guards || []).map(g => ({ path: g.path.map(p => ({ x: p[0], y: p[1] })), face: g.face, look: g.look || null }));
    L.lasers = (lv.lasers || []).map(l => ({ x: l.x, y: l.y, d: l.d }));
    return L;
  }

  function makeState(L) {
    const N = L.w * L.h;
    const st = {
      w: L.w, h: L.h, px: L.sx, py: L.sy,
      blockAt: new Int16Array(N), carAt: new Int16Array(N), wall: new Uint8Array(N), glass: new Uint8Array(N), fuse: new Uint8Array(N), goal: new Uint8Array(N),
      blocks: L.blocks.map(b => ({ x: b.x, y: b.y })),
      cars: L.cars.map(c => ({ x: c.x, y: c.y, h: c.h })),
      guards: L.guards.map(g => {
        const p0 = g.path[0], p1 = g.path[1];
        let face = g.face != null ? g.face : 1;
        if (g.look) face = g.look[0];
        else if (p1) face = dirOf(p1.x - p0.x, p1.y - p0.y);
        return { path: g.path, look: g.look, li: 0, i: 0, dir: 1, x: p0.x, y: p0.y, face, alive: true };
      }),
      lasers: L.lasers
    };
    st.blocks.forEach((b, i) => { st.blockAt[b.y * st.w + b.x] = i + 1; });
    st.cars.forEach((c, i) => { st.carAt[c.y * st.w + c.x] = i + 1; st.carAt[(c.y + (c.h ? 0 : 1)) * st.w + c.x + (c.h ? 1 : 0)] = i + 1; });
    L.walls.forEach(o => { st.wall[o.y * st.w + o.x] = 1; });
    L.glass.forEach(o => { st.glass[o.y * st.w + o.x] = 1; });
    L.fuses.forEach(o => { st.fuse[o.y * st.w + o.x] = 1; });
    L.goals.forEach(o => { st.goal[o.y * st.w + o.x] = o.k === 'bomb' ? 2 : 1; });
    return st;
  }
  function dirOf(dx, dy) { return dy < 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3; }
  const inB = (st, x, y) => x >= 0 && y >= 0 && x < st.w && y < st.h;
  function guardAt(st, x, y) { for (let i = 0; i < st.guards.length; i++) { const g = st.guards[i]; if (g.alive && g.x === x && g.y === y) return i; } return -1; }
  // things you cannot see through
  const opaque = (st, i) => st.wall[i] || st.blockAt[i] || st.carAt[i] || st.goal[i];

  // A guard's view, as [cell, k] pairs (k = 1 ahead, 0 beside him): the square in front and the squares on either side.
  //     c
  //   c G c
  // He never sees behind his back. Crates, cars, pillars and the lift are solid, so he does not see "into" them.
  function sight(st, g) {
    const out = []; if (!g.alive) return out;
    const fx = DX[g.face], fy = DY[g.face], lx = -fy, ly = fx;
    const cell = (k, l) => { const x = g.x + fx * k + lx * l, y = g.y + fy * k + ly * l; return inB(st, x, y) ? y * st.w + x : -1; };
    const see = (i, k) => { if (i >= 0 && !opaque(st, i)) out.push(i, k); };
    see(cell(0, -1), 0); see(cell(1, 0), 1); see(cell(0, 1), 0);
    return out;
  }
  function sees(st, g, ci) { const s = sight(st, g); for (let j = 0; j < s.length; j += 2) if (s[j] === ci) return true; return false; }
  // cells a laser beam passes through
  function beam(st, l) {
    const out = []; let x = l.x, y = l.y;
    for (;;) {
      x += DX[l.d]; y += DY[l.d];
      if (!inB(st, x, y)) break;
      const i = y * st.w + x;
      if (st.wall[i] || st.blockAt[i] || st.carAt[i]) break;
      out.push(i);
    }
    return out;
  }
  function spotted(st) {
    const me = st.py * st.w + st.px;
    for (let k = 0; k < st.guards.length; k++) if (sees(st, st.guards[k], me)) return { by: 'guard', g: k };
    for (let k = 0; k < st.lasers.length; k++) if (beam(st, st.lasers[k]).includes(me)) return { by: 'laser', l: k };
    return null;
  }

  // the guards take their step: along the path, turning around at either end or when something is in the way
  function moveGuards(st, ev) {
    for (let k = 0; k < st.guards.length; k++) {
      const g = st.guards[k]; if (!g.alive) continue;
      if (g.path.length < 2) {
        if (g.look && g.look.length > 1) { g.li = (g.li + 1) % g.look.length; const f = g.look[g.li]; if (f !== g.face) { g.face = f; ev.push({ g: k, turn: true }); } }
        continue;
      }
      let ni = g.i + g.dir;
      if (ni < 0 || ni >= g.path.length) { g.dir = -g.dir; ni = g.i + g.dir; const p = g.path[ni]; g.face = dirOf(p.x - g.x, p.y - g.y); ev.push({ g: k, turn: true }); continue; }
      const p = g.path[ni], c = p.y * st.w + p.x;
      if (st.blockAt[c] || st.carAt[c] || st.wall[c] || guardAt(st, p.x, p.y) >= 0) { g.dir = -g.dir; g.face = dirOf(-(p.x - g.x), -(p.y - g.y)); ev.push({ g: k, turn: true }); continue; }
      const fx = g.x, fy = g.y;
      g.face = dirOf(p.x - g.x, p.y - g.y); g.x = p.x; g.y = p.y; g.i = ni;
      ev.push({ g: k, from: [fx, fy] });
      if (g.x === st.px && g.y === st.py) return { by: 'guard', g: k };
    }
    return null;
  }

  // can something pushed land on this cell?
  function freeFor(st, x, y) {
    if (!inB(st, x, y)) return false;
    const i = y * st.w + x;
    return !(st.wall[i] || st.blockAt[i] || st.carAt[i] || st.goal[i] || st.fuse[i] || guardAt(st, x, y) >= 0);
  }

  // One player step. Returns what happened, for the game's animation and the solver.
  function step(st, d) {
    const dx = DX[d], dy = DY[d], tx = st.px + dx, ty = st.py + dy;
    if (!inB(st, tx, ty)) return { t: 'blocked' };
    const ti = ty * st.w + tx;
    if (st.wall[ti]) return { t: 'blocked', wall: true };
    if (st.goal[ti] === 1 && d !== 0) return { t: 'blocked', lift: true }; // lift doors face the room
    const res = { t: 'move', d, ev: [], cost: 0 };
    const gk = guardAt(st, tx, ty);
    if (gk >= 0) {
      const g = st.guards[gk];
      // only from behind; anywhere else he has already seen you
      if (g.face !== d) { st.px = tx; st.py = ty; return { t: 'caught', by: 'guard', g: gk, d, ev: [] }; }
      g.alive = false; res.t = 'takedown'; res.g = gk;
    } else if (st.blockAt[ti]) {
      const bx = tx + dx, by = ty + dy;
      if (!freeFor(st, bx, by)) return { t: 'blocked', block: st.blockAt[ti] - 1 };
      const bi = by * st.w + bx, k = st.blockAt[ti] - 1;
      st.blockAt[bi] = k + 1; st.blockAt[ti] = 0; st.blocks[k].x = bx; st.blocks[k].y = by;
      if (st.glass[bi]) { st.glass[bi] = 0; res.crushed = [bi]; }
      res.t = 'push'; res.block = k;
    } else if (st.carAt[ti]) {
      const k = st.carAt[ti] - 1, car = st.cars[k];
      if ((car.h ? 1 : 0) !== (dx ? 1 : 0)) return { t: 'blocked', car: k };
      // the cell the car's leading end moves into
      const fx = car.h ? (dx > 0 ? car.x + 2 : car.x - 1) : car.x, fy = car.h ? car.y : (dy > 0 ? car.y + 2 : car.y - 1);
      if (!freeFor(st, fx, fy)) return { t: 'blocked', car: k };
      const tail = car.h ? (dx > 0 ? car.y * st.w + car.x : car.y * st.w + car.x + 1) : (dy > 0 ? car.y * st.w + car.x : (car.y + 1) * st.w + car.x);
      const fi = fy * st.w + fx;
      st.carAt[tail] = 0; st.carAt[fi] = k + 1; car.x += dx; car.y += dy;
      if (st.glass[fi]) { st.glass[fi] = 0; res.crushed = [fi]; }
      res.t = 'push'; res.car = k;
    }
    st.px = tx; st.py = ty;
    if (st.goal[ti]) { res.t = 'win'; res.goal = st.goal[ti] === 2 ? 'bomb' : 'lift'; return res; }
    if (st.glass[ti]) res.cost = GLASS_COST;
    if (st.fuse[ti]) { st.fuse[ti] = 0; res.refill = true; }
    let s = spotted(st);
    if (!s) { s = moveGuards(st, res.ev); if (!s) s = spotted(st); } else res.early = true;
    if (s) { res.t = 'caught'; res.by = s.by; res.g = s.g; res.l = s.l; }
    return res;
  }

  function clone(st) {
    return {
      w: st.w, h: st.h, px: st.px, py: st.py,
      blockAt: st.blockAt.slice(), carAt: st.carAt.slice(), wall: st.wall, glass: st.glass.slice(), fuse: st.fuse.slice(), goal: st.goal,
      blocks: st.blocks.map(b => ({ x: b.x, y: b.y })),
      cars: st.cars.map(c => ({ x: c.x, y: c.y, h: c.h })),
      guards: st.guards.map(g => ({ path: g.path, look: g.look, li: g.li, i: g.i, dir: g.dir, x: g.x, y: g.y, face: g.face, alive: g.alive })),
      lasers: st.lasers
    };
  }
  function key(st) {
    let s = st.px + ',' + st.py + '|';
    for (const b of st.blocks) s += b.x + ',' + b.y + ';';
    s += '|';
    for (const c of st.cars) s += c.x + ',' + c.y + ';';
    s += '|';
    for (const g of st.guards) s += g.alive ? g.i + ':' + g.dir + ':' + g.face + ':' + g.li + ';' : 'x;';
    for (let i = 0; i < st.glass.length; i++) if (st.glass[i]) s += 'g' + i;
    for (let i = 0; i < st.fuse.length; i++) if (st.fuse[i]) s += 'f' + i;
    return s;
  }

  const api = { parseLevel, makeState, step, sight, sees, beam, spotted, clone, key, DX, DY, GLASS_COST, dirOf, opaque };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TowerRules = api;
})(typeof window !== 'undefined' ? window : globalThis);

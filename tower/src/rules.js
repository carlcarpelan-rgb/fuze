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
//   lasers [{x,y,d,c,on}]  fire from a cell in direction d (0 up, 1 down, 2 left, 3 right) until something solid.
//                     c 'r' (default) red: touching it sets off the alarm. c 'g' green: harmless, it powers a receiver 'R'.
//                     on: a blink pattern, one entry per player step (1 on, 0 off); missing = always on.
//   Mirrors 'q' (/) and 'p' (\) are crates with a mirror on top: pushed like crates, and they turn any beam 90 degrees.
//   'R' receiver: fixed. While a green beam reaches it the lift works; until then the lift is locked.
//   'P' power switch: stepping onto it flips the power. Without power every laser is off, the lights are out and the lift is dead.
//   'L' light switch: on a dark floor (dark: 1) stepping onto it puts the lights on. Darkness only changes what you see.
//   's' shadow: a guard does not see you while you stand in it.
//   'V' vent, paired by vents [[x1,y1,x2,y2]]: step in and you come out of the other end.
//   'o' pressure plate, 'D' door: every door stands open while something weighs down a plate (you, a crate, a car,
//       a guard, even a knocked-out one). Step off and it shuts, unless something is standing in the doorway.
//   Glass is loud: step on it and every guard standing still within three squares turns to face the noise.
(function (root) {
  'use strict';
  const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
  const GLASS_COST = 3; // seconds of fuse per step on glass

  function parseLevel(lv) {
    const rows = lv.m.split('/'), h = rows.length, w = rows[0].length;
    const L = { w, h, blocks: [], walls: [], glass: [], fuses: [], goals: [], recv: [], power: [], lamps: [], shadow: [], vents: [], sx: 0, sy: 0, time: lv.t, theme: lv.theme | 0, name: lv.name || '', dark: !!lv.dark };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === '#') L.blocks.push({ x, y, m: 0 });
      else if (c === 'q') L.blocks.push({ x, y, m: 1 });
      else if (c === 'p') L.blocks.push({ x, y, m: 2 });
      else if (c === 'R') L.recv.push({ x, y });
      else if (c === 'P') L.power.push({ x, y });
      else if (c === 'L') L.lamps.push({ x, y });
      else if (c === 's') L.shadow.push({ x, y });
      else if (c === 'o') (L.plates || (L.plates = [])).push({ x, y });
      else if (c === 'D') (L.doors || (L.doors = [])).push({ x, y });
      else if (c === 'X') L.walls.push({ x, y });
      else if (c === 'g') L.glass.push({ x, y });
      else if (c === 'F') L.fuses.push({ x, y });
      else if (c === 'E') L.goals.push({ x, y, k: 'lift' });
      else if (c === 'B') L.goals.push({ x, y, k: 'bomb' });
      else if (c === 'S') { L.sx = x; L.sy = y; }
    }
    L.cars = (lv.cars || []).map(c => ({ x: c.x, y: c.y, h: c.h ? 1 : 0, v: c.v | 0 }));
    L.guards = (lv.guards || []).map(g => ({ path: g.path.map(p => ({ x: p[0], y: p[1] })), face: g.face, look: g.look || null }));
    L.lasers = (lv.lasers || []).map(l => ({ x: l.x, y: l.y, d: l.d, c: l.c || 'r', on: l.on || null }));
    L.ventPairs = (lv.vents || []).map(v => v.slice());
    return L;
  }

  function makeState(L) {
    const N = L.w * L.h;
    const st = {
      w: L.w, h: L.h, px: L.sx, py: L.sy,
      blockAt: new Int16Array(N), carAt: new Int16Array(N), wall: new Uint8Array(N), glass: new Uint8Array(N), fuse: new Uint8Array(N), goal: new Uint8Array(N),
      blocks: L.blocks.map(b => ({ x: b.x, y: b.y, m: b.m })),
      cars: L.cars.map(c => ({ x: c.x, y: c.y, h: c.h })),
      recv: new Uint8Array(N), sw: new Uint8Array(N), shadow: new Uint8Array(N), vent: new Int16Array(N).fill(-1), door: new Uint8Array(N),
      plates: (L.plates || []).map(o => o.y * L.w + o.x),
      n: 0, power: 1, lit: L.dark ? 0 : 1, hasPower: L.power.length > 0, hasRecv: L.recv.length > 0, dark: L.dark,
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
    L.recv.forEach(o => { st.recv[o.y * st.w + o.x] = 1; });
    L.power.forEach(o => { st.sw[o.y * st.w + o.x] = 1; });
    L.lamps.forEach(o => { st.sw[o.y * st.w + o.x] = 2; });
    L.shadow.forEach(o => { st.shadow[o.y * st.w + o.x] = 1; });
    (L.doors || []).forEach(o => { st.door[o.y * st.w + o.x] = 1; });
    L.ventPairs.forEach(v => { const a = v[1] * st.w + v[0], b = v[3] * st.w + v[2]; st.vent[a] = b; st.vent[b] = a; });
    return st;
  }
  function dirOf(dx, dy) { return dy < 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3; }
  const inB = (st, x, y) => x >= 0 && y >= 0 && x < st.w && y < st.h;
  function guardAt(st, x, y) { for (let i = 0; i < st.guards.length; i++) { const g = st.guards[i]; if (g.alive && g.x === x && g.y === y) return i; } return -1; }
  // is anything weighing down a pressure plate?
  function pressed(st) {
    for (const i of st.plates) {
      if (i === st.py * st.w + st.px || st.blockAt[i] || st.carAt[i]) return true;
      for (const g of st.guards) if (g.y * st.w + g.x === i) return true;
    }
    return false;
  }
  // a door that is shut right now (it cannot shut on something standing in it)
  function shut(st, i) {
    if (!st.door[i] || pressed(st)) return false;
    if (i === st.py * st.w + st.px || st.blockAt[i] || st.carAt[i]) return false;
    for (const g of st.guards) if (g.y * st.w + g.x === i) return false;
    return true;
  }
  // things you cannot see through
  const opaque = (st, i) => st.wall[i] || st.blockAt[i] || st.carAt[i] || st.goal[i] || st.recv[i] || (st.door[i] && shut(st, i));

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
  function sees(st, g, ci) { if (st.shadow[ci]) return false; const s = sight(st, g); for (let j = 0; j < s.length; j += 2) if (s[j] === ci) return true; return false; }
  // is this laser firing right now? (power, and its blink pattern at the current step)
  function laserOn(st, l, n) {
    if (st.hasPower && !st.power) return false;
    if (!l.on) return true;
    return !!l.on[(n == null ? st.n : n) % l.on.length];
  }
  // cells a laser beam passes through, turning at mirrors. Returns the cells; out.hit is a receiver it reaches, out.turns the corners.
  const REFL = [[3, 2, 1, 0], [2, 3, 0, 1]]; // '/' : up->right, down->left, left->down, right->up ; '\' : up->left, down->right, left->up, right->down
  function beam(st, l) {
    const out = []; out.hit = -1; out.turns = [];
    let x = l.x, y = l.y, d = l.d;
    for (let guard = 0; guard < st.w * st.h * 4; guard++) {
      x += DX[d]; y += DY[d];
      if (!inB(st, x, y)) break;
      const i = y * st.w + x;
      if (st.recv[i]) { out.hit = i; break; }
      const b = st.blockAt[i];
      if (b && st.blocks[b - 1].m) { out.push(i); const nd = REFL[st.blocks[b - 1].m - 1][d]; out.turns.push(i, d, nd); d = nd; continue; }
      if (st.wall[i] || b || st.carAt[i] || st.goal[i] || (st.door[i] && shut(st, i))) break;
      out.push(i);
    }
    return out;
  }
  function liftWorks(st) {
    if (st.hasPower && !st.power) return false;
    if (!st.hasRecv) return true;
    for (const l of st.lasers) if (l.c === 'g' && laserOn(st, l) && beam(st, l).hit >= 0) return true;
    return false;
  }
  function spotted(st) {
    const me = st.py * st.w + st.px;
    for (let k = 0; k < st.guards.length; k++) if (sees(st, st.guards[k], me)) return { by: 'guard', g: k };
    for (let k = 0; k < st.lasers.length; k++) { const l = st.lasers[k]; if (l.c !== 'g' && laserOn(st, l) && beam(st, l).includes(me)) return { by: 'laser', l: k }; }
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
      if (st.blockAt[c] || st.carAt[c] || st.wall[c] || (st.door[c] && shut(st, c)) || guardAt(st, p.x, p.y) >= 0) { g.dir = -g.dir; g.face = dirOf(-(p.x - g.x), -(p.y - g.y)); ev.push({ g: k, turn: true }); continue; }
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
    return !(st.wall[i] || st.blockAt[i] || st.carAt[i] || st.goal[i] || st.fuse[i] || st.recv[i] || st.sw[i] || st.vent[i] >= 0 || (st.door[i] && shut(st, i)) || guardAt(st, x, y) >= 0);
  }

  // One player step. Returns what happened, for the game's animation and the solver.
  function step(st, d) {
    const dx = DX[d], dy = DY[d], tx = st.px + dx, ty = st.py + dy;
    if (!inB(st, tx, ty)) return { t: 'blocked' };
    const ti = ty * st.w + tx;
    if (st.wall[ti] || st.recv[ti]) return { t: 'blocked', wall: true };
    if (st.door[ti] && shut(st, ti)) return { t: 'blocked', door: true };
    if (st.goal[ti] === 1 && d !== 0) return { t: 'blocked', lift: true }; // lift doors face the room
    if (st.goal[ti] === 1 && !liftWorks(st)) return { t: 'blocked', lift: true, locked: true };
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
    st.n++;
    if (st.glass[ti]) {
      res.cost = GLASS_COST;
      // the crunch is heard: guards standing still nearby turn towards it
      for (let k = 0; k < st.guards.length; k++) {
        const g = st.guards[k];
        if (!g.alive || g.path.length > 1 || Math.abs(g.x - tx) + Math.abs(g.y - ty) > 3) continue;
        const ddx = tx - g.x, ddy = ty - g.y, f = Math.abs(ddx) >= Math.abs(ddy) ? (ddx < 0 ? 2 : 3) : (ddy < 0 ? 0 : 1);
        if (f !== g.face) { g.face = f; g.look = null; (res.heard || (res.heard = [])).push(k); }
      }
    }
    if (st.fuse[ti]) { st.fuse[ti] = 0; res.refill = true; }
    if (st.sw[ti] === 1) { st.power ^= 1; res.power = st.power; }
    if (st.sw[ti] === 2 && !st.lit) { st.lit = 1; res.lights = true; }
    if (st.vent[ti] >= 0) {
      const o = st.vent[ti], ox = o % st.w, oy = (o - ox) / st.w;
      if (!st.blockAt[o] && !st.carAt[o] && guardAt(st, ox, oy) < 0) { res.vent = [tx, ty, ox, oy]; st.px = ox; st.py = oy; }
    }
    let s = spotted(st);
    if (!s) { s = moveGuards(st, res.ev); if (!s) s = spotted(st); } else res.early = true;
    if (s) { res.t = 'caught'; res.by = s.by; res.g = s.g; res.l = s.l; }
    return res;
  }

  function clone(st) {
    return {
      w: st.w, h: st.h, px: st.px, py: st.py,
      blockAt: st.blockAt.slice(), carAt: st.carAt.slice(), wall: st.wall, glass: st.glass.slice(), fuse: st.fuse.slice(), goal: st.goal,
      blocks: st.blocks.map(b => ({ x: b.x, y: b.y, m: b.m })),
      cars: st.cars.map(c => ({ x: c.x, y: c.y, h: c.h })),
      guards: st.guards.map(g => ({ path: g.path, look: g.look, li: g.li, i: g.i, dir: g.dir, x: g.x, y: g.y, face: g.face, alive: g.alive })),
      lasers: st.lasers,
      recv: st.recv, sw: st.sw, shadow: st.shadow, vent: st.vent, door: st.door, plates: st.plates,
      n: st.n, power: st.power, lit: st.lit, hasPower: st.hasPower, hasRecv: st.hasRecv, dark: st.dark
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
    if (st.hasPower) s += 'p' + st.power;
    // blinking lasers repeat; only the step count within their cycle matters
    let cyc = 1; for (const l of st.lasers) if (l.on) cyc = lcm(cyc, l.on.length);
    if (cyc > 1) s += 'n' + (st.n % cyc);
    return s;
  }
  function lcm(a, b) { const g = (x, y) => y ? g(y, x % y) : x; return a / g(a, b) * b;
  }

  const api = { parseLevel, makeState, step, sight, sees, beam, laserOn, liftWorks, spotted, clone, key, pressed, shut, DX, DY, GLASS_COST, dirOf, opaque };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TowerRules = api;
})(typeof window !== 'undefined' ? window : globalThis);

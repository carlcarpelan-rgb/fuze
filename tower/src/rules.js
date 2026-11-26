// Fuze Tower rules. Shared by the game (browser) and the solver (node).
// Map: '.' floor, '#' block (push one step), 'X' fixed wall, 'S' start, 'E' elevator (goal), 'B' bomb (goal),
//      'g' broken glass (walkable, costs fuse; a block pushed onto it crushes it), 'F' spare fuse (refills the fuse).
// Level extras: guards [{path:[[x,y],...]}] walk their path back and forth, one step per player step.
//               lasers [{x,y,d}] fire from a wall cell in direction d (0 up, 1 down, 2 left, 3 right).
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
    L.guards = (lv.guards || []).map(g => ({ path: g.path.map(p => ({ x: p[0], y: p[1] })), face: g.face }));
    L.lasers = (lv.lasers || []).map(l => ({ x: l.x, y: l.y, d: l.d }));
    return L;
  }

  function makeState(L) {
    const N = L.w * L.h;
    const st = {
      w: L.w, h: L.h, px: L.sx, py: L.sy,
      blockAt: new Int16Array(N), wall: new Uint8Array(N), glass: new Uint8Array(N), fuse: new Uint8Array(N), goal: new Uint8Array(N),
      blocks: L.blocks.map(b => ({ x: b.x, y: b.y })),
      guards: L.guards.map(g => {
        const p0 = g.path[0], p1 = g.path[1];
        let face = g.face != null ? g.face : 1;
        if (p1) face = dirOf(p1.x - p0.x, p1.y - p0.y);
        return { path: g.path, i: 0, dir: 1, x: p0.x, y: p0.y, face, alive: true };
      }),
      lasers: L.lasers
    };
    st.blocks.forEach((b, i) => { st.blockAt[b.y * st.w + b.x] = i + 1; });
    L.walls.forEach(o => { st.wall[o.y * st.w + o.x] = 1; });
    L.glass.forEach(o => { st.glass[o.y * st.w + o.x] = 1; });
    L.fuses.forEach(o => { st.fuse[o.y * st.w + o.x] = 1; });
    L.goals.forEach(o => { st.goal[o.y * st.w + o.x] = o.k === 'bomb' ? 2 : 1; });
    return st;
  }
  function dirOf(dx, dy) { return dy < 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3; }
  const inB = (st, x, y) => x >= 0 && y >= 0 && x < st.w && y < st.h;
  function guardAt(st, x, y) { for (let i = 0; i < st.guards.length; i++) { const g = st.guards[i]; if (g.alive && g.x === x && g.y === y) return i; } return -1; }

  // cells a guard can see: straight ahead until a block, wall or goal stops the view
  function sight(st, g) {
    const out = []; if (!g.alive) return out;
    let x = g.x, y = g.y;
    for (;;) {
      x += DX[g.face]; y += DY[g.face];
      if (!inB(st, x, y)) break;
      const i = y * st.w + x;
      if (st.wall[i] || st.blockAt[i] || st.goal[i]) break;
      out.push(i);
    }
    return out;
  }
  // cells a laser beam passes through
  function beam(st, l) {
    const out = []; let x = l.x, y = l.y;
    for (;;) {
      x += DX[l.d]; y += DY[l.d];
      if (!inB(st, x, y)) break;
      const i = y * st.w + x;
      if (st.wall[i] || st.blockAt[i]) break;
      out.push(i);
    }
    return out;
  }
  function spotted(st) {
    const me = st.py * st.w + st.px;
    for (let k = 0; k < st.guards.length; k++) if (sight(st, st.guards[k]).includes(me)) return { by: 'guard', g: k };
    for (let k = 0; k < st.lasers.length; k++) if (beam(st, st.lasers[k]).includes(me)) return { by: 'laser', l: k };
    return null;
  }

  // the guards take their step: along the path, turning around at either end or when something is in the way
  function moveGuards(st, ev) {
    for (let k = 0; k < st.guards.length; k++) {
      const g = st.guards[k]; if (!g.alive || g.path.length < 2) continue;
      let ni = g.i + g.dir;
      if (ni < 0 || ni >= g.path.length) { g.dir = -g.dir; ni = g.i + g.dir; const p = g.path[ni]; g.face = dirOf(p.x - g.x, p.y - g.y); ev.push({ g: k, turn: true }); continue; }
      const p = g.path[ni], c = p.y * st.w + p.x;
      if (st.blockAt[c] || st.wall[c] || guardAt(st, p.x, p.y) >= 0) { g.dir = -g.dir; g.face = dirOf(-(p.x - g.x), -(p.y - g.y)); ev.push({ g: k, turn: true }); continue; }
      const fx = g.x, fy = g.y;
      g.face = dirOf(p.x - g.x, p.y - g.y); g.x = p.x; g.y = p.y; g.i = ni;
      ev.push({ g: k, from: [fx, fy] });
      if (g.x === st.px && g.y === st.py) return { by: 'guard', g: k };
    }
    return null;
  }

  // One player step. Returns what happened, for the game's animation and the solver.
  function step(st, d) {
    const dx = DX[d], dy = DY[d], tx = st.px + dx, ty = st.py + dy;
    if (!inB(st, tx, ty)) return { t: 'blocked' };
    const ti = ty * st.w + tx;
    if (st.wall[ti]) return { t: 'blocked', wall: true };
    const res = { t: 'move', d, ev: [], cost: 0 };
    const gk = guardAt(st, tx, ty);
    if (gk >= 0) {
      const g = st.guards[gk];
      // walking into a guard from the front gets you caught; from the side or behind you knock him out
      if (g.face === dirOf(-dx, -dy)) { st.px = tx; st.py = ty; return { t: 'caught', by: 'guard', g: gk, d, ev: [] }; }
      g.alive = false; res.t = 'takedown'; res.g = gk;
    } else if (st.blockAt[ti]) {
      const bx = tx + dx, by = ty + dy;
      if (!inB(st, bx, by)) return { t: 'blocked', block: st.blockAt[ti] - 1 };
      const bi = by * st.w + bx;
      if (st.wall[bi] || st.blockAt[bi] || st.goal[bi] || st.fuse[bi] || guardAt(st, bx, by) >= 0) return { t: 'blocked', block: st.blockAt[ti] - 1 };
      const k = st.blockAt[ti] - 1;
      st.blockAt[bi] = k + 1; st.blockAt[ti] = 0; st.blocks[k].x = bx; st.blocks[k].y = by;
      if (st.glass[bi]) { st.glass[bi] = 0; res.crushed = bi; }
      res.t = 'push'; res.block = k;
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
      blockAt: st.blockAt.slice(), wall: st.wall, glass: st.glass.slice(), fuse: st.fuse.slice(), goal: st.goal,
      blocks: st.blocks.map(b => ({ x: b.x, y: b.y })),
      guards: st.guards.map(g => ({ path: g.path, i: g.i, dir: g.dir, x: g.x, y: g.y, face: g.face, alive: g.alive })),
      lasers: st.lasers
    };
  }
  function key(st) {
    let s = st.px + ',' + st.py + '|';
    for (const b of st.blocks) s += b.x + ',' + b.y + ';';
    s += '|';
    for (const g of st.guards) s += g.alive ? g.i + ':' + g.dir + ':' + g.face + ';' : 'x;';
    for (let i = 0; i < st.glass.length; i++) if (st.glass[i]) s += 'g' + i;
    for (let i = 0; i < st.fuse.length; i++) if (st.fuse[i]) s += 'f' + i;
    return s;
  }

  const api = { parseLevel, makeState, step, sight, beam, spotted, clone, key, DX, DY, GLASS_COST, dirOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TowerRules = api;
})(typeof window !== 'undefined' ? window : globalThis);

// Shared game rules. Used by the generator (node) and the game (browser).
// Cells: '.' floor, '#' wall (push one step), 'X' pillar (fixed), 'I' ice (slides until stopped),
//        'O' hole (blocks you; a block pushed into it fills it), 'B' bomb, 'S' start.
(function (root) {
  'use strict';

  function parseLevel(lv) {
    const rows = lv.m.split('/');
    const h = rows.length, w = rows[0].length;
    const walls = [], bombs = [], pillars = [], holes = [];
    let sx = 0, sy = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = rows[y][x];
        if (c === '#') walls.push({ x, y, k: 'w' });
        else if (c === 'I') walls.push({ x, y, k: 'i' });
        else if (c === 'X') pillars.push({ x, y });
        else if (c === 'O') holes.push({ x, y });
        else if (c === 'B') bombs.push({ x, y });
        else if (c === 'S') { sx = x; sy = y; }
      }
    }
    return { w, h, walls, bombs, pillars, holes, sx, sy, scroll: !!lv.s, vw: lv.v || w, tick: lv.s || 0, time: lv.t, par: lv.p };
  }

  function makeState(L) {
    const N = L.w * L.h;
    const st = {
      w: L.w, h: L.h, vw: L.vw, scroll: L.scroll,
      cam: L.scroll ? L.w - L.vw : 0,
      wallAt: new Int16Array(N), bombAt: new Uint8Array(N), pil: new Uint8Array(N), holeAt: new Int16Array(N),
      walls: L.walls.map(o => ({ x: o.x, y: o.y, k: o.k, gone: false })),
      bombs: L.bombs.map(o => ({ x: o.x, y: o.y })),
      pillars: L.pillars.map(o => ({ x: o.x, y: o.y })),
      holes: L.holes.map(o => ({ x: o.x, y: o.y, filled: false, by: -1 })),
      px: L.sx, py: L.sy
    };
    st.walls.forEach((o, i) => { st.wallAt[o.y * st.w + o.x] = i + 1; });
    st.bombs.forEach(o => { st.bombAt[o.y * st.w + o.x] = 1; });
    st.pillars.forEach(o => { st.pil[o.y * st.w + o.x] = 1; });
    st.holes.forEach((o, i) => { st.holeAt[o.y * st.w + o.x] = i + 1; });
    return st;
  }

  function inWin(st, x, y) {
    return y >= 0 && y < st.h && x >= st.cam && x < st.cam + st.vw;
  }

  // A cell a block cannot enter (holes are enterable: the block falls in)
  function solidFor(st, x, y) {
    if (!inWin(st, x, y)) return true;
    const i = y * st.w + x;
    return !!(st.wallAt[i] || st.pil[i] || st.bombAt[i]);
  }

  function fill(st, cell, wi) {
    const hi = st.holeAt[cell] - 1, ho = st.holes[hi], wl = st.walls[wi];
    ho.filled = true; ho.by = wi; st.holeAt[cell] = 0;
    wl.gone = true; wl.x = ho.x; wl.y = ho.y;
  }

  function tryMove(st, dx, dy) {
    const tx = st.px + dx, ty = st.py + dy;
    if (!inWin(st, tx, ty)) return { t: 'blocked' };
    const ti = ty * st.w + tx;
    if (st.pil[ti]) return { t: 'blocked', pillar: true };
    if (st.holeAt[ti]) return { t: 'blocked', hole: true };
    const wi = st.wallAt[ti];
    if (wi) {
      const wl = st.walls[wi - 1];
      if (wl.k === 'w') {
        const bx = tx + dx, by = ty + dy;
        if (solidFor(st, bx, by)) return { t: 'blocked', wall: wi - 1 };
        const bi = by * st.w + bx;
        st.wallAt[ti] = 0;
        let fell = false;
        if (st.holeAt[bi]) { fill(st, bi, wi - 1); fell = true; }
        else { st.wallAt[bi] = wi; wl.x = bx; wl.y = by; }
        st.px = tx; st.py = ty;
        return { t: 'push', wall: wi - 1, dist: 1, fell };
      }
      // ice: slides until something stops it, or drops into a hole
      let cx = tx, cy = ty, dist = 0, hole = -1;
      for (;;) {
        const nx = cx + dx, ny = cy + dy;
        if (solidFor(st, nx, ny)) break;
        const ni = ny * st.w + nx;
        dist++;
        if (st.holeAt[ni]) { hole = ni; break; }
        cx = nx; cy = ny;
      }
      if (dist === 0) return { t: 'blocked', wall: wi - 1 };
      st.wallAt[ti] = 0;
      if (hole >= 0) fill(st, hole, wi - 1);
      else { st.wallAt[cy * st.w + cx] = wi; wl.x = cx; wl.y = cy; }
      st.px = tx; st.py = ty;
      return { t: 'push', wall: wi - 1, dist, fell: hole >= 0, ice: true };
    }
    st.px = tx; st.py = ty;
    if (st.bombAt[ti]) return { t: 'win' };
    return { t: 'move' };
  }

  // Scrolling boards: the maze slides one column to the right. The player
  // keeps his place on screen unless a block is right behind him, in which
  // case it shoves him along. Shoved past the right edge = squashed.
  function tick(st) {
    if (st.cam <= 0) return { end: true };
    st.cam--;
    let carried = false;
    const li = st.py * st.w + st.px - 1;
    if (!st.wallAt[li] && !st.pil[li]) { st.px--; carried = true; }
    if (st.px - st.cam >= st.vw) return { dead: true, carried };
    if (st.bombAt[st.py * st.w + st.px]) return { win: true, carried };
    return { carried, end: st.cam === 0 };
  }

  const api = { parseLevel, makeState, tryMove, tick, inWin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);

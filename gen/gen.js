'use strict';
// Level generator + solvers. Every level it emits has a recorded solution
// that is replayed through the real game rules (see verify.js).
const fs = require('fs');
const path = require('path');

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0], DC = 'UDLR';

/* ---------------- normal mazes: push-BFS (Sokoban style) ---------------- */
function solveNormal(w, h, g0, bomb, start, cap) {
  const N = w * h;
  const seen = new Set();
  const mark = new Int32Array(N); let stamp = 0;
  const stack = new Int32Array(N);
  function flood(g, p) {
    stamp++; let n = 0, head = 0; stack[n++] = p; mark[p] = stamp;
    let min = p, win = -1;
    while (head < n) {
      const c = stack[head++]; const cx = c % w, cy = (c - cx) / w;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (mark[ni] === stamp || g[ni]) continue;
        if (bomb[ni]) { win = ni; continue; }
        mark[ni] = stamp; stack[n++] = ni; if (ni < min) min = ni;
      }
    }
    return { n, min, win };
  }
  function keyOf(g, min) {
    let s = '';
    for (let i = 0; i < N; i += 15) {
      let v = 0;
      for (let j = 0; j < 15 && i + j < N; j++) v |= g[i + j] << j;
      s += String.fromCharCode(v + 32);
    }
    return s + ',' + min;
  }
  const rootNode = { g: g0, p: start, par: null, from: -1, d: -1, depth: 0 };
  const f0 = flood(g0, start);
  if (f0.win >= 0) return { P: 0, node: rootNode, explored: 1 };
  seen.add(keyOf(g0, f0.min));
  const q = [rootNode]; let qi = 0;
  while (qi < q.length) {
    const nd = q[qi++];
    const f = flood(nd.g, nd.p);
    const region = Array.from(stack.subarray(0, f.n));
    for (const c of region) {
      const cx = c % w, cy = (c - cx) / w;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n1 = ny * w + nx;
        if (!nd.g[n1]) continue;
        const bx = nx + DX[d], by = ny + DY[d];
        if (bx < 0 || by < 0 || bx >= w || by >= h) continue;
        const b = by * w + bx;
        if (nd.g[b] || bomb[b]) continue;
        const g2 = nd.g.slice(); g2[n1] = 0; g2[b] = 1;
        const child = { g: g2, p: n1, par: nd, from: c, d, depth: nd.depth + 1 };
        const f2 = flood(g2, n1);
        if (f2.win >= 0) return { P: child.depth, node: child, explored: q.length };
        const k = keyOf(g2, f2.min);
        if (seen.has(k)) continue;
        seen.add(k); q.push(child);
        if (q.length > cap) return { overflow: true };
      }
    }
  }
  return null;
}

function walk(w, h, g, bomb, from, isGoal) {
  const N = w * h; const prev = new Int32Array(N).fill(-2); const pd = new Int8Array(N);
  const q = [from]; prev[from] = -1; let qi = 0, goal = -1;
  if (isGoal(from)) return '';
  while (qi < q.length && goal < 0) {
    const c = q[qi++]; const cx = c % w, cy = (c - cx) / w;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (prev[ni] !== -2 || g[ni]) continue;
      if (bomb[ni] && !isGoal(ni)) continue;
      prev[ni] = c; pd[ni] = d;
      if (isGoal(ni)) { goal = ni; break; }
      q.push(ni);
    }
  }
  if (goal < 0) throw new Error('walk failed');
  let s = ''; for (let c = goal; prev[c] >= 0; c = prev[c]) s = DC[pd[c]] + s;
  return s;
}

function movesOfNormal(w, h, g0, bomb, start, node) {
  const chain = []; for (let n = node; n && n.par; n = n.par) chain.push(n); chain.reverse();
  let g = g0, p = start, out = '';
  for (const n of chain) {
    out += walk(w, h, n.par.g, bomb, p, i => i === n.from) + DC[n.d];
    p = n.p; g = n.g;
  }
  out += walk(w, h, g, bomb, p, i => bomb[i] === 1);
  return out;
}

function baseGrid(rand, w, h, style, dens) {
  const g = new Uint8Array(w * h);
  const set = (x, y, v) => { g[y * w + x] = v; };
  if (style === 'noise') {
    for (let i = 0; i < w * h; i++) g[i] = rand() < dens ? 1 : 0;
  } else if (style === 'pillars') {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ox = x & 1, oy = y & 1;
      if (ox && oy) set(x, y, 1);
      else if (ox !== oy) set(x, y, rand() < dens * 1.1 ? 1 : 0);
      else set(x, y, rand() < 0.04 ? 1 : 0);
    }
  } else if (style === 'mirror') {
    const both = rand() < 0.4;
    for (let y = 0; y < h; y++) for (let x = 0; x <= (w - 1) / 2; x++) {
      const v = rand() < dens ? 1 : 0;
      set(x, y, v); set(w - 1 - x, y, v);
      if (both && y <= (h - 1) / 2) { set(x, h - 1 - y, v); set(w - 1 - x, h - 1 - y, v); }
    }
  } else if (style === 'bars') {
    const vert = rand() < 0.5;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const odd = vert ? (x & 1) : (y & 1);
      set(x, y, rand() < (odd ? 0.5 + dens * 0.7 : 0.1) ? 1 : 0);
    }
  }
  return g;
}

function evalNormal(w, h, g, bomb, start, cap) {
  const r = solveNormal(w, h, g, bomb, start, cap);
  if (!r || r.overflow) return null;
  const moves = movesOfNormal(w, h, g, bomb, start, r.node);
  return { P: r.P, moves, explored: r.explored };
}

function makeNormal(seed, w, h, targetP, nb, opts) {
  const rand = mulberry32(seed);
  const styles = ['pillars', 'noise', 'mirror', 'bars', 'pillars', 'mirror'];
  const cap = opts.cap || 15000;
  for (let attempt = 0; attempt < 40; attempt++) {
    const style = styles[Math.floor(rand() * styles.length)];
    const dens = 0.28 + rand() * 0.18;
    let g = baseGrid(rand, w, h, style, dens);
    const bomb = new Uint8Array(w * h);
    const sx = Math.floor(rand() * w), start = sx; // top row, like dropping in from the street
    g[start] = 0;
    let placed = 0, guard = 0;
    while (placed < nb && guard++ < 500) {
      const x = Math.floor(rand() * w), y = Math.floor(rand() * h);
      const i = y * w + x;
      if (i === start || bomb[i]) continue;
      if (Math.abs(x - sx) + y < (w + h) * 0.45) continue;
      bomb[i] = 1; g[i] = 0; placed++;
    }
    if (placed < nb) continue;
    let cur = evalNormal(w, h, g, bomb, start, cap);
    if (!cur) {
      // thin the grid until solvable
      for (let k = 0; k < 30 && !cur; k++) {
        const i = Math.floor(rand() * w * h);
        if (g[i]) { g[i] = 0; cur = evalNormal(w, h, g, bomb, start, cap); }
      }
      if (!cur) continue;
    }
    if (cur.P > targetP) continue;
    const score = r => r.P * 1000 + r.moves.length * 10 + Math.min(9, Math.floor(r.explored / 40));
    const maxWalls = Math.floor(w * h * (opts.maxDens || 0.5));
    let nw0 = 0; for (let i = 0; i < w * h; i++) nw0 += g[i];
    let stale = 0;
    for (let it = 0; it < opts.iters && stale < opts.stale; it++) {
      const g2 = g.slice();
      const op = rand();
      const i = Math.floor(rand() * w * h);
      if (i === start || bomb[i]) continue;
      if (op < 0.62) { if (g2[i]) continue; g2[i] = 1; }
      else if (op < 0.8) { if (!g2[i]) continue; g2[i] = 0; }
      else {
        const j = Math.floor(rand() * w * h);
        if (j === start || bomb[j] || g2[i] === g2[j]) continue;
        const t = g2[i]; g2[i] = g2[j]; g2[j] = t;
      }
      let nw2 = 0; for (let k = 0; k < w * h; k++) nw2 += g2[k];
      if (nw2 > maxWalls && nw2 >= nw0) continue;
      const r2 = evalNormal(w, h, g2, bomb, start, cap);
      if (!r2 || r2.P > targetP) { stale++; continue; }
      if (score(r2) >= score(cur)) {
        if (score(r2) > score(cur)) stale = 0; else stale++;
        g = g2; cur = r2; nw0 = nw2;
      } else stale++;
    }
    if (cur.P !== targetP) continue;
    let nw = 0; for (let i = 0; i < w * h; i++) nw += g[i];
    if (nw < w * h * 0.3) continue;
    if (cur.moves.length < (opts.minL || 0)) continue;
    return { w, h, g, bomb, start, P: cur.P, moves: cur.moves, explored: cur.explored, style };
  }
  return null;
}

function encode(w, h, g, bomb, start) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let s = '';
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      s += i === start ? 'S' : bomb[i] ? 'B' : g[i] ? '#' : '.';
    }
    rows.push(s);
  }
  return rows.join('/');
}

/* ---------------- scrolling mazes: time-layered search ---------------- */
function solveScroll(W, H, VW, g0, bomb, sx, sy, o) {
  const m = o.m, allowPush = o.push, cap = o.cap || 3000;
  let cam = W - VW;
  const keyOf = (s) => {
    let k = s.px + ',' + s.py + ',';
    for (let y = 0; y < H; y++) {
      let v = 0;
      for (let x = 0; x < VW; x++) v |= s.g[y * W + cam + x] << x;
      k += String.fromCharCode(v + 32);
    }
    return k;
  };
  const pathOf = (s) => { let out = ''; for (let n = s; n; n = n.par) out = n.mv + out; return out; };
  let layer = [{ g: g0, px: sx, py: sy, par: null, mv: '' }];
  for (;;) {
    const all = new Map();
    let frontier = [];
    for (const s of layer) { const e = { g: s.g, px: s.px, py: s.py, root: s, mv: '' }; all.set(keyOf(e), e); frontier.push(e); }
    const maxSteps = cam === 0 ? 400 : m;
    for (let step = 0; step < maxSteps && frontier.length; step++) {
      const next = [];
      for (const e of frontier) {
        for (let d = 0; d < 4; d++) {
          const tx = e.px + DX[d], ty = e.py + DY[d];
          if (ty < 0 || ty >= H || tx < cam || tx >= cam + VW) continue;
          const ti = ty * W + tx;
          let g = e.g;
          if (g[ti]) {
            if (!allowPush || g[ti] !== 1) continue;
            const bx = tx + DX[d], by = ty + DY[d];
            if (by < 0 || by >= H || bx < cam || bx >= cam + VW) continue;
            const bi = by * W + bx;
            if (g[bi] || bomb[bi]) continue;
            g = g.slice(); g[ti] = 0; g[bi] = 1;
          }
          const e2 = { g, px: tx, py: ty, root: e.root, mv: e.mv + DC[d] };
          if (bomb[ti]) return { moves: pathOf(e.root) + e2.mv };
          const k = keyOf(e2);
          if (all.has(k)) continue;
          all.set(k, e2); next.push(e2);
          if (all.size > cap * 6) break;
        }
      }
      frontier = next;
    }
    if (cam === 0) return null;
    cam--;
    const nl = new Map();
    for (const e of all.values()) {
      let px = e.px;
      if (!e.g[e.py * W + px - 1]) px--;
      if (px - cam >= VW) continue;
      const n = { g: e.g, px, py: e.py, par: e.root, mv: e.mv + 'T' };
      if (bomb[n.py * W + n.px]) return { moves: pathOf(n) };
      const k = keyOf(n);
      if (!nl.has(k)) nl.set(k, n);
    }
    layer = Array.from(nl.values());
    if (!layer.length) return null;
    if (layer.length > cap) { layer.sort((a, b) => (a.px - b.px)); layer.length = cap; }
  }
}

function makeScroll(seed, W, H, VW, o) {
  const rand = mulberry32(seed);
  for (let attempt = 0; attempt < 400; attempt++) {
    const g = new Uint8Array(W * H); const bomb = new Uint8Array(W * H);
    const set = (x, y) => { if (x >= 0 && x < W) g[y * W + x] = 1; };
    let x = W - VW - 1;
    // a few lead-in walls inside the first screen, left part
    for (let k = 0; k < 3; k++) set(W - VW + Math.floor(rand() * 3), Math.floor(rand() * H));
    while (x > 3) {
      const r = rand();
      if (r < o.curtain) {
        // a wall right across the tunnel; needs a push (free column behind it)
        const holes = rand() < o.holeChance ? 1 : 0;
        const hy = Math.floor(rand() * H);
        for (let y = 0; y < H; y++) if (!(holes && y === hy)) set(x, y);
        x -= 2;
        if (rand() < 0.5) x -= 1;
      } else if (r < o.curtain + 0.22) {
        // comb: staggered teeth
        const n = 2 + Math.floor(rand() * 2);
        for (let k = 0; k < n; k++) {
          for (let y = (k & 1); y < H; y += 2) if (rand() < 0.9) set(x, y);
          x -= 2;
        }
      } else {
        const wd = 3 + Math.floor(rand() * 4);
        for (let k = 0; k < wd; k++) {
          for (let y = 0; y < H; y++) if (rand() < o.dens) set(x, y);
          x--;
        }
        if (rand() < 0.4) x--;
      }
    }
    // goal area
    for (let y = 0; y < H; y++) for (let xx = 0; xx < 3; xx++) g[y * W + xx] = 0;
    if (o.vsym) for (let y = 0; y < (H >> 1); y++) for (let xx = 0; xx < W; xx++) g[(H - 1 - y) * W + xx] = g[y * W + xx];
    const by = o.vsym ? (H - 1) / 2 : Math.floor(rand() * H);
    bomb[by * W] = 1;
    if (rand() < 0.7) { for (let y = 0; y < H; y++) if (rand() < 0.55) g[y * W + 2] = 1; if (o.vsym) for (let y = 0; y < (H >> 1); y++) g[(H - 1 - y) * W + 2] = g[y * W + 2]; }
    const sx = W - VW + 5, sy = (H - 1) / 2;
    g[sy * W + sx] = 0; g[sy * W + sx - 1] = 0;
    const res = solveScroll(W, H, VW, g, bomb, sx, sy, { m: 1, push: true, cap: o.cap || 2500 });
    if (!res) continue;
    if (o.needPush) {
      const np = solveScroll(W, H, VW, g, bomb, sx, sy, { m: 3, push: false, cap: 4000 });
      if (np) continue;
    }
    return { w: W, h: H, vw: VW, g, bomb, start: sy * W + sx, moves: res.moves, attempt };
  }
  return null;
}

module.exports = { mulberry32, solveNormal, makeNormal, makeScroll, solveScroll, encode, evalNormal };

/* ---------------- build the campaign ---------------- */
if (require.main === module) {
  const WORLDS = 10;
  const sizes = [[9, 7], [9, 7], [11, 7], [11, 7], [11, 9], [11, 9], [13, 9], [13, 9], [13, 9], [13, 9]];
  const pFor = d => d < 3 ? 0 : d < 12 ? 1 : d < 26 ? 2 : d < 42 ? 3 : d < 58 ? 4 : d < 74 ? 5 : d < 88 ? 6 : 7;
  const levels = []; const sols = [];
  const t0 = Date.now();
  for (let wi = 0; wi < WORLDS; wi++) {
    let mazeNo = 0;
    for (let li = 0; li < 12; li++) {
      const isScroll = li === 5 || li === 11;
      const seedBase = 7000 + wi * 1000 + li * 37;
      if (isScroll) {
        const second = li === 11;
        const W = (second ? 44 : 32) + wi * (second ? 4 : 3);
        const o = {
          dens: 0.21 + wi * 0.015, curtain: wi === 0 && !second ? 0.08 : 0.16 + wi * 0.014,
          holeChance: Math.max(0.15, 0.6 - wi * 0.05), needPush: !(wi === 0 && !second)
        };
        let lv = null, s = seedBase;
        while (!lv) lv = makeScroll(s++, W, 7, 11, o);
        const tickMs = Math.round(820 - wi * 33 - (second ? 20 : 0));
        const ticks = W - 11;
        const time = Math.ceil(ticks * tickMs / 1000 + 12);
        levels.push({ m: encode(lv.w, lv.h, lv.g, lv.bomb, lv.start), t: time, s: tickMs, v: 11 });
        sols.push(lv.moves);
        console.error(`W${wi + 1} L${li + 1} scroll W=${W} tick=${tickMs} tries=${lv.attempt} sol=${lv.moves.length}`);
      } else {
        const d = wi * 10 + mazeNo; mazeNo++;
        const [w, h] = sizes[wi];
        let P = pFor(d);
        const nb = wi < 3 ? 1 : wi < 6 ? (mazeNo % 3 === 0 ? 2 : 1) : (mazeNo % 3 === 0 ? 3 : 2);
        let best = null, s = seedBase;
        const want = 2;
        let got = 0, tries = 0;
        while (got < want && tries < 30) {
          const lv = makeNormal(s++ * 13 + 5, w, h, P, nb, { iters: 420, stale: 150, cap: 12000, maxDens: 0.42 + ((wi * 7 + li * 3) % 5) * 0.02, minL: w + h });
          tries++;
          if (!lv) { if (tries > 12 && !best && P > 0) { P--; tries = 0; } continue; }
          got++;
          const q = lv.explored + lv.moves.length * 3;
          if (!best || q > best.q) { best = lv; best.q = q; }
        }
        if (!best) throw new Error('no level for ' + wi + ' ' + li);
        const L = best.moves.length;
        const time = Math.max(15, Math.min(80, Math.ceil(8 + L * 0.5 + best.P * 3.5)));
        levels.push({ m: encode(best.w, best.h, best.g, best.bomb, best.start), t: time, p: best.P });
        sols.push(best.moves);
        console.error(`W${wi + 1} L${li + 1} maze ${w}x${h} P=${best.P} (want ${pFor(d)}) L=${L} t=${time} expl=${best.explored} ${best.style} [${((Date.now() - t0) / 1000).toFixed(0)}s]`);
      }
    }
  }
  fs.writeFileSync(path.join(__dirname, 'levels.json'), JSON.stringify(levels));
  fs.writeFileSync(path.join(__dirname, 'solutions.json'), JSON.stringify(sols));
  console.error('done', levels.length, 'levels');
}

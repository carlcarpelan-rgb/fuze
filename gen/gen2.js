'use strict';
// Second-generation maze generator: optimises for puzzles that need thought.
// Difficulty is measured with an optimal A* solver:
//   P   = fewest pushes that solve the board
//   h0  = walls standing on the cheapest straight-through route (the "obvious" push count)
//   gap = P - h0 = pushes you only find by planning (clearing room, going round the back)
const G1 = require('./gen.js');
const { mulberry32 } = G1;
const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0], DC = 'UDLR';

function makeSolver(w, h) {
  const N = w * h;
  const mark = new Int32Array(N); let stamp = 0;
  const stack = new Int32Array(N * 4);
  const dist = new Int16Array(N);
  const nb = new Int16Array(N * 4);
  for (let i = 0; i < N; i++) { const x = i % w, y = (i - x) / w; for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; nb[i * 4 + d] = (nx < 0 || ny < 0 || nx >= w || ny >= h) ? -1 : ny * w + nx; } }
  let rn = 0, rmin = 0, rwin = false;
  function flood(g, bomb, p) {
    stamp++; let n = 0, head = 0; stack[n++] = p; mark[p] = stamp; let min = p; rwin = false;
    while (head < n) {
      const c = stack[head++];
      for (let d = 0; d < 4; d++) { const ni = nb[c * 4 + d]; if (ni < 0 || mark[ni] === stamp || g[ni]) continue; if (bomb[ni]) { rwin = true; continue; } mark[ni] = stamp; stack[n++] = ni; if (ni < min) min = ni; }
    }
    rn = n; rmin = min;
  }
  const dq = new Int32Array(N * 8);
  function hOf(g, bomb) { // uses region currently in stack[0..rn)
    dist.fill(32000);
    let head = N * 4, tail = N * 4;
    for (let i = 0; i < rn; i++) { dist[stack[i]] = 0; dq[tail++] = stack[i]; }
    let best = 32000;
    while (head < tail) {
      const c = dq[head++], dc = dist[c];
      if (dc >= best) continue;
      for (let d = 0; d < 4; d++) {
        const ni = nb[c * 4 + d]; if (ni < 0) continue;
        if (bomb[ni]) { if (dc < best) best = dc; continue; }
        const nd = dc + g[ni];
        if (nd < dist[ni]) { dist[ni] = nd; if (g[ni]) dq[tail++] = ni; else dq[--head] = ni; }
      }
    }
    return best;
  }
  function keyOf(g, min) { let s = ''; for (let i = 0; i < N; i += 15) { let v = 0; for (let j = 0; j < 15 && i + j < N; j++) v |= g[i + j] << j; s += String.fromCharCode(v + 32); } return s + String.fromCharCode(min + 32); }
  function solve(g0, bomb, start, cap) {
    flood(g0, bomb, start);
    const root = { g: g0, p: start, par: null, from: -1, d: -1, depth: 0, win: rwin, key: keyOf(g0, rmin) };
    const h0 = rwin ? 0 : hOf(g0, bomb);
    if (h0 >= 32000) return null;
    const best = new Map(); best.set(root.key, 0);
    const buckets = []; const put = (n, f) => { (buckets[f] || (buckets[f] = [])).push(n); };
    put(root, h0);
    let f = h0, expanded = 0;
    const region = new Int32Array(N);
    for (;;) {
      while (f < buckets.length && (!buckets[f] || !buckets[f].length)) f++;
      if (f >= buckets.length) return null;
      const nd = buckets[f].pop();
      if (best.get(nd.key) < nd.depth) continue;
      if (nd.win) return { P: nd.depth, node: nd, expanded, h0 };
      if (++expanded > cap) return { overflow: true, h0 };
      flood(nd.g, bomb, nd.p);
      const n = rn; for (let i = 0; i < n; i++) region[i] = stack[i];
      for (let i = 0; i < n; i++) {
        const c = region[i];
        for (let d = 0; d < 4; d++) {
          const n1 = nb[c * 4 + d]; if (n1 < 0 || !nd.g[n1]) continue;
          const b = nb[n1 * 4 + d]; if (b < 0 || nd.g[b] || bomb[b]) continue;
          const g2 = nd.g.slice(); g2[n1] = 0; g2[b] = 1;
          flood(g2, bomb, n1);
          const key = keyOf(g2, rmin), depth = nd.depth + 1;
          const old = best.get(key); if (old !== undefined && old <= depth) continue;
          const hh = rwin ? 0 : hOf(g2, bomb);
          if (hh >= 32000) continue;
          best.set(key, depth);
          put({ g: g2, p: n1, par: nd, from: c, d, depth, win: rwin, key }, depth + hh);
          if (depth + hh < f) f = depth + hh;
        }
      }
    }
  }
  return { solve };
}

const solvers = {};
function evalMaze(w, h, g, bomb, start, cap) {
  const S = solvers[w + 'x' + h] || (solvers[w + 'x' + h] = makeSolver(w, h));
  const r = S.solve(g, bomb, start, cap);
  if (!r || r.overflow) return null;
  // reconstruct moves, count distinct walls pushed
  const chain = []; for (let n = r.node; n && n.par; n = n.par) chain.push(n); chain.reverse();
  let p = start, cur = g, moves = '';
  const id = new Int16Array(w * h); let k = 0; for (let i = 0; i < w * h; i++) id[i] = g[i] ? ++k : 0;
  const used = new Set(); const ids = id.slice();
  for (const n of chain) {
    moves += walk(w, h, n.par.g, bomb, p, i => i === n.from) + DC[n.d];
    const wallCell = n.p, to = wallCell + DX[n.d] + DY[n.d] * w;
    used.add(ids[wallCell]); ids[to] = ids[wallCell]; ids[wallCell] = 0;
    p = n.p; cur = n.g;
  }
  moves += walk(w, h, cur, bomb, p, i => bomb[i] === 1);
  return { P: r.P, h0: r.h0, gap: r.P - r.h0, moves, expanded: r.expanded, distinct: used.size };
}
function walk(w, h, g, bomb, from, isGoal) {
  const N = w * h, prev = new Int32Array(N).fill(-2), pd = new Int8Array(N), q = [from]; prev[from] = -1; let qi = 0, goal = -1;
  if (isGoal(from)) return '';
  while (qi < q.length && goal < 0) {
    const c = q[qi++], cx = c % w, cy = (c - cx) / w;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d], ny = cy + DY[d]; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx; if (prev[ni] !== -2 || g[ni]) continue; if (bomb[ni] && !isGoal(ni)) continue;
      prev[ni] = c; pd[ni] = d; if (isGoal(ni)) { goal = ni; break; } q.push(ni);
    }
  }
  if (goal < 0) throw new Error('walk failed');
  let s = ''; for (let c = goal; prev[c] >= 0; c = prev[c]) s = DC[pd[c]] + s; return s;
}

function climb(seed, w, h, nb, o) {
  const rand = mulberry32(seed), N = w * h;
  const score = r => r.P * 10 + r.gap * o.gapW + r.distinct * 4 + Math.min(r.moves.length, o.maxL || 90) * 0.35;
  for (let attempt = 0; attempt < 30; attempt++) {
    const dens = 0.3 + rand() * 0.15;
    let g = new Uint8Array(N);
    for (let i = 0; i < N; i++) g[i] = rand() < dens ? 1 : 0;
    const bomb = new Uint8Array(N);
    // start and bombs far apart: opposite corners/edges
    const corner = Math.floor(rand() * 4);
    const sx = corner & 1 ? w - 1 - Math.floor(rand() * 2) : Math.floor(rand() * 2), start = sx; g[start] = 0;
    let placed = 0, guard = 0;
    while (placed < nb && guard++ < 800) {
      const x = Math.floor(rand() * w), y = Math.floor(rand() * h), i = y * w + x;
      if (i === start || bomb[i]) continue;
      if (Math.abs(x - sx) + y < (w + h) * (o.far || 0.62)) continue;
      bomb[i] = 1; g[i] = 0; placed++;
    }
    if (placed < nb) continue;
    let cur = evalMaze(w, h, g, bomb, start, o.cap);
    for (let k = 0; k < 40 && !cur; k++) { const i = Math.floor(rand() * N); if (g[i]) { g[i] = 0; cur = evalMaze(w, h, g, bomb, start, o.cap); } }
    for (let k = 0; k < 80 && cur && (cur.P > o.Pmax || cur.gap > o.gapMax); k++) { const i = Math.floor(rand() * N); if (g[i]) { g[i] = 0; cur = evalMaze(w, h, g, bomb, start, o.cap); } }
    if (!cur || cur.P > o.Pmax || cur.gap > o.gapMax) continue;
    let nw = 0; for (let i = 0; i < N; i++) nw += g[i];
    const maxWalls = Math.floor(N * o.maxDens);
    let stale = 0;
    for (let it = 0; it < o.iters && stale < o.stale; it++) {
      if (cur.P >= o.P && cur.gap >= o.gap && cur.moves.length >= o.minL) break;
      const g2 = g.slice(); let nw2 = nw;
      const nm = rand() < 0.3 ? 2 : 1; let ok = true;
      for (let m = 0; m < nm; m++) {
        const op = rand(), i = Math.floor(rand() * N);
        if (i === start || bomb[i]) { ok = false; break; }
        if (op < 0.5) { if (g2[i]) { ok = false; break; } g2[i] = 1; nw2++; }
        else if (op < 0.72) { if (!g2[i]) { ok = false; break; } g2[i] = 0; nw2--; }
        else { // shift a wall to a neighbouring cell
          if (!g2[i]) { ok = false; break; }
          const d = Math.floor(rand() * 4), x = i % w + DX[d], y = Math.floor(i / w) + DY[d];
          if (x < 0 || y < 0 || x >= w || y >= h) { ok = false; break; }
          const j = y * w + x; if (g2[j] || j === start || bomb[j]) { ok = false; break; }
          g2[i] = 0; g2[j] = 1;
        }
      }
      if (!ok) continue;
      if (nw2 > maxWalls && nw2 > nw) continue;
      const r2 = evalMaze(w, h, g2, bomb, start, o.cap);
      if (!r2 || r2.P > o.Pmax || r2.gap > o.gapMax) { stale++; continue; }
      const s2 = score(r2), s1 = score(cur);
      if (s2 >= s1) { if (s2 > s1) stale = 0; else stale++; g = g2; cur = r2; nw = nw2; } else stale++;
    }
    if (o.loose ? (cur.P < o.Pfloor || cur.moves.length < o.minL) : (cur.P < o.P || cur.gap < o.gap || cur.moves.length < o.minL)) continue;
    return Object.assign({ w, h, g, bomb, start }, cur);
  }
  return null;
}
module.exports = { evalMaze, climb, makeSolver };


if (require.main === module && process.argv[2] === 'run') {
  const fs = require('fs'), par = +process.argv[3], fast = process.argv[4] === 'fast';
  const have = {}; if (fast) for (const f of ['part0.json', 'part1.json', 'part2.json', 'part3.json']) for (const x of (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [])) have[x.wi] = (have[x.wi] || 0) + 1;
  let cnt = 0;
  const sizes = [[9, 7], [11, 7], [11, 9], [11, 9], [13, 9], [13, 9], [13, 9], [13, 9], [13, 9], [13, 9]];
  const out = [];
  const t0 = Date.now();
  for (let wi = fast ? 0 : par; wi < 10; wi += fast ? 1 : 2) {
    const [w, h] = sizes[wi];
    for (let j = 0; j < 10; j++) {
      if (fast) { if (j < (have[wi] || 0)) continue; if ((cnt++) % 2 !== par) continue; }
      const d = wi * 10 + j;
      const P = Math.round(2 + d * 0.165), gap = Math.floor(d / 11);
      const nb = wi < 4 ? 1 : wi < 7 ? (j % 3 === 2 ? 2 : 1) : (j % 3 === 2 ? 3 : 2);
      const o = { P, Pmax: P + (fast ? 4 : 2), gap, gapMax: gap + (fast ? 4 : 2), gapW: 22, cap: fast ? 4500 : 40000, iters: fast ? 500 : 1500, stale: fast ? 160 : 400, maxDens: 0.5, minL: Math.round((w + h) * 1.2 + d * 0.22), maxL: 100, far: 0.6 };
      let lv = null, s = 50000 + d * 101;
      while (!lv) lv = climb(s++, w, h, nb, o);
      const L = lv.moves.length;
      const time = Math.min(180, Math.ceil(15 + L * 0.7 + lv.P * 3 + lv.gap * 4));
      out.push({ wi, D: lv.P + 1.5 * lv.gap + 1.5 * Math.log2(lv.expanded + 1), lv: { m: G1.encode(w, h, lv.g, lv.bomb, lv.start), t: time, p: lv.P }, sol: lv.moves, P: lv.P, gap: lv.gap, L, distinct: lv.distinct, exp: lv.expanded });
      console.error(`W${wi + 1} #${j + 1} ${w}x${h} P=${lv.P} gap=${lv.gap} distinct=${lv.distinct} L=${L} exp=${lv.expanded} t=${time} [${((Date.now() - t0) / 1000).toFixed(0)}s]`);
      fs.writeFileSync(`part${fast ? par + 4 : par}.json`, JSON.stringify(out));
    }
  }
  console.error('part done');
}

if (require.main === module && process.argv[2] === 'pool') {
  const fs = require('fs'), par = +process.argv[3], count = +process.argv[4];
  const out = [], t0 = Date.now();
  for (let k = 0; k < count; k++) {
    const P = 9 + (k * 3 + par) % 9, gap = 5 + (k * 5 + par) % 7, nb = 1 + (k + par) % 3;
    const o = { loose: true, Pfloor: 9, P, Pmax: P + 6, gap, gapMax: 30, gapW: 22, cap: 4500, iters: 450, stale: 170, maxDens: 0.5, minL: 34, maxL: 100, far: 0.6 };
    let lv = null, s = 80000 + par * 7919 + k * 131;
    while (!lv) lv = climb(s++, 13, 9, nb, o);
    const L = lv.moves.length, time = Math.min(180, Math.ceil(15 + L * 0.7 + lv.P * 3 + lv.gap * 4));
    out.push({ wi: -1, D: lv.P + 1.5 * lv.gap + 1.5 * Math.log2(lv.expanded + 1), lv: { m: G1.encode(13, 9, lv.g, lv.bomb, lv.start), t: time, p: lv.P }, sol: lv.moves, P: lv.P, gap: lv.gap, L, distinct: lv.distinct, exp: lv.expanded });
    console.error(`pool ${k + 1}/${count} P=${lv.P} gap=${lv.gap} distinct=${lv.distinct} L=${L} exp=${lv.expanded} [${((Date.now() - t0) / 1000).toFixed(0)}s]`);
    fs.writeFileSync(`pool${par}.json`, JSON.stringify(out));
  }
}
if (require.main === module && process.argv[2] === 'exp') {
  for (const [w, h, P, gap, nb] of [[9, 7, 3, 1, 1], [11, 7, 6, 2, 1], [11, 9, 9, 3, 1], [13, 9, 12, 4, 2], [13, 9, 16, 6, 2]]) {
    const t = Date.now();
    const lv = climb(4242 + P, w, h, nb, { P, gap, gapW: 22, cap: 30000, iters: 3000, stale: 500, maxDens: 0.5, minL: (w + h) * 1.6 });
    console.log(w, h, 'want P', P, 'gap', gap, lv ? `-> P=${lv.P} h0=${lv.h0} gap=${lv.gap} distinct=${lv.distinct} L=${lv.moves.length} exp=${lv.expanded}` : 'FAIL', Date.now() - t, 'ms');
    if (lv) console.log(G1.encode(w, h, lv.g, lv.bomb, lv.start).split('/').join('\n'));
  }
}

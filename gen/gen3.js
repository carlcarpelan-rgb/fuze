'use strict';
// Third-generation generator: symmetric boards, pillars, ice and holes.
// Cells: 0 floor, 1 wall, 2 pillar, 3 ice, 4 hole.
const fs = require('fs');
const { mulberry32 } = require('./gen.js');
const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0], DC = 'UDLR';
const CH = '.#XIO';

/* ---------------- optimal solver (A*, pushes as cost) ---------------- */
function makeSolver(w, h) {
  const N = w * h;
  const mark = new Int32Array(N); let stamp = 0;
  const stack = new Int32Array(N);
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
  function hOf(g, bomb) {
    // fewest blocks standing on any route to a bomb; holes count as free (one push can fill one)
    dist.fill(32000);
    let head = N * 4, tail = N * 4;
    for (let i = 0; i < rn; i++) { dist[stack[i]] = 0; dq[tail++] = stack[i]; }
    let best = 32000;
    while (head < tail) {
      const c = dq[head++], dc = dist[c];
      if (dc >= best) continue;
      for (let d = 0; d < 4; d++) {
        const ni = nb[c * 4 + d]; if (ni < 0) continue;
        const v = g[ni]; if (v === 2) continue;
        if (bomb[ni]) { if (dc < best) best = dc; continue; }
        const cost = (v === 1 || v === 3) ? 1 : 0, nd = dc + cost;
        if (nd < dist[ni]) { dist[ni] = nd; if (cost) dq[tail++] = ni; else dq[--head] = ni; }
      }
    }
    return best;
  }
  function keyOf(g, min) { let s = ''; for (let i = 0; i < N; i += 2) s += String.fromCharCode(32 + g[i] + 8 * (i + 1 < N ? g[i + 1] : 0)); return s + String.fromCharCode(min + 32); }
  // returns new grid or null; also sets lastFell / lastIce
  let lastFell = false, lastIce = false, lastTo = -1;
  function push(g, bomb, n1, d) {
    const v = g[n1];
    lastFell = false; lastIce = v === 3; lastTo = -1;
    const solid = c => c < 0 || g[c] === 1 || g[c] === 2 || g[c] === 3 || bomb[c];
    if (v === 1) {
      const b = nb[n1 * 4 + d]; if (solid(b)) return null;
      const g2 = g.slice(); g2[n1] = 0;
      if (g[b] === 4) { g2[b] = 0; lastFell = true; } else g2[b] = 1;
      lastTo = b; return g2;
    }
    if (v === 3) {
      let pos = n1, moved = 0, fall = -1;
      for (;;) { const nx = nb[pos * 4 + d]; if (solid(nx)) break; moved++; if (g[nx] === 4) { fall = nx; break; } pos = nx; }
      if (!moved) return null;
      const g2 = g.slice(); g2[n1] = 0;
      if (fall >= 0) { g2[fall] = 0; lastFell = true; lastTo = fall; } else { g2[pos] = 3; lastTo = pos; }
      return g2;
    }
    return null;
  }
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
          const n1 = nb[c * 4 + d]; if (n1 < 0) continue;
          const v = nd.g[n1]; if (v !== 1 && v !== 3) continue;
          const g2 = push(nd.g, bomb, n1, d); if (!g2) continue;
          const fell = lastFell, ice = lastIce;
          flood(g2, bomb, n1);
          const key = keyOf(g2, rmin), depth = nd.depth + 1;
          const old = best.get(key); if (old !== undefined && old <= depth) continue;
          const hh = rwin ? 0 : hOf(g2, bomb);
          if (hh >= 32000) continue;
          best.set(key, depth);
          put({ g: g2, p: n1, par: nd, from: c, d, depth, win: rwin, key, fell, ice }, depth + hh);
          if (depth + hh < f) f = depth + hh;
        }
      }
    }
  }
  return { solve };
}

const solvers = {};
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
function evalMaze(w, h, g, bomb, start, cap) {
  const S = solvers[w + 'x' + h] || (solvers[w + 'x' + h] = makeSolver(w, h));
  const r = S.solve(g, bomb, start, cap);
  if (!r || r.overflow) return null;
  const chain = []; for (let n = r.node; n && n.par; n = n.par) chain.push(n); chain.reverse();
  let p = start, cur = g, moves = '', fills = 0, ices = 0;
  const ids = new Int16Array(w * h); let k = 0; for (let i = 0; i < w * h; i++) ids[i] = (g[i] === 1 || g[i] === 3) ? ++k : 0;
  const used = new Set();
  for (const n of chain) {
    moves += walk(w, h, n.par.g, bomb, p, i => i === n.from) + DC[n.d];
    const wc = n.p; used.add(ids[wc]);
    if (n.fell) fills++; if (n.ice) ices++;
    // move id to wherever the block ended up
    let to = -1; for (let i = 0; i < w * h; i++) if ((n.g[i] === 1 || n.g[i] === 3) && !(n.par.g[i] === 1 || n.par.g[i] === 3)) to = i;
    if (to >= 0) ids[to] = ids[wc]; ids[wc] = 0;
    p = n.p; cur = n.g;
  }
  moves += walk(w, h, cur, bomb, p, i => bomb[i] === 1);
  return { P: r.P, h0: r.h0, gap: r.P - r.h0, moves, expanded: r.expanded, distinct: used.size, fills, ices };
}

/* ---------------- symmetry ---------------- */
function orbits(w, h, mode) {
  const N = w * h, id = new Int32Array(N).fill(-1), list = [];
  const img = (x, y) => {
    const out = [[x, y]];
    if (mode === 'lr' || mode === 'quad') out.push([w - 1 - x, y]);
    if (mode === 'quad') out.push([x, h - 1 - y], [w - 1 - x, h - 1 - y]);
    if (mode === 'rot') out.push([w - 1 - x, h - 1 - y]);
    return out;
  };
  for (let i = 0; i < N; i++) {
    if (id[i] >= 0) continue;
    const x = i % w, y = (i - x) / w;
    const cells = [...new Set(img(x, y).map(([a, b]) => b * w + a))];
    cells.forEach(c => { id[c] = list.length; });
    list.push(cells);
  }
  return { id, list };
}

function encode(w, h, g, bomb, start) {
  const rows = [];
  for (let y = 0; y < h; y++) { let s = ''; for (let x = 0; x < w; x++) { const i = y * w + x; s += i === start ? 'S' : bomb[i] ? 'B' : CH[g[i]]; } rows.push(s); }
  return rows.join('/');
}

/* ---------------- one level ---------------- */
function build(seed, w, h, o) {
  const rand = mulberry32(seed), N = w * h, cx = (w - 1) >> 1;
  const pick = a => a[Math.floor(rand() * a.length)];
  const nbomb = o.nb;
  let mode = o.mode || (nbomb > 1 ? 'lr' : pick(['lr', 'lr', 'lr', 'rot', 'quad']));
  const O = orbits(w, h, mode);
  const bomb = new Uint8Array(N); let start;
  if (mode === 'rot') {
    const sx = Math.floor(rand() * 3); start = sx;
    bomb[(h - 1) * w + (w - 1 - sx)] = 1;
  } else {
    start = cx;
    if (nbomb === 1) bomb[(h - 1 - (mode === 'quad' ? 0 : Math.floor(rand() * 2))) * w + cx] = 1;
    else {
      const bx = Math.floor(rand() * (cx - 1)), by = h - 1 - Math.floor(rand() * 3);
      bomb[by * w + bx] = 1; bomb[by * w + (w - 1 - bx)] = 1;
      if (nbomb === 3) bomb[(h - 1) * w + cx] = 1;
    }
  }
  const fixed = new Uint8Array(O.list.length);
  for (let i = 0; i < N; i++) if (i === start || bomb[i]) fixed[O.id[i]] = 1;
  // keep a little room around start and bombs
  const g = new Uint8Array(N);
  const setOrb = (oi, v) => { for (const c of O.list[oi]) g[c] = v; };
  // pillar motif
  if (o.pillars) {
    const motif = pick(['lattice', 'lattice', 'ring', 'cols', 'diag', 'sparse']);
    for (let oi = 0; oi < O.list.length; oi++) {
      if (fixed[oi]) continue;
      const c = O.list[oi][0], x = c % w, y = (c - x) / w;
      let on = false;
      if (motif === 'lattice') on = (x % 2 === 1 && y % 2 === 1 && rand() < 0.55);
      else if (motif === 'ring') on = ((x === 2 || x === w - 3) && y >= 2 && y <= h - 3 && y % 2 === 0) || ((y === 2 || y === h - 3) && x >= 2 && x <= w - 3 && x % 2 === 0 && rand() < .8);
      else if (motif === 'cols') on = (x % 4 === 1 || x % 4 === 3 && false) && y % 3 !== 1 && rand() < .6;
      else if (motif === 'diag') on = ((x + y) % 4 === 0) && rand() < .45;
      else on = rand() < .07;
      if (on && y > 0 && y < h - 1) setOrb(oi, 2);
    }
  }
  // random blocks
  const dens = o.dens * (0.85 + rand() * 0.3);
  for (let oi = 0; oi < O.list.length; oi++) {
    if (fixed[oi] || g[O.list[oi][0]]) continue;
    if (rand() < dens) setOrb(oi, 1);
  }
  if (o.holes) { const nh = 1 + Math.floor(rand() * 2); for (let k = 0; k < nh; k++) { const oi = Math.floor(rand() * O.list.length); if (!fixed[oi]) setOrb(oi, 4); } }
  if (o.ice) { const ni = 1 + Math.floor(rand() * 2); for (let k = 0; k < ni; k++) { const oi = Math.floor(rand() * O.list.length); if (!fixed[oi]) setOrb(oi, 3); } }

  const count = (gg, v) => { let n = 0; for (let i = 0; i < N; i++) if (gg[i] === v) n++; return n; };
  const ev = gg => evalMaze(w, h, gg, bomb, start, o.cap);
  let cur = ev(g), G = g;
  for (let k = 0; k < 60 && !cur; k++) { // thin until solvable
    const oi = Math.floor(rand() * O.list.length); if (fixed[oi]) continue;
    const v = G[O.list[oi][0]]; if (v !== 1 && v !== 3) continue;
    const g2 = G.slice(); for (const c of O.list[oi]) g2[c] = 0; G = g2; cur = ev(G);
  }
  if (!cur) return null;
  const featBonus = r => (o.holes ? Math.min(r.fills, 2) * 6 : 0) + (o.ice ? Math.min(r.ices, 3) * 5 : 0);
  const score = r => r.P * 10 + r.gap * 22 + r.distinct * 4 + Math.min(r.moves.length, 100) * 0.35 + featBonus(r);
  const ok = r => r.P <= o.Pmax && r.gap <= o.gapMax;
  if (!ok(cur)) return null;
  const maxBlocks = Math.floor(N * o.maxDens);
  let stale = 0;
  const vals = [0, 0, 1, 1, 1, 1];
  if (o.holes) vals.push(4);
  if (o.ice) vals.push(3, 3);
  if (o.pillars) vals.push(2);
  for (let it = 0; it < o.iters && stale < o.stale; it++) {
    if (cur.P >= o.P && cur.gap >= o.gap && cur.moves.length >= o.minL) break;
    const g2 = G.slice(); let okm = true;
    const nm = rand() < 0.3 ? 2 : 1;
    for (let m = 0; m < nm; m++) {
      const oi = Math.floor(rand() * O.list.length); if (fixed[oi]) { okm = false; break; }
      const v = pick(vals); if (g2[O.list[oi][0]] === v) { okm = false; break; }
      for (const c of O.list[oi]) g2[c] = v;
    }
    if (!okm) continue;
    const blocks = count(g2, 1) + count(g2, 3) + count(g2, 2);
    if (blocks > maxBlocks && blocks > count(G, 1) + count(G, 3) + count(G, 2)) continue;
    if (count(g2, 4) > o.maxHoles || count(g2, 3) > o.maxIce || count(g2, 2) > N * 0.22) continue;
    const r2 = ev(g2);
    if (!r2 || !ok(r2)) { stale++; continue; }
    if (score(r2) >= score(cur)) { if (score(r2) > score(cur)) stale = 0; else stale++; G = g2; cur = r2; } else stale++;
  }
  if (cur.P < o.Pfloor || cur.gap < o.gapFloor || cur.moves.length < o.minL * 0.85) return null;
  // cleanup: drop blocks that do not make the puzzle harder
  const order = O.list.map((_, i) => i).sort(() => rand() - .5);
  for (const oi of order) {
    if (fixed[oi]) continue;
    const v = G[O.list[oi][0]]; if (v !== 1 && v !== 3 && v !== 4) continue;
    const g2 = G.slice(); for (const c of O.list[oi]) g2[c] = 0;
    const r2 = ev(g2);
    if (r2 && r2.P >= cur.P && r2.gap >= cur.gap && r2.moves.length >= cur.moves.length - 2 && featBonus(r2) >= featBonus(cur)) { G = g2; cur = r2; }
  }
  // feature must matter where required: turn every hole / ice into a pillar and the board must become unsolvable
  if (o.needHole) { if (!cur.fills) return null; const g2 = G.slice(); for (let i = 0; i < N; i++) if (g2[i] === 4) g2[i] = 2; if (evalMaze(w, h, g2, bomb, start, o.cap * 2)) return null; }
  if (o.needIce) { if (!cur.ices) return null; const g2 = G.slice(); for (let i = 0; i < N; i++) if (g2[i] === 3) g2[i] = 2; if (evalMaze(w, h, g2, bomb, start, o.cap * 2)) return null; }
  return Object.assign({ w, h, g: G, bomb, start, mode }, cur);
}

module.exports = { evalMaze, build, encode, orbits };

/* ---------------- campaign pool ---------------- */
const SIZES = [[9, 7], [11, 7], [11, 9], [11, 9], [13, 9], [13, 9], [13, 9], [13, 9], [13, 9], [13, 9]];
function jobsFor(wi) {
  const jobs = [];
  for (let j = 0; j < 11; j++) {
    const d = wi * 10 + Math.min(j, 9);
    const P = Math.round(2.5 + d * 0.16), gap = Math.floor(d / 11);
    const intro = j === 0 && (wi === 1 || wi === 2 || wi === 5);
    jobs.push({ wi, j, intro, d, P, gap });
  }
  return jobs;
}
function runJob(job, seed0) {
  const [w, h] = SIZES[job.wi], wi = job.wi;
  const feats = { pillars: wi >= 1, holes: wi >= 2, ice: wi >= 5 };
  let P = job.P, gap = job.gap;
  if (job.intro) { P = Math.max(3, P - 3); gap = Math.max(1, gap - 2); }
  const nb = wi < 4 ? 1 : (job.j % 3 === 2 ? (wi < 7 ? 2 : 3) : 1);
  let Pfloor = Math.max(2, P - 2), gapFloor = Math.max(0, gap - 2);
  for (let t = 0; ; t++) {
    if (t && t % 6 === 0) { Pfloor = Math.max(2, Pfloor - 1); gapFloor = Math.max(0, gapFloor - 1); }
    const o = Object.assign({}, feats, {
      nb, P, gap, Pmax: P + 4, gapMax: gap + 4, Pfloor, gapFloor,
      dens: 0.28, maxDens: 0.48, maxHoles: 4, maxIce: 6, cap: wi < 4 ? 9000 : 4500, iters: wi < 4 ? 900 : 500, stale: wi < 4 ? 260 : 170,
      minL: Math.round((w + h) * 1.1 + job.d * 0.18),
      needHole: job.intro && wi === 2 || (wi >= 2 && job.j % 4 === 1),
      needIce: job.intro && wi === 5 || (wi >= 5 && job.j % 4 === 3)
    });
    if (job.intro && wi === 1) o.mode = 'lr';
    const lv = build(seed0 + t * 7919, w, h, o);
    if (lv) return lv;
  }
}

if (require.main === module && process.argv[2] === 'run') {
  const par = +process.argv[3], NW = +process.argv[4] || 2;
  const file = `g3part${par}.json`;
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
  const done = new Set(out.map(x => x.wi + ':' + x.j));
  const all = []; for (let wi = 0; wi < 10; wi++) all.push(...jobsFor(wi));
  const t0 = Date.now();
  all.forEach((job, k) => {
    if (k % NW !== par || done.has(job.wi + ':' + job.j)) return;
    const lv = runJob(job, 120000 + job.wi * 1000 + job.j * 37);
    const L = lv.moves.length;
    const time = Math.min(180, Math.ceil(15 + L * 0.7 + lv.P * 3 + lv.gap * 4));
    const D = lv.P + 1.5 * lv.gap + 1.5 * Math.log2(lv.expanded + 1);
    out.push({ wi: job.wi, j: job.j, intro: job.intro, D, lv: { m: encode(lv.w, lv.h, lv.g, lv.bomb, lv.start), t: time, p: lv.P }, sol: lv.moves, P: lv.P, gap: lv.gap, L, fills: lv.fills, ices: lv.ices, mode: lv.mode });
    fs.writeFileSync(file, JSON.stringify(out));
    console.error(`W${job.wi + 1}#${job.j + 1}${job.intro ? '*' : ''} ${lv.mode} P=${lv.P} gap=${lv.gap} L=${L} fills=${lv.fills} ices=${lv.ices} exp=${lv.expanded} [${((Date.now() - t0) / 1000).toFixed(0)}s]`);
  });
  console.error('part done');
}

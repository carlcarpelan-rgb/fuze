// Solves every Fuze Tower floor: the fastest way to the goal measured in fuse time,
// honouring spare fuses. Prints what the solution uses and writes solutions.json.
//   node tower/solve.js            -> report
//   node tower/solve.js --no F,g   -> also report the best time if spare fuses / glass crushing were absent
const fs = require('fs'), path = require('path');
const R = require('./src/rules.js');
const STEP = 0.3; // seconds a quick player needs per step

function solve(lv, opts) {
  opts = opts || {};
  const L = R.parseLevel(lv), st0 = R.makeState(L);
  const budget = opts.budget || 1e9;
  // Dijkstra on total time; each node also remembers time since the last refill
  const start = { st: st0, t: 0, since: 0, par: null, d: -1 };
  const best = new Map([[R.key(st0), 0]]);
  const q = [start];
  let pops = 0;
  while (q.length) {
    let bi = 0; for (let i = 1; i < q.length; i++) if (q[i].t < q[bi].t) bi = i;
    const nd = q[bi]; q[bi] = q[q.length - 1]; q.pop();
    if (++pops > 400000) return { overflow: true };
    for (let d = 0; d < 4; d++) {
      const st = R.clone(nd.st), r = R.step(st, d);
      if (r.t === 'blocked' || r.t === 'caught') continue;
      const dt = STEP + (r.cost || 0);
      let since = nd.since + dt;
      if (since > budget) continue;
      if (r.refill) since = 0;
      const n = { st, t: nd.t + dt, since, par: nd, d, r };
      if (r.t === 'win') return report(n, pops);
      const k = R.key(st);
      if (best.has(k) && best.get(k) <= n.t) continue;
      best.set(k, n.t); q.push(n);
    }
  }
  return null;
}
function report(n, pops) {
  const steps = []; let pushes = 0, glass = 0, takedowns = 0, refills = 0, crushed = 0, maxSince = 0, since = 0;
  for (let m = n; m.par; m = m.par) steps.push(m);
  steps.reverse();
  for (const m of steps) {
    if (m.r.t === 'push') pushes++;
    if (m.r.t === 'takedown') takedowns++;
    if (m.r.cost) glass++;
    if (m.r.crushed != null) crushed++;
    since += STEP + (m.r.cost || 0); maxSince = Math.max(maxSince, since);
    if (m.r.refill) { refills++; since = 0; }
  }
  return { moves: steps.map(m => 'UDLR'[m.d]).join(''), steps: steps.length, time: +n.t.toFixed(1), pushes, glass, crushed, takedowns, refills, maxSince: +maxSince.toFixed(1), explored: pops };
}
module.exports = { solve, STEP };

if (require.main === module) {
  const file = path.join(__dirname, 'levels/levels.json');
  const levels = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sols = [];
  levels.forEach((lv, i) => {
    const r = solve(lv, { budget: lv.t });
    if (!r || r.overflow) { console.log(`${i + 1} ${lv.name}: ${r ? 'too big' : 'UNSOLVABLE'}`); sols.push(''); return; }
    sols.push(r.moves);
    console.log(`${i + 1} ${lv.name.padEnd(16)} steps=${r.steps} time=${r.time}s worst-stretch=${r.maxSince}s pushes=${r.pushes} glass=${r.glass} crushed=${r.crushed} takedowns=${r.takedowns} refills=${r.refills} fuse=${lv.t}`);
  });
  fs.writeFileSync(path.join(__dirname, 'levels/solutions.json'), JSON.stringify(sols));
}

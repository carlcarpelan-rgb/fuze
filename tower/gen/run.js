'use strict';
// node gen/run.js <floor numbers, comma separated>   -> gen/out/floorN.json (best of the spec's seeds)
const fs = require('fs'), path = require('path');
const plan = require('./plan.js');
const gens = { push: require('./push.js'), guards: require('./guards.js') };
const floors = process.argv[2].split(',').map(Number);
for (const n of floors) {
  const sp = plan[n - 1]; let best = null; const t0 = Date.now();
  for (let k = 0; k < sp.seeds; k++) {
    const res = gens[sp.kind].make(n * 1000 + k * 17 + 1, sp.o);
    if (res && (!best || res.s.v > best.s.v)) best = res;
  }
  const prev = path.join(__dirname, 'out', 'floor' + n + '.json');
  if (fs.existsSync(prev) && JSON.parse(fs.readFileSync(prev, 'utf8')).v > best.s.v && !process.env.FORCE) { console.log('floor', n, 'kept the earlier, better floor'); continue; }
  const s = best.s;
  const out = { floor: n, theme: sp.theme, boss: !!sp.boss, lv: s.lv, v: s.v, seg: s.seg, used: s.used, idle: s.idle, pushes: s.r.pushes, steps: s.r.steps, time: s.r.time, glass: s.r.glass, crushed: s.r.crushed, takedowns: s.r.takedowns, rev: s.rev, alt: s.alt, moves: s.r.moves };
  fs.writeFileSync(path.join(__dirname, 'out', 'floor' + n + '.json'), JSON.stringify(out));
  console.log('floor', n, 'seg', s.seg, 'pushes', s.r.pushes, 'steps', s.r.steps, 'v', s.v.toFixed(1), ((Date.now() - t0) / 1000).toFixed(0) + 's');
  console.log(s.lv.m.split('/').join('\n'), JSON.stringify(s.lv.cars || s.lv.guards || ''));
}

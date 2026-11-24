'use strict';
const R = require('../src/rules.js');
const levels = require('./levels.json'), sols = require('./solutions.json');
const D = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
let ok = 0;
levels.forEach((lv, i) => {
  const st = R.makeState(R.parseLevel(lv));
  let won = false, pushes = 0;
  for (const c of sols[i]) {
    if (won) throw new Error('moves after win in ' + i);
    if (c === 'T') { const r = R.tick(st); if (r.dead) throw new Error('dead in ' + i); if (r.win) won = true; continue; }
    const r = R.tryMove(st, D[c][0], D[c][1]);
    if (r.t === 'blocked') throw new Error('blocked in ' + i);
    if (r.t === 'push') pushes++;
    if (r.t === 'win') won = true;
  }
  if (!won) throw new Error('not won: ' + i);
  ok++;
});
console.log('verified', ok, 'of', levels.length);

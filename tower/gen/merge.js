'use strict';
// Collects gen/out/floorN.json into levels/levels.json with names and fuse times.
// Fuse: the best possible time (a quick player, 0.3 s a step) times a factor that tightens through each part of the tower.
const fs = require('fs'), path = require('path');
const NAMES = [
  'Double parked', 'Tight squeeze', 'Reverse in', 'Gridlock', 'Windscreens', 'Valet parking', 'Rush hour', 'Under the ramp',
  'Deliveries', 'Stacked', 'Fragile', 'This way up', 'Broken bottles', 'Overtime', 'Shipping lane', 'Special delivery',
  'Night porter', 'The rounds', 'Out of sight', 'Back to back', 'Two shifts', 'Lights out', 'Front desk', 'Grand opening'
];
const MULT = [3.2, 2.7, 2.5, 2.3, 2.2, 2.1, 2.0, 1.75], BASE = [8, 6, 5, 5, 4, 4, 4, 3];
const out = [], sols = [];
// within each part of the tower the floors go from easiest to hardest; the bomb floor stays last
const order = [];
for (let a = 1; a <= 24; a += 8) {
  const part = [];
  for (let n = a + 1; n < a + 7; n++) { const f = path.join(__dirname, 'out', 'floor' + n + '.json'); if (fs.existsSync(f)) { const d = JSON.parse(fs.readFileSync(f, 'utf8')); part.push({ n, hard: d.steps + d.pushes * 1.5 + (d.takedowns || 0) * 4 }); } }
  part.sort((x, y) => x.hard - y.hard);
  order.push(a, ...part.map(p => p.n), a + 7);
}
for (let j = 0; j < order.length; j++) {
  const n = order[j];
  const f = path.join(__dirname, 'out', 'floor' + n + '.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8')), k = j % 8;
  const lv = Object.assign({ name: NAMES[n - 1], theme: d.theme }, d.boss ? { boss: true } : {}, { t: Math.ceil(d.time * MULT[k] + BASE[k]) }, d.lv);
  out.push(lv); sols.push(d.moves);
}
const txt = '[\n' + out.map(l => '  ' + JSON.stringify(l)).join(',\n') + '\n]\n';
fs.writeFileSync(path.join(__dirname, '..', 'levels', 'levels.json'), txt);
console.log(out.length, 'floors');

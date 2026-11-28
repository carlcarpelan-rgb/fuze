// Checks the test floors in levels/lab.json: each must be solvable within its fuse, and its idea must matter:
// take the idea away and the floor must become impossible or clearly different.
//   node tower/labcheck.js      -> report, and levels/lab-solutions.json
const fs = require('fs'), path = require('path');
const S = require('./solve.js');
const file = path.join(__dirname, 'levels/lab.json');
const L = JSON.parse(fs.readFileSync(file, 'utf8'));
const strip = {
  laser: lv => ({ ...lv, lasers: [] }),
  green: lv => ({ ...lv, m: lv.m.replace(/[qp]/g, '#') }),          // plain crates instead of mirrors
  guards: lv => ({ ...lv, guards: [] }),
  cars: lv => ({ ...lv, cars: [] }),
  dark: null,
  noise: lv => ({ ...lv, m: lv.m.replace(/g/g, '.') }),
  power: lv => ({ ...lv, m: lv.m.replace(/P/g, '.') }),
  blink: lv => ({ ...lv, lasers: lv.lasers.map(l => ({ ...l, on: null })) }),
  vents: lv => ({ ...lv, vents: [] }),
  shadow: lv => ({ ...lv, m: lv.m.replace(/s/g, '.') }),
  plate: lv => ({ ...lv, m: lv.m.replace(/o/g, '.') }),
  radio: lv => ({ ...lv, m: lv.m.replace(/N/g, 'X') })
};
const sols = [];
let bad = 0;
L.forEach((lv, i) => {
  const r = S.solve(lv, { budget: lv.t, cap: 400000 });
  if (!r || r.overflow) { console.log(`${i + 1} ${lv.name}: ${r ? 'too big' : 'NO SOLUTION'}`); sols.push(''); bad++; return; }
  sols.push(r.moves);
  let note = '';
  const f = strip[lv.idea];
  if (f) {
    const r2 = S.solve(f(lv), { cap: 400000 });
    if (!r2) note = 'idea needed (impossible without it)';
    else if (r2.overflow) note = 'without: too big to tell';
    else note = r2.steps === r.steps ? 'WITHOUT IT: SAME LENGTH (' + r2.moves + ')' : 'without it: ' + r2.steps + ' steps';
    if (lv.idea === 'blink' || lv.idea === 'shadow' || lv.idea === 'noise') {
      // for these the idea makes the floor possible, so "impossible without it" is the goal
    }
  }
  console.log(`${String(i + 1).padStart(2)} ${lv.name.padEnd(14)} steps=${String(r.steps).padStart(2)} time=${r.time}s fuse=${lv.t} pushes=${r.pushes} td=${r.takedowns}  ${note}  ${r.moves}`);
});
fs.writeFileSync(path.join(__dirname, 'levels/lab-solutions.json'), JSON.stringify(sols));
process.exitCode = bad ? 1 : 0;

'use strict';
// Boss boards: the maze rolls in while pillar gates with a few pushable doors block the way.
const fs = require('fs');
const G = require('./gen.js');
const { mulberry32, solveScroll } = G;
const H = 7, VW = 11, MID = 3;
const STATS = { unsolv: 0, slowOk: 0, noPush: 0, ok: 0 };

function makeBoss(seed, W, o) {
  const rand = mulberry32(seed);
  for (let attempt = 0; attempt < 300; attempt++) {
    const g = new Uint8Array(W * H), bomb = new Uint8Array(W * H);
    const set = (x, y, v) => { if (x >= 0 && x < W) { g[y * W + x] = v; g[(H - 1 - y) * W + x] = v; } };
    let x = W - VW - 1;
    for (let k = 0; k < 2; k++) { const y = Math.floor(rand() * 3); set(W - VW + Math.floor(rand() * 3), y, 1); }
    let sinceGate = 0;
    while (x > 4) {
      const r = rand();
      if (sinceGate >= o.gateEvery && r < o.gate) {
        // pillar gate with doors (walls) at mirrored rows or the middle
        for (let y = 0; y <= MID; y++) set(x, y, 2);
        const kind = rand();
        if (kind < .4) set(x, MID, 1);
        else { const a = Math.floor(rand() * 3); set(x, a, 1); if (kind > .8) set(x, MID, 1); }
        // something just behind the gate, so not every door can be pushed
        for (let y = 0; y <= MID; y++) if (rand() < o.behind) set(x - 1, y, rand() < .5 ? 1 : 2);
        x -= 2 + Math.floor(rand() * 2); sinceGate = 0;
      } else if (r < .55) {
        const wd = 2 + Math.floor(rand() * 3);
        for (let k = 0; k < wd; k++) { for (let y = 0; y <= MID; y++) if (rand() < o.dens) set(x, y, rand() < o.pil ? 2 : 1); x--; }
        sinceGate += wd;
      } else {
        for (let y = 0; y <= MID; y++) if (rand() < o.dens * .5) set(x, y, 1);
        x--; sinceGate++;
      }
    }
    for (let y = 0; y < H; y++) for (let xx = 0; xx < 3; xx++) g[y * W + xx] = 0;
    bomb[MID * W] = 1;
    const sx = W - VW + 5, sy = MID;
    g[sy * W + sx] = 0; g[sy * W + sx - 1] = 0;
    const st = { m: o.m, push: true, cap: 2500 };
    const res = solveScroll(W, H, VW, g, bomb, sx, sy, st);
    if (!res) { STATS.unsolv++; continue; }
    if (solveScroll(W, H, VW, g, bomb, sx, sy, { m: o.m + 2, push: false, cap: 3000 })) { STATS.noPush++; continue; }
    STATS.ok++;
    // count pushes and gates in the solution path
    return { g, bomb, start: sy * W + sx, moves: res.moves, attempt };
  }
  return null;
}
function encode(W, g, bomb, start) {
  const rows = [];
  for (let y = 0; y < H; y++) { let s = ''; for (let x = 0; x < W; x++) { const i = y * W + x; s += i === start ? 'S' : bomb[i] ? 'B' : '.#X'[g[i]]; } rows.push(s); }
  return rows.join('/');
}
module.exports = { makeBoss, STATS };
if (require.main === module) {
  const out = [];
  for (let wi = 0; wi < 10; wi++) for (const second of [false, true]) {
    const W = (second ? 40 : 30) + wi * (second ? 3 : 2);
    const tick = Math.round((second ? 540 : 600) - wi * 15);
    const o = { m: 2, gate: second ? .9 : .75, gateEvery: second ? 2 : 3, behind: .18 + wi * .02, dens: .22 + wi * .012, pil: .25 };
    let lv = null, s = 52000 + wi * 100 + (second ? 50 : 0), seeds = 0;
    while (!lv) { lv = makeBoss(s++, W, o); seeds++; }
    const pushes = [...lv.moves].length; // placeholder count below
    const time = Math.ceil((W - VW) * tick / 1000 + 8);
    out.push({ lv: { m: encode(W, lv.g, lv.bomb, lv.start), t: time, s: tick, v: VW }, sol: lv.moves });
    console.error(`boss W${wi + 1}${second ? 'b' : 'a'} W=${W} tick=${tick} seeds=${seeds} tries=${lv.attempt} moves=${lv.moves.replace(/T/g, '').length}`);
  }
  fs.writeFileSync('boss.json', JSON.stringify(out));
}

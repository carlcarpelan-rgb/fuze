/* ===== Fuze Tower art: night-time themes, guards, glass, lift, lasers, spare fuse ===== */
const TTHEMES = [
  { name: 'Garage', sub: 'Level P1', accent: '#ffd166', bg: '#1a1d22', bg2: '#060709', frame: '#3b4048',
    floor: { k: 'plate', a: '#4a4f57', b: '#454a52', g: '#202328' },
    wall: { k: 'crate', top: '#d9a35f', top2: '#c48f4f', side: '#8a5f2c', line: '#5c3d1b' },
    amb: [78, 84, 100], mote: { k: 'dust', c: '255,240,210' }, line: '#e0b93a' },
  { name: 'Offices', sub: 'Floor 12', accent: '#7fd1ff', bg: '#121824', bg2: '#04060a', frame: '#38445a',
    floor: { k: 'tile', a: '#34445e', b: '#2f3d55', g: '#18202e' },
    wall: { k: 'metal', top: '#c9ced6', top2: '#b6bcc6', side: '#6f7682', line: '#454b55', rivet: '#eef1f5' },
    amb: [82, 90, 118], mote: { k: 'dust', c: '230,240,255' } }
];

/* a guard: dark uniform, cap, torch held out in front */
function drawGuard(c, x, y, s, g) {
  c.save(); c.translate(x, y);
  c.globalAlpha = g.alpha == null ? 1 : g.alpha;
  const ol = Math.max(1, s * .025);
  if (g.ko > 0) {
    // knocked out: flat on the floor, with circling stars
    const k = Math.min(1, g.ko);
    c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, 0, s * .3, s * .32, s * .09); c.fill();
    c.save(); c.translate(0, s * .22); c.rotate(k * Math.PI / 2 * (g.face === 2 ? -1 : 1)); c.scale(1, 1 - .35 * k);
    c.fillStyle = '#2b3446'; rr(c, -s * .19, -s * .2, s * .38, s * .3, s * .12); c.fill(); c.strokeStyle = '#0c1018'; c.lineWidth = ol; c.stroke();
    c.fillStyle = '#1b2130'; ell(c, 0, -s * .3, s * .17, s * .16); c.fill();
    c.restore();
    if (k >= 1) for (let i = 0; i < 3; i++) {
      const a = g.t * 4 + i * TAU / 3;
      c.fillStyle = '#ffd166'; ell(c, Math.cos(a) * s * .18, s * .02 + Math.sin(a) * s * .06, s * .035, s * .035); c.fill();
    }
    c.restore(); return;
  }
  const fx = g.face === 2 ? -1 : g.face === 3 ? 1 : 0, fy = g.face === 0 ? -1 : g.face === 1 ? 1 : 0;
  const ph = Math.sin(g.walk * TAU) * (g.moving || 0), bob = -Math.abs(Math.cos(g.walk * TAU)) * s * .03 * (g.moving || 0);
  c.fillStyle = 'rgba(0,0,0,.38)'; ell(c, 0, s * .33, s * .26, s * .085); c.fill();
  for (const i of [-1, 1]) {
    const o = i * ph * s * .06;
    c.fillStyle = '#0f131b'; rr(c, i * s * .11 - s * .085 + (fx ? o : 0), s * .21 + (fy ? o * .6 : 0), s * .17, s * .11, s * .05); c.fill();
  }
  // body
  const gr = c.createLinearGradient(-s * .2, 0, s * .2, s * .3);
  gr.addColorStop(0, '#3a465e'); gr.addColorStop(1, '#1d2433');
  c.fillStyle = gr; rr(c, -s * .2, -s * .07 + bob, s * .4, s * .32, s * .12); c.fill();
  c.strokeStyle = '#0a0d14'; c.lineWidth = ol; c.stroke();
  c.fillStyle = '#c8303a'; rr(c, -s * .13 + (fx > 0 ? s * .12 : 0), s * .01 + bob, s * .07, s * .05, s * .01); c.fill();
  c.fillStyle = '#0d1018'; c.fillRect(-s * .2, s * .13 + bob, s * .4, s * .035);
  // torch arm, held out in the facing direction
  const ax = fx * s * .2 + (fy ? s * .16 : 0), ay = s * .08 + fy * s * .1 + bob;
  c.fillStyle = '#2b3446'; ell(c, ax, ay, s * .07, s * .07); c.fill();
  c.fillStyle = '#9aa3b2'; rr(c, ax + fx * s * .04 - s * .035, ay + fy * s * .04 - s * .035, s * .07, s * .07, s * .015); c.fill();
  c.globalCompositeOperation = 'lighter';
  const lx = ax + fx * s * .07, ly = ay + fy * s * .07, lg = c.createRadialGradient(lx, ly, 0, lx, ly, s * .16);
  lg.addColorStop(0, 'rgba(255,245,200,.95)'); lg.addColorStop(1, 'rgba(255,245,200,0)');
  c.fillStyle = lg; ell(c, lx, ly, s * .16, s * .16); c.fill();
  c.globalCompositeOperation = 'source-over';
  // head with cap
  const hx = fx * s * .03, hy = -s * .17 + bob;
  c.fillStyle = '#c98f6d'; ell(c, hx, hy, s * .17, s * .16); c.fill(); c.strokeStyle = '#3a2416'; c.lineWidth = ol; c.stroke();
  c.fillStyle = '#121722';
  c.beginPath(); c.ellipse(hx, hy - s * .04, s * .185, s * .13, 0, Math.PI, TAU); c.fill();
  // cap brim towards the facing direction
  c.fillStyle = '#0b0f17';
  if (fy >= 0 && !fx) rr(c, hx - s * .15, hy - s * .06, s * .3, s * .06, s * .03);
  else if (fx) rr(c, hx + fx * s * .08 - s * .06, hy - s * .07, s * .14, s * .05, s * .025);
  else rr(c, hx - s * .12, hy - s * .16, s * .24, s * .04, s * .02);
  c.fill();
  if (fy >= 0) { c.fillStyle = '#0b0f17'; const ex = hx + fx * s * .06; ell(c, ex - s * .05, hy + s * .03, s * .018, s * .022); c.fill(); ell(c, ex + s * .05, hy + s * .03, s * .018, s * .022); c.fill(); }
  if (g.alert > 0) {
    // the moment he spots you
    const k = Math.min(1, g.alert * 2.2), by = hy - s * .38 - k * s * .08;
    c.fillStyle = '#ff3b3b'; rr(c, -s * .07, by - s * .17, s * .14, s * .2, s * .05); c.fill();
    c.fillStyle = '#fff'; rr(c, -s * .025, by - s * .14, s * .05, s * .1, s * .02); c.fill(); ell(c, 0, by - s * .005, s * .028, s * .028); c.fill();
  }
  c.restore();
}

/* broken glass scattered over the floor */
function paintGlass(c, s, rnd) {
  for (let i = 0; i < 14; i++) {
    const x = s * (.1 + rnd() * .8), y = s * (.1 + rnd() * .8), r0 = s * (.04 + rnd() * .09), a = rnd() * TAU;
    c.beginPath();
    for (let k = 0; k < 3; k++) { const b = a + k * TAU / 3 + (rnd() - .5) * .9, d = r0 * (.5 + rnd() * .7); k ? c.lineTo(x + Math.cos(b) * d, y + Math.sin(b) * d) : c.moveTo(x + Math.cos(b) * d, y + Math.sin(b) * d); }
    c.closePath();
    c.fillStyle = 'rgba(190,230,255,' + (.25 + rnd() * .3) + ')'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1, s * .012); c.stroke();
  }
  for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,255,255,.9)'; const x = s * (.1 + rnd() * .8), y = s * (.1 + rnd() * .8); c.fillRect(x, y, Math.max(1, s * .02), Math.max(1, s * .02)); }
}

/* the lift: a doorway in the back wall. Drawn in three parts so the player can stand in front of it or step inside. */
function liftBox(x, s, oy, hh, ft) { // x = left edge of the lift's cell
  const top = oy - hh - ft - s * .5;
  return { x0: x + s * .03, w: s * .94, top, bot: oy + s * .04, ix: x + s * .15, iw: s * .7, itop: top + s * .3 };
}
function drawLiftSill(c, x, y, s) {
  c.fillStyle = '#5b6370'; c.fillRect(x + s * .12, y, s * .76, s * .16);
  c.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 1; i < 6; i++) c.fillRect(x + s * .12 + i * s * .126, y + s * .02, Math.max(1, s * .015), s * .12);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + s * .12, y + s * .15, s * .76, Math.max(1, s * .015));
}
function drawLiftBack(c, b, s, open) {
  // steel surround
  const g = c.createLinearGradient(b.x0, 0, b.x0 + b.w, 0);
  g.addColorStop(0, '#6c7584'); g.addColorStop(.5, '#a9b2bf'); g.addColorStop(1, '#5d6573');
  c.fillStyle = g; rr(c, b.x0, b.top, b.w, b.bot - b.top, s * .06); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = Math.max(1, s * .02); c.stroke();
  // car interior, warm light
  const ig = c.createLinearGradient(0, b.itop, 0, b.bot);
  ig.addColorStop(0, '#f3d9a4'); ig.addColorStop(.7, '#b98a52'); ig.addColorStop(1, '#5e4024');
  c.fillStyle = ig; c.fillRect(b.ix, b.itop, b.iw, b.bot - b.itop);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(b.ix + b.iw * .1, b.itop + s * .05, b.iw * .8, s * .04);
}
function drawLiftDoors(c, b, s, open, t, going) {
  const half = b.iw / 2, w = half * (1 - open);
  const panel = (x, ww) => {
    if (ww < 1) return;
    const g = c.createLinearGradient(x, 0, x + ww, 0);
    g.addColorStop(0, '#9aa3b0'); g.addColorStop(.5, '#d7dde5'); g.addColorStop(1, '#8b94a1');
    c.fillStyle = g; c.fillRect(x, b.itop, ww, b.bot - b.itop);
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 1; i < 4; i++) c.fillRect(x + ww * i / 4, b.itop, 1, b.bot - b.itop);
  };
  panel(b.ix, w); panel(b.ix + b.iw - w, w);
  c.fillStyle = 'rgba(0,0,0,.6)'; if (w > 1) c.fillRect(b.ix + w - 1, b.itop, 2, b.bot - b.itop);
  // floor indicator with an up arrow
  const ix = b.x0 + b.w / 2, iy = b.top + s * .15;
  c.fillStyle = '#10151c'; rr(c, ix - s * .2, iy - s * .1, s * .4, s * .2, s * .04); c.fill();
  const pulse = going ? .6 + .4 * Math.sin(t * 18) : .7 + .3 * Math.sin(t * 4);
  c.fillStyle = 'rgba(90,255,160,' + pulse + ')';
  c.beginPath(); c.moveTo(ix, iy - s * .07); c.lineTo(ix + s * .07, iy + s * .05); c.lineTo(ix - s * .07, iy + s * .05); c.closePath(); c.fill();
  c.globalCompositeOperation = 'lighter';
  const lg = c.createRadialGradient(ix, iy, 0, ix, iy, s * .3); lg.addColorStop(0, 'rgba(90,255,160,' + .45 * pulse + ')'); lg.addColorStop(1, 'rgba(90,255,160,0)');
  c.fillStyle = lg; ell(c, ix, iy, s * .3, s * .3); c.fill();
  c.globalCompositeOperation = 'source-over';
  // call button beside the doors
  c.fillStyle = '#2a3038'; rr(c, b.x0 + b.w - s * .1, b.itop + s * .25, s * .06, s * .1, s * .02); c.fill();
  c.fillStyle = open > .05 ? '#ffd166' : '#6b7280'; ell(c, b.x0 + b.w - s * .07, b.itop + s * .3, s * .018, s * .018); c.fill();
}

/* a coiled spare fuse with a little spark */
function drawFuseCoil(c, x, y, s, t) {
  c.save(); c.translate(x, y + Math.sin(t * 3) * s * .03);
  c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, 0, s * .26, s * .2, s * .06); c.fill();
  c.lineCap = 'round';
  c.strokeStyle = '#3d2c18'; c.lineWidth = s * .075;
  c.beginPath(); for (let a = 0; a < TAU * 2.4; a += .2) { const r = s * (.05 + a * .018); const px = Math.cos(a) * r, py = Math.sin(a) * r * .7; a ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
  c.strokeStyle = '#e0bb80'; c.lineWidth = s * .045; c.stroke();
  const ex = Math.cos(TAU * 2.4) * s * .32, ey = Math.sin(TAU * 2.4) * s * .32 * .7;
  c.globalCompositeOperation = 'lighter';
  const sg = c.createRadialGradient(ex, ey, 0, ex, ey, s * .18);
  sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(.3, 'rgba(255,190,60,.8)'); sg.addColorStop(1, 'rgba(255,90,20,0)');
  c.fillStyle = sg; ell(c, ex, ey, s * .18 * (.8 + .2 * Math.sin(t * 30)), s * .18); c.fill();
  c.restore();
}

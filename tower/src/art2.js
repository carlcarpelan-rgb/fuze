/* ===== Fuze Tower art: night-time themes, guards, glass, lift, lasers, spare fuse ===== */
const TTHEMES = [
  { name: 'Garage', sub: 'Levels P1 to P8', accent: '#ffd166', bg: '#1a1d22', bg2: '#060709', frame: '#3b4048',
    floor: { k: 'plate', a: '#4a4f57', b: '#454a52', g: '#202328' },
    wall: { k: 'crate', top: '#d9a35f', top2: '#c48f4f', side: '#8a5f2c', line: '#5c3d1b' },
    col: { k: 'concrete', top: '#8d9199', side: '#5c6068', band: 1 },
    amb: [78, 84, 100], mote: { k: 'dust', c: '255,240,210' }, line: '#e0b93a' },
  { name: 'Loading Dock', sub: 'Deliveries', accent: '#ff9f5a', bg: '#221a14', bg2: '#090605', frame: '#4a3d33',
    floor: { k: 'flag', a: '#5a5650', b: '#524e48', g: '#26231f' },
    wall: { k: 'crate', top: '#d9a35f', top2: '#c48f4f', side: '#8a5f2c', line: '#5c3d1b' },
    col: { k: 'iron' }, stripes: '#e9c93a',
    amb: [118, 100, 88], mote: { k: 'dust', c: '255,225,190' } },
  { name: 'Lobby', sub: 'Ground floor', accent: '#e8c872', bg: '#1d1a16', bg2: '#080706', frame: '#4b4336',
    floor: { k: 'tile', a: '#7a7265', b: '#71695d', g: '#3f3a33' },
    wall: { k: 'stone', top: '#7b8c74', top2: '#6f8068', side: '#4a5a45', line: '#33402f' },
    col: { k: 'marble', top: '#efe9dd', side: '#b9ae99', trim: '#c9a54a' },
    amb: [70, 66, 74], mote: { k: 'dust', c: '255,240,215' } },
  { name: 'Offices', sub: 'Floor 12', accent: '#7fd1ff', bg: '#121824', bg2: '#04060a', frame: '#38445a',
    floor: { k: 'tile', a: '#34445e', b: '#2f3d55', g: '#18202e' },
    wall: { k: 'metal', top: '#c9ced6', top2: '#b6bcc6', side: '#6f7682', line: '#454b55', rivet: '#eef1f5' },
    col: { k: 'iron' },
    amb: [82, 90, 118], mote: { k: 'dust', c: '230,240,255' } }
];
const CAR_COLS = ['#c8323c', '#2f6fd6', '#e9e4d8', '#e7b416', '#3c9a5f', '#8a929e', '#22262d', '#d9692b'];

/* a fixed column: never moves. Concrete with a hazard band, or polished marble. Iron falls back to Fuze's pillar. */
function paintColumn(c, s, hh, th) {
  const cl = th.col || {};
  if (cl.k === 'iron' || !cl.k) return paintPillar(c, s, hh, th);
  const p = Math.max(1, Math.round(s * .05)), w = s - 2 * p, tp = s - p, r = s * .06;
  // front face
  const fg = c.createLinearGradient(0, tp, 0, s + hh);
  fg.addColorStop(0, shade(cl.side, .05)); fg.addColorStop(1, shade(cl.side, -.35));
  c.fillStyle = fg; rr(c, p, tp - r * 2, w, hh + r * 2 + p, r); c.fill();
  if (cl.band) { // black and yellow hazard band
    c.save(); c.beginPath(); c.rect(p, tp + hh * .2, w, hh * .55); c.clip();
    c.fillStyle = '#e9c93a'; c.fillRect(p, tp, w, hh);
    c.fillStyle = '#1c1d20';
    for (let x = -hh; x < s + hh; x += hh * .9) { c.beginPath(); c.moveTo(x, tp + hh); c.lineTo(x + hh * .45, tp + hh); c.lineTo(x + hh * .9, tp); c.lineTo(x + hh * .45, tp); c.fill(); }
    c.restore();
  }
  if (cl.trim) { c.fillStyle = cl.trim; c.fillRect(p, tp + hh * .78, w, Math.max(1, hh * .14)); }
  // top
  c.save(); rr(c, p, 0, w, tp, r); c.clip();
  const tg = c.createLinearGradient(0, 0, s, tp);
  tg.addColorStop(0, shade(cl.top, .12)); tg.addColorStop(1, shade(cl.top, -.18));
  c.fillStyle = tg; c.fillRect(0, 0, s, s);
  if (cl.k === 'marble') {
    const rnd = mulberry32(99);
    c.strokeStyle = 'rgba(120,110,95,.35)'; c.lineWidth = Math.max(1, s * .012);
    for (let i = 0; i < 4; i++) { c.beginPath(); let x = rnd() * s, y = 0; c.moveTo(x, y); while (y < s) { x += (rnd() - .5) * s * .25; y += s * .12; c.lineTo(x, y); } c.stroke(); }
    c.strokeStyle = cl.trim; c.lineWidth = Math.max(1, s * .03); c.strokeRect(p + s * .1, s * .1, w - s * .2, tp - s * .2);
  } else {
    // concrete: speckles and a cast seam
    const rnd = mulberry32(7);
    for (let i = 0; i < 30; i++) { c.fillStyle = rnd() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.08)'; c.fillRect(rnd() * s, rnd() * s, Math.max(1, s * .02), Math.max(1, s * .02)); }
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(p, tp * .5, w, Math.max(1, s * .015));
  }
  c.restore();
  c.lineWidth = Math.max(1, s * .025); c.strokeStyle = 'rgba(255,255,255,.25)'; rr(c, p + .5, .5, w - 1, tp - 1, r); c.stroke();
  c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.8)'; rr(c, p + .5, .5, w - 1, tp + hh - 1, r); c.stroke();
}

/* a parked car, seen from above and a little in front. h: lies left-right. Sprite: (2s x s+hh) or (s x 2s+hh). */
function paintCar(c, s, hh, h, col, rnd) {
  const L = s * 2, W = s, pad = s * .07, side = hh * 1.15;
  c.save();
  if (!h) { c.translate(0, 0); }
  const bw = h ? L - pad * 2 : W - pad * 2, bl = h ? W - pad * 2 : L - pad * 2; // body width on screen, depth on screen
  const x0 = pad, y0 = pad + hh - side * .2;
  const dark = shade(col, -.42), lite = shade(col, .22);
  // wheels peeking out below the body
  c.fillStyle = '#0c0d10';
  if (h) { for (const wx of [.2, .8]) rr(c, x0 + bw * wx - s * .13, y0 + bl - s * .02, s * .26, side + s * .06, s * .05), c.fill(); }
  else { for (const wy of [.18, .82]) { rr(c, x0 - s * .03, y0 + bl * wy - s * .12, s * .1, s * .24, s * .03); c.fill(); rr(c, x0 + bw - s * .07, y0 + bl * wy - s * .12, s * .1, s * .24, s * .03); c.fill(); } }
  // side skirt (the visible front face)
  const sg = c.createLinearGradient(0, y0 + bl - side, 0, y0 + bl + side);
  sg.addColorStop(0, shade(col, -.15)); sg.addColorStop(1, dark);
  c.fillStyle = sg; rr(c, x0, y0 + bl - side * 1.2, bw, side * 2.2, s * .12); c.fill();
  // body top
  const bg = c.createLinearGradient(x0, y0, x0 + bw, y0 + bl);
  bg.addColorStop(0, lite); bg.addColorStop(1, shade(col, -.12));
  c.fillStyle = bg; rr(c, x0, y0, bw, bl, s * .16); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = Math.max(1, s * .02); c.stroke();
  // cabin: windscreen, roof, rear window
  const glass = 'rgba(30,45,60,.92)', gl2 = 'rgba(140,190,230,.35)';
  if (h) {
    const fx = x0 + bw * .27, rx = x0 + bw * .73, cy0 = y0 + bl * .14, cy1 = y0 + bl * .86;
    c.fillStyle = glass; rr(c, fx - s * .13, cy0, (rx - fx) + s * .26, cy1 - cy0, s * .1); c.fill();
    c.fillStyle = gl2; c.beginPath(); c.moveTo(fx - s * .1, cy0 + s * .05); c.lineTo(fx + s * .02, cy0 + s * .05); c.lineTo(fx - s * .04, cy1 - s * .05); c.lineTo(fx - s * .1, cy1 - s * .05); c.fill();
    c.fillStyle = shade(col, .08); rr(c, fx + s * .06, cy0 + s * .03, (rx - fx) - s * .14, cy1 - cy0 - s * .06, s * .07); c.fill();
    // lights
    c.fillStyle = '#fff3c4'; rr(c, x0 + s * .02, y0 + bl * .14, s * .06, bl * .2, s * .02); c.fill(); rr(c, x0 + s * .02, y0 + bl * .66, s * .06, bl * .2, s * .02); c.fill();
    c.fillStyle = '#c4202a'; rr(c, x0 + bw - s * .08, y0 + bl * .14, s * .06, bl * .2, s * .02); c.fill(); rr(c, x0 + bw - s * .08, y0 + bl * .66, s * .06, bl * .2, s * .02); c.fill();
    // door lines on the skirt
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x0 + bw * .5, y0 + bl - side * .9, Math.max(1, s * .015), side * 1.6);
  } else {
    const fy = y0 + bl * .3, ry = y0 + bl * .72, cx0 = x0 + bw * .12, cx1 = x0 + bw * .88;
    c.fillStyle = glass; rr(c, cx0, fy - s * .14, cx1 - cx0, (ry - fy) + s * .28, s * .1); c.fill();
    c.fillStyle = gl2; c.beginPath(); c.moveTo(cx0 + s * .05, fy - s * .1); c.lineTo(cx1 - s * .05, fy - s * .1); c.lineTo(cx1 - s * .1, fy - s * .02); c.lineTo(cx0 + s * .1, fy - s * .02); c.fill();
    c.fillStyle = shade(col, .08); rr(c, cx0 + s * .04, fy + s * .02, cx1 - cx0 - s * .08, (ry - fy) - s * .06, s * .07); c.fill();
    c.fillStyle = '#fff3c4'; rr(c, x0 + bw * .1, y0 + s * .03, bw * .22, s * .06, s * .02); c.fill(); rr(c, x0 + bw * .68, y0 + s * .03, bw * .22, s * .06, s * .02); c.fill();
    c.fillStyle = '#c4202a'; rr(c, x0 + bw * .1, y0 + bl + side * .3, bw * .22, side * .45, s * .02); c.fill(); rr(c, x0 + bw * .68, y0 + bl + side * .3, bw * .22, side * .45, s * .02); c.fill();
    c.fillStyle = '#c9ccd2'; rr(c, x0 + bw * .38, y0 + bl + side * .3, bw * .24, side * .4, s * .02); c.fill(); // number plate
  }
  // highlight
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = Math.max(1, s * .02); rr(c, x0 + s * .04, y0 + s * .04, bw - s * .08, bl - s * .08, s * .13); c.stroke();
  c.restore();
}

/* the lift: a steel cabin standing on one cell of the back row. Doors on the front, a green arrow on the roof.
   y is the top edge of its cell; H the height of its front. open 0..1 */
function drawLift(c, x, y, s, H, open, t, going, inside, locked) {
  const p = s * .04, w = s - p * 2, fy = y + s - H, top = fy - s * .55, r = s * .07;
  // roof (seen from above, foreshortened)
  const rg = c.createLinearGradient(0, top, 0, fy);
  rg.addColorStop(0, '#5f6772'); rg.addColorStop(1, '#8b939f');
  c.fillStyle = rg; rr(c, x + p, top, w, fy - top + r, r); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = Math.max(1, s * .02); c.stroke();
  // arrow lamp on the roof
  const ax = x + s / 2, ay = top + (fy - top) * .5, pulse = going ? .6 + .4 * Math.sin(t * 18) : .75 + .25 * Math.sin(t * 3);
  c.fillStyle = '#10151c'; rr(c, ax - s * .17, ay - s * .12, s * .34, s * .22, s * .05); c.fill();
  if (locked) { // no power or no green signal: a red cross and the doors stay shut
    c.strokeStyle = 'rgba(255,70,60,' + (.7 + .3 * Math.sin(t * 4)) + ')'; c.lineWidth = Math.max(1.5, s * .035); c.lineCap = 'round';
    c.beginPath(); c.moveTo(ax - s * .06, ay - s * .07); c.lineTo(ax + s * .06, ay + s * .05); c.moveTo(ax + s * .06, ay - s * .07); c.lineTo(ax - s * .06, ay + s * .05); c.stroke();
  } else {
    c.fillStyle = 'rgba(90,255,160,' + pulse + ')';
    c.beginPath(); c.moveTo(ax, ay - s * .09); c.lineTo(ax + s * .09, ay + s * .06); c.lineTo(ax - s * .09, ay + s * .06); c.closePath(); c.fill();
  }
  // front: steel frame
  const fg = c.createLinearGradient(x, 0, x + s, 0);
  fg.addColorStop(0, '#77808d'); fg.addColorStop(.5, '#b8c0cb'); fg.addColorStop(1, '#69717e');
  c.fillStyle = fg; c.fillRect(x + p, fy, w, H);
  c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeRect(x + p + .5, fy + .5, w - 1, H - 1);
  // doorway
  const dx = x + s * .17, dw = s * .66, dy = fy + H * .14, dh = H * .86;
  const ig = c.createLinearGradient(0, dy, 0, dy + dh);
  ig.addColorStop(0, '#f6dfac'); ig.addColorStop(.75, '#c09056'); ig.addColorStop(1, '#6b4a2a');
  c.fillStyle = ig; c.fillRect(dx, dy, dw, dh);
  if (inside) { c.save(); c.beginPath(); c.rect(dx, dy, dw, dh); c.clip(); inside(); c.restore(); }
  const half = dw / 2, pw = half * (1 - open);
  const panel = (px, ww) => {
    if (ww < .5) return;
    const g = c.createLinearGradient(px, 0, px + ww, 0);
    g.addColorStop(0, '#9aa3b0'); g.addColorStop(.5, '#dde2ea'); g.addColorStop(1, '#8b94a1');
    c.fillStyle = g; c.fillRect(px, dy, ww, dh);
  };
  panel(dx, pw); panel(dx + dw - pw, pw);
  if (pw > 1) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(dx + pw - .5, dy, 1, dh); c.fillRect(dx + dw - pw - .5, dy, 1, dh); }
  // a lit sill
  c.fillStyle = 'rgba(255,230,170,' + (.25 + .5 * open) + ')'; c.fillRect(dx, dy + dh - Math.max(1, s * .02), dw, Math.max(1, s * .02));
}

/* what a guard will do next: a dotted patrol line, or a curved arrow for a guard about to turn */
function drawGuardPlan(c, ox, oy, s, g, t, alpha) {
  if (!g.alive) return;
  c.save(); c.globalAlpha = alpha;
  if (g.path.length > 1) {
    c.fillStyle = 'rgba(255,214,110,.75)';
    for (let i = 0; i < g.path.length; i++) { const q = g.path[i]; ell(c, ox + (q.x + .5) * s, oy + (q.y + .5) * s, s * .045, s * .045); c.fill(); }
    c.strokeStyle = 'rgba(255,214,110,.45)'; c.lineWidth = Math.max(1, s * .025); c.setLineDash([s * .06, s * .08]);
    c.beginPath(); g.path.forEach((q, i) => { const X = ox + (q.x + .5) * s, Y = oy + (q.y + .5) * s; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke();
    c.setLineDash([]);
  } else if (g.look && g.look.length > 1) {
    const nf = g.look[(g.li + 1) % g.look.length];
    if (nf !== g.face) {
      const cx = ox + (g.x + .5) * s, cy = oy + (g.y + .5) * s, ang = [-Math.PI / 2, Math.PI / 2, Math.PI, 0][nf];
      const bob = 1 + .08 * Math.sin(t * 5);
      c.translate(cx + Math.cos(ang) * s * .42 * bob, cy + Math.sin(ang) * s * .42 * bob + s * .05); c.rotate(ang);
      c.fillStyle = 'rgba(255,226,140,.85)';
      c.beginPath(); c.moveTo(s * .09, 0); c.lineTo(-s * .05, -s * .08); c.lineTo(-s * .02, 0); c.lineTo(-s * .05, s * .08); c.closePath(); c.fill();
    }
  }
  c.restore();
}

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

/* a mirror bolted on top of a crate: '/' (m 1) or '\' (m 2). px, py: top-left of the crate's cell. */
function drawMirror(c, px, py, s, hh, m, glow) {
  const top = py - hh, p = s * .16;
  const x0 = px + p, x1 = px + s - p, y0 = top + p, y1 = top + s - p;
  const a = m === 1 ? [x0, y1, x1, y0] : [x0, y0, x1, y1];
  c.save(); c.lineCap = 'round';
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = s * .2; c.beginPath(); c.moveTo(a[0], a[1] + s * .04); c.lineTo(a[2], a[3] + s * .04); c.stroke();
  const g = c.createLinearGradient(a[0], a[1], a[2], a[3]);
  g.addColorStop(0, '#9fb3c4'); g.addColorStop(.5, '#f4fbff'); g.addColorStop(1, '#8aa0b3');
  c.strokeStyle = g; c.lineWidth = s * .14; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[2], a[3]); c.stroke();
  c.strokeStyle = 'rgba(40,60,80,.8)'; c.lineWidth = Math.max(1, s * .02); c.stroke();
  if (glow) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = glow; c.lineWidth = s * .1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[2], a[3]); c.stroke(); }
  c.restore();
}
/* the green receiver: a steel post with a lens. on: a green beam is reaching it */
function drawReceiver(c, px, py, s, hh, on, t) {
  const p = s * .1, top = py - hh * 1.6, w = s - p * 2;
  const fg = c.createLinearGradient(0, top, 0, py + s);
  fg.addColorStop(0, '#5c6672'); fg.addColorStop(1, '#2b3139');
  c.fillStyle = fg; rr(c, px + p, top, w, s + hh * 1.6 - p, s * .1); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = Math.max(1, s * .02); c.stroke();
  const cx = px + s / 2, cy = top + s * .45, r = s * .22;
  c.fillStyle = '#10151a'; ell(c, cx, cy, r * 1.25, r * 1.25); c.fill();
  const g = c.createRadialGradient(cx - r * .3, cy - r * .3, 0, cx, cy, r);
  if (on) { g.addColorStop(0, '#eafff2'); g.addColorStop(.5, '#3dff8a'); g.addColorStop(1, '#0d7a3a'); }
  else { g.addColorStop(0, '#5b6b62'); g.addColorStop(1, '#1d2a23'); }
  c.fillStyle = g; ell(c, cx, cy, r, r); c.fill();
  if (on) { c.save(); c.globalCompositeOperation = 'lighter'; const h = c.createRadialGradient(cx, cy, 0, cx, cy, r * 3); h.addColorStop(0, 'rgba(80,255,150,' + (.5 + .2 * Math.sin(t * 6)) + ')'); h.addColorStop(1, 'rgba(80,255,150,0)'); c.fillStyle = h; ell(c, cx, cy, r * 3, r * 3); c.fill(); c.restore(); }
}
/* floor switches: power (kind 1, a lever) and lights (kind 2, a bulb). on: power is on / lights are on */
function drawSwitch(c, x, y, s, kind, on, t) {
  const p = s * .14, w = s - p * 2;
  c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, x + p + s * .03, y + p + s * .05, w, w, s * .1); c.fill();
  const g = c.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, '#59616c'); g.addColorStop(1, '#353b44');
  c.fillStyle = g; rr(c, x + p, y + p, w, w, s * .1); c.fill();
  c.strokeStyle = kind === 1 ? (on ? '#ffd23a' : '#7a6a3a') : (on ? '#fff3c4' : '#8a8a7a'); c.lineWidth = Math.max(1.5, s * .035); c.stroke();
  const cx = x + s / 2, cy = y + s / 2;
  if (kind === 1) { // a lightning bolt and a lever
    c.fillStyle = on ? '#ffd23a' : '#6b6450';
    c.beginPath(); c.moveTo(cx + s * .05, cy - s * .2); c.lineTo(cx - s * .1, cy + s * .03); c.lineTo(cx, cy + s * .03); c.lineTo(cx - s * .05, cy + s * .2); c.lineTo(cx + s * .1, cy - s * .03); c.lineTo(cx, cy - s * .03); c.closePath(); c.fill();
    if (on) { c.save(); c.globalCompositeOperation = 'lighter'; const h = c.createRadialGradient(cx, cy, 0, cx, cy, s * .45); h.addColorStop(0, 'rgba(255,210,60,' + (.35 + .15 * Math.sin(t * 5)) + ')'); h.addColorStop(1, 'rgba(255,210,60,0)'); c.fillStyle = h; ell(c, cx, cy, s * .45, s * .45); c.fill(); c.restore(); }
  } else { // a light bulb
    c.fillStyle = on ? '#fff3c4' : '#9a9888'; ell(c, cx, cy - s * .04, s * .13, s * .13); c.fill();
    c.fillStyle = '#6d7178'; c.fillRect(cx - s * .07, cy + s * .08, s * .14, s * .09);
    if (!on) { c.save(); c.globalCompositeOperation = 'lighter'; const h = c.createRadialGradient(cx, cy, 0, cx, cy, s * .4); h.addColorStop(0, 'rgba(255,240,180,' + (.25 + .2 * Math.sin(t * 4)) + ')'); h.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = h; ell(c, cx, cy, s * .4, s * .4); c.fill(); c.restore(); }
  }
}
const VENT_COLS = ['#5fd0ff', '#ffb347', '#c38bff', '#7dff9a'];
/* a vent grille on the floor; both ends of a pair share a colour */
function drawVent(c, x, y, s, k) {
  const p = s * .1, w = s - p * 2, col = VENT_COLS[k % VENT_COLS.length];
  c.fillStyle = '#14181d'; rr(c, x + p, y + p, w, w, s * .08); c.fill();
  c.strokeStyle = '#8a939e'; c.lineWidth = Math.max(1, s * .03);
  for (let i = 1; i < 5; i++) { const yy = y + p + w * i / 5; c.beginPath(); c.moveTo(x + p + s * .05, yy); c.lineTo(x + s - p - s * .05, yy); c.stroke(); }
  c.strokeStyle = col; c.lineWidth = Math.max(1.5, s * .05); rr(c, x + p, y + p, w, w, s * .08); c.stroke();
}
/* a patch of deep shadow: guards do not see you in it */
function drawShadowPatch(c, x, y, s) {
  const g = c.createRadialGradient(x + s / 2, y + s / 2, s * .1, x + s / 2, y + s / 2, s * .62);
  g.addColorStop(0, 'rgba(0,0,0,.78)'); g.addColorStop(.7, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x - s * .1, y - s * .1, s * 1.2, s * 1.2);
}

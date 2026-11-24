/* ===== Themes, procedural tile painters, character and bomb drawing ===== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}
function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); }

const THEMES = [
  { name: 'Kloakerna', sub: 'Under gatubrunnarna', accent: '#4fd8b4', bg: '#0a2a26', bg2: '#030d0c', frame: '#2f5148',
    floor: { k: 'flag', a: '#3a5f58', b: '#33554d', g: '#182c28' },
    wall: { k: 'brick', top: '#9cc2a0', top2: '#86b08e', side: '#4a7361', line: '#2c4a3d' },
    amb: [131, 162, 174], mote: { k: 'drip', c: '150,235,210' } },
  { name: 'Tunnelbanan', sub: 'Stängda perronger', accent: '#5b9bff', bg: '#161a26', bg2: '#06070c', frame: '#3a4152',
    floor: { k: 'tile', a: '#4b5162', b: '#434959', g: '#23262f' },
    wall: { k: 'tile', top: '#f1ecdb', top2: '#e2dcc7', side: '#a39d88', line: '#7f7a66', stripe: '#3d7be0' },
    amb: [146, 151, 185], mote: { k: 'dust', c: '255,240,205' } },
  { name: 'Källarvalven', sub: 'Gammalt tegel', accent: '#ff9f5a', bg: '#2a1712', bg2: '#0c0605', frame: '#4d342a',
    floor: { k: 'flag', a: '#5d4a40', b: '#54423a', g: '#2a1e1a' },
    wall: { k: 'brick', top: '#d9774f', top2: '#c76843', side: '#8a422d', line: '#5e2b1e' },
    amb: [174, 146, 138], mote: { k: 'dust', c: '255,220,180' } },
  { name: 'Pannrummet', sub: 'Koppar och ånga', accent: '#ffb347', bg: '#221a14', bg2: '#090605', frame: '#4a3d33',
    floor: { k: 'plate', a: '#4a4e53', b: '#42464b', g: '#1f2124' },
    wall: { k: 'metal', top: '#e09a52', top2: '#cb8641', side: '#8a5727', line: '#5b3817', rivet: '#ffd9a3' },
    amb: [174, 149, 131], mote: { k: 'steam', c: '255,235,215' } },
  { name: 'Gruvan', sub: 'Stöttade orter', accent: '#ffd166', bg: '#241c14', bg2: '#0a0705', frame: '#4a3d2e',
    floor: { k: 'rock', a: '#5c5245', b: '#51483c', g: '#2c251e' },
    wall: { k: 'crate', top: '#dcaa66', top2: '#c29253', side: '#8a6030', line: '#5f411f' },
    amb: [171, 156, 135], mote: { k: 'dust', c: '255,230,180' } },
  { name: 'Isgrottan', sub: 'Frusna gångar', accent: '#8fd8ff', bg: '#10283f', bg2: '#040b14', frame: '#35597a',
    floor: { k: 'rock', a: '#47698a', b: '#3f5f7f', g: '#22384d' },
    wall: { k: 'stone', top: '#8a9fb4', top2: '#7a8fa6', side: '#46596e', line: '#2c3b4d', snow: true },
    amb: [151, 176, 213], mote: { k: 'snow', c: '225,245,255' } },
  { name: 'Kristallgruvan', sub: 'Lila ådror', accent: '#d79bff', bg: '#1d1436', bg2: '#07040f', frame: '#44357a',
    floor: { k: 'rock', a: '#463a66', b: '#3d325a', g: '#201833' },
    wall: { k: 'stone', top: '#a590e0', top2: '#8d77cc', side: '#55429a', line: '#35276a', vein: '#ffc9ff' },
    amb: [149, 135, 207], mote: { k: 'spark', c: '235,180,255' } },
  { name: 'Lavakammaren', sub: 'Glödande berg', accent: '#ff7a2a', bg: '#2a100b', bg2: '#0b0302', frame: '#4a2a22',
    floor: { k: 'rock', a: '#4a2f29', b: '#412822', g: '#1c0f0c', glow: '#ff6a1f' },
    wall: { k: 'stone', top: '#7a6562', top2: '#675452', side: '#3a2c2b', line: '#1c1313', vein: '#ff8a2a' },
    amb: [190, 138, 118], mote: { k: 'ember', c: '255,150,60' } },
  { name: 'Bunkern', sub: 'Betong och stål', accent: '#d7e34f', bg: '#171b14', bg2: '#060705', frame: '#3d4534',
    floor: { k: 'plate', a: '#4f574c', b: '#474f44', g: '#232720' },
    wall: { k: 'metal', top: '#a3b08f', top2: '#8f9c7c', side: '#566247', line: '#353d2a', rivet: '#dfe8cc', hazard: true },
    amb: [160, 171, 147], mote: { k: 'dust', c: '230,240,200' } },
  { name: 'Reaktorn', sub: 'Sista nedräkningen', accent: '#3df0ff', bg: '#0a1826', bg2: '#02060b', frame: '#1f3850',
    floor: { k: 'tile', a: '#203448', b: '#1b2d40', g: '#0b1620' },
    wall: { k: 'tech', top: '#3f5f80', top2: '#34516f', side: '#1a3048', line: '#0c1a28', vein: '#3df0ff' },
    amb: [138, 168, 213], mote: { k: 'spark', c: '90,240,255' } }
];

/* ---------- floor tiles ---------- */
function paintFloor(c, s, f, rnd) {
  c.fillStyle = f.g; c.fillRect(0, 0, s, s);
  const gap = Math.max(1, Math.round(s * 0.035));
  const col = () => shade(rnd() < .5 ? f.a : f.b, (rnd() - .5) * .12);
  const stone = (x, y, w, h, rad) => {
    c.fillStyle = col(); rr(c, x + gap / 2, y + gap / 2, w - gap, h - gap, rad); c.fill();
    c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x + gap * 1.5, y + gap / 2 + 1, w - gap * 3, Math.max(1, s * .02));
    c.fillStyle = 'rgba(0,0,0,.10)'; c.fillRect(x + gap * 1.5, y + h - gap / 2 - Math.max(1, s * .025) - 1, w - gap * 3, Math.max(1, s * .025));
  };
  if (f.k === 'flag') {
    const a = .35 + rnd() * .3, b = .35 + rnd() * .3;
    if (rnd() < .5) { stone(0, 0, s * a, s / 2, s * .05); stone(s * a, 0, s * (1 - a), s / 2, s * .05); stone(0, s / 2, s * b, s / 2, s * .05); stone(s * b, s / 2, s * (1 - b), s / 2, s * .05); }
    else { stone(0, 0, s / 2, s * a, s * .05); stone(0, s * a, s / 2, s * (1 - a), s * .05); stone(s / 2, 0, s / 2, s * b, s * .05); stone(s / 2, s * b, s / 2, s * (1 - b), s * .05); }
  } else if (f.k === 'tile') {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      stone(i * s / 2, j * s / 2, s / 2, s / 2, s * .02);
      c.fillStyle = 'rgba(255,255,255,.05)';
      c.beginPath(); c.moveTo(i * s / 2 + gap, j * s / 2 + gap); c.lineTo(i * s / 2 + s * .22, j * s / 2 + gap); c.lineTo(i * s / 2 + gap, j * s / 2 + s * .22); c.fill();
    }
  } else if (f.k === 'plate') {
    stone(0, 0, s, s, s * .04);
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = Math.max(1, s * .03); c.lineCap = 'round';
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const cx = s * (.25 + i * .25), cy = s * (.25 + j * .25), d = s * .055 * ((i + j) % 2 ? 1 : -1);
      c.beginPath(); c.moveTo(cx - s * .055, cy - d); c.lineTo(cx + s * .055, cy + d); c.stroke();
    }
    for (const [ax, ay] of [[.1, .1], [.9, .1], [.1, .9], [.9, .9]]) {
      c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, s * ax + 1, s * ay + 1, s * .03, s * .03); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)'; ell(c, s * ax, s * ay, s * .026, s * .026); c.fill();
    }
  } else {
    c.fillStyle = f.a; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 5; i++) {
      c.fillStyle = hexA(f.b, .35 + rnd() * .3);
      ell(c, s * (.2 + rnd() * .6), s * (.2 + rnd() * .6), s * (.1 + rnd() * .14), s * (.07 + rnd() * .1)); c.fill();
    }
    if (rnd() < .45) {
      c.strokeStyle = hexA(f.g, .45); c.lineWidth = Math.max(1, s * .018); c.lineCap = 'round'; c.lineJoin = 'round';
      let x = s * (.15 + rnd() * .7), y = s * (.15 + rnd() * .7);
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 2; k++) { x = clamp(x + (rnd() - .5) * s * .35, s * .08, s * .92); y = clamp(y + (rnd() - .5) * s * .35, s * .08, s * .92); c.lineTo(x, y); }
      c.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = s * (.12 + rnd() * .76), y = s * (.12 + rnd() * .76), r0 = s * (.018 + rnd() * .028);
      c.fillStyle = 'rgba(0,0,0,.22)'; ell(c, x + 1, y + 1, r0, r0 * .7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.1)'; ell(c, x, y, r0, r0 * .7); c.fill();
    }
    c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 1; c.strokeRect(.5, .5, s - 1, s - 1);
  }
  if (f.glow && rnd() < .5) {
    c.save();
    c.shadowColor = f.glow; c.shadowBlur = s * .16; c.strokeStyle = f.glow; c.lineWidth = Math.max(1.5, s * .035); c.lineCap = 'round'; c.lineJoin = 'round';
    let x = s * (.2 + rnd() * .6), y = s * (.2 + rnd() * .6);
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 3; k++) { x = clamp(x + (rnd() - .5) * s * .45, s * .12, s * .88); y = clamp(y + (rnd() - .5) * s * .45, s * .12, s * .88); c.lineTo(x, y); }
    c.stroke(); c.strokeStyle = '#ffe2a8'; c.lineWidth = Math.max(1, s * .012); c.stroke();
    c.restore();
  }
  for (let i = 0; i < 26; i++) {
    c.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)';
    const d = Math.max(1, s * .02); c.fillRect(rnd() * s, rnd() * s, d, d);
  }
}

/* ---------- wall blocks (top face + front face) ---------- */
function paintWall(c, s, hh, wl, rnd) {
  const p = Math.max(1, Math.round(s * 0.025)), w = s - 2 * p, r = s * .1, H = s + hh - p;
  const g0 = c.createLinearGradient(0, s - r, 0, s + hh);
  g0.addColorStop(0, wl.side); g0.addColorStop(1, shade(wl.side, -.5));
  c.fillStyle = g0; rr(c, p, 0, w, H, r); c.fill();
  // front face details
  c.save(); rr(c, p, 0, w, H, r); c.clip();
  c.strokeStyle = hexA(wl.line, .8); c.lineWidth = Math.max(1, s * .02);
  const fy = s - p, fh = hh;
  const hl = (y) => { c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke(); };
  const vl = (x, y0, y1) => { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); };
  if (wl.k === 'brick') { hl(fy + fh * .5); vl(s * .3, fy, fy + fh * .5); vl(s * .78, fy, fy + fh * .5); vl(s * .55, fy + fh * .5, fy + fh); vl(s * .1, fy + fh * .5, fy + fh); }
  else if (wl.k === 'tile') { vl(s * .34, fy, fy + fh); vl(s * .66, fy, fy + fh); }
  else if (wl.k === 'crate') { for (let i = 1; i < 4; i++) vl(s * i / 4, fy, fy + fh); }
  else if (wl.k === 'metal') {
    for (const ax of [.16, .5, .84]) { c.fillStyle = hexA(wl.rivet, .55); ell(c, s * ax, fy + fh * .45, s * .025, s * .025); c.fill(); }
    if (wl.snow) {
      // a drift of snow resting on the rock
      c.fillStyle = '#eef7ff';
      c.beginPath(); c.moveTo(p, th * .42);
      const n = 6;
      for (let k = 0; k <= n; k++) c.lineTo(p + w * k / n, th * (.28 + rnd() * .22));
      c.lineTo(p + w, 0); c.lineTo(p, 0); c.closePath(); c.fill();
      c.fillStyle = 'rgba(150,190,225,.45)';
      c.beginPath(); c.moveTo(p, th * .4);
      for (let k = 0; k <= n; k++) c.lineTo(p + w * k / n, th * (.36 + rnd() * .12));
      c.lineTo(p + w, th * .3); c.lineTo(p + w, th * .26); c.lineTo(p, th * .34); c.closePath(); c.fill();
      for (let k = 0; k < 5; k++) { c.fillStyle = 'rgba(255,255,255,.9)'; ell(c, p + w * rnd(), th * rnd() * .25, s * .012, s * .012); c.fill(); }
    }
  } else if (wl.k === 'tech') {
    c.save(); c.shadowColor = wl.vein; c.shadowBlur = s * .12; c.strokeStyle = wl.vein; c.lineWidth = Math.max(1.5, s * .03);
    c.beginPath(); c.moveTo(s * .2, fy + fh * .5); c.lineTo(s * .8, fy + fh * .5); c.stroke(); c.restore();
  } else if (wl.k === 'ice') {
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(s * .12, fy, s * .1, fh); c.fillRect(s * .62, fy, s * .05, fh);
  }
  c.restore();

  // top face
  const th = s - p;
  c.save(); rr(c, p, 0, w, th, r); c.clip();
  c.fillStyle = wl.top; c.fillRect(0, 0, s, s);
  const jit = (base, a) => shade(base, (rnd() - .5) * a);
  if (wl.k === 'brick') {
    c.fillStyle = wl.line; c.fillRect(0, 0, s, s);
    const rows = 3, rh = th / rows, m = Math.max(1, s * .022);
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * .5 + (rnd() - .5) * .08;
      for (let i = -1; i < 3; i++) {
        const bx = (i + off) * s / 2;
        c.fillStyle = jit(rnd() < .55 ? wl.top : wl.top2, .16);
        rr(c, bx + m, j * rh + m, s / 2 - 2 * m, rh - 2 * m, s * .02); c.fill();
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(bx + m * 2, j * rh + m, s / 2 - 4 * m, Math.max(1, s * .02));
      }
    }
  } else if (wl.k === 'tile') {
    c.fillStyle = wl.line; c.fillRect(0, 0, s, s);
    const n = 3, tw = (w) / n, m = Math.max(1, s * .018), sr = Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = p + i * tw, y = j * (th / n);
      c.fillStyle = (wl.stripe && j === sr) ? jit(wl.stripe, .1) : jit(rnd() < .6 ? wl.top : wl.top2, .06);
      rr(c, x + m, y + m, tw - 2 * m, th / n - 2 * m, s * .025); c.fill();
      c.fillStyle = 'rgba(255,255,255,.28)';
      c.beginPath(); c.moveTo(x + m * 2, y + m * 2); c.lineTo(x + tw * .5, y + m * 2); c.lineTo(x + m * 2, y + th / n * .5); c.fill();
    }
  } else if (wl.k === 'metal') {
    const ins = s * .13;
    c.fillStyle = wl.top2; rr(c, p + ins, ins, w - ins * 2, th - ins * 2, s * .05); c.fill();
    c.strokeStyle = hexA(wl.line, .7); c.lineWidth = Math.max(1, s * .022); c.stroke();
    if (wl.hazard) {
      c.save(); c.beginPath(); c.rect(p + ins, th * .56, w - ins * 2, th * .2); c.clip();
      c.fillStyle = '#e9c93a'; c.fillRect(0, 0, s, s); c.fillStyle = '#23241c';
      for (let i = -2; i < 8; i++) { c.beginPath(); const x = i * s * .16; c.moveTo(x, th * .56); c.lineTo(x + s * .08, th * .56); c.lineTo(x + s * .08 - th * .2, th * .76); c.lineTo(x - th * .2, th * .76); c.fill(); }
      c.restore();
    } else {
      const gl = c.createLinearGradient(p, 0, p + w, 0);
      gl.addColorStop(.15, 'rgba(255,255,255,0)'); gl.addColorStop(.32, 'rgba(255,255,255,.35)'); gl.addColorStop(.5, 'rgba(255,255,255,0)');
      c.fillStyle = gl; c.fillRect(p + ins, ins, w - ins * 2, th - ins * 2);
      c.fillStyle = hexA(wl.line, .55); c.fillRect(p + ins, th * .3, w - ins * 2, th * .06); c.fillRect(p + ins, th * .66, w - ins * 2, th * .06);
    }
    for (const [ax, ay] of [[.075, .075], [.925, .075], [.075, .925], [.925, .925]]) {
      c.fillStyle = 'rgba(0,0,0,.4)'; ell(c, p + w * ax + 1, th * ay + 1, s * .034, s * .034); c.fill();
      c.fillStyle = wl.rivet; ell(c, p + w * ax, th * ay, s * .03, s * .03); c.fill();
    }
  } else if (wl.k === 'crate') {
    for (let i = 0; i < 4; i++) { c.fillStyle = jit(i % 2 ? wl.top : wl.top2, .1); c.fillRect(p + i * w / 4, 0, w / 4, th); }
    c.strokeStyle = hexA(wl.line, .6); c.lineWidth = Math.max(1, s * .018);
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(p + i * w / 4, 0); c.lineTo(p + i * w / 4, th); c.stroke(); }
    // grain
    c.strokeStyle = hexA(wl.line, .22);
    for (let i = 0; i < 9; i++) { const x = p + rnd() * w, y = rnd() * th; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - .5) * s * .03, y + s * (.08 + rnd() * .12)); c.stroke(); }
    const bw = s * .13, flip = rnd() < .5;
    c.fillStyle = wl.top2; c.strokeStyle = hexA(wl.line, .8); c.lineWidth = Math.max(1, s * .02);
    c.beginPath();
    if (flip) { c.moveTo(p, 0); c.lineTo(p + bw, 0); c.lineTo(p + w, th - bw); c.lineTo(p + w, th); c.lineTo(p + w - bw, th); c.lineTo(p, bw); }
    else { c.moveTo(p + w, 0); c.lineTo(p + w - bw, 0); c.lineTo(p, th - bw); c.lineTo(p, th); c.lineTo(p + bw, th); c.lineTo(p + w, bw); }
    c.closePath(); c.fill(); c.stroke();
    c.lineWidth = bw; c.strokeStyle = shade(wl.top, .08); c.strokeRect(p + bw / 2, bw / 2, w - bw, th - bw);
    c.lineWidth = Math.max(1, s * .02); c.strokeStyle = hexA(wl.line, .8); c.strokeRect(p + bw, bw, w - bw * 2, th - bw * 2);
    for (const [ax, ay] of [[.07, .07], [.93, .07], [.07, .93], [.93, .93]]) { c.fillStyle = hexA(wl.line, .9); ell(c, p + w * ax, th * ay, s * .02, s * .02); c.fill(); }
  } else if (wl.k === 'ice') {
    const gi = c.createLinearGradient(0, 0, s, th); gi.addColorStop(0, wl.top); gi.addColorStop(1, wl.top2);
    c.fillStyle = gi; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = 'rgba(255,255,255,' + (.12 + rnd() * .2) + ')';
      c.beginPath(); const cx = s * (.2 + rnd() * .6), cy = th * (.2 + rnd() * .6);
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + rnd(), d = s * (.12 + rnd() * .2); k ? c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d) : c.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
      c.fill();
    }
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineCap = 'round'; c.lineWidth = Math.max(1.5, s * .04);
    c.beginPath(); c.moveTo(s * .18, th * .42); c.lineTo(s * .4, th * .18); c.stroke();
    c.lineWidth = Math.max(1, s * .022); c.beginPath(); c.moveTo(s * .26, th * .52); c.lineTo(s * .52, th * .24); c.stroke();
    c.strokeStyle = hexA(wl.line, .35); c.lineWidth = Math.max(1, s * .015);
    c.beginPath(); c.moveTo(s * (.5 + rnd() * .3), th * .95); c.lineTo(s * (.55 + rnd() * .2), th * .6); c.lineTo(s * .95, th * (.4 + rnd() * .3)); c.stroke();
  } else if (wl.k === 'stone') {
    for (let i = 0; i < 6; i++) {
      c.fillStyle = hexA(wl.top2, .5 + rnd() * .4);
      c.beginPath(); const cx = s * rnd(), cy = th * rnd();
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + rnd() * .6, d = s * (.12 + rnd() * .2); k ? c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d) : c.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
      c.fill();
    }
    c.strokeStyle = hexA(wl.line, .75); c.lineWidth = Math.max(1, s * .025); c.lineJoin = 'round'; c.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      let x = s * (.15 + rnd() * .7), y = 0;
      c.beginPath(); c.moveTo(x, y);
      while (y < th) { x = clamp(x + (rnd() - .5) * s * .4, s * .08, s * .92); y += th * (.2 + rnd() * .25); c.lineTo(x, y); }
      c.stroke();
    }
    if (wl.vein) {
      c.save(); c.shadowColor = wl.vein; c.shadowBlur = s * .18; c.strokeStyle = wl.vein; c.lineWidth = Math.max(1.5, s * .04);
      let x = s * (.2 + rnd() * .6), y = th * (.15 + rnd() * .2);
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 3; k++) { x = clamp(x + (rnd() - .5) * s * .5, s * .15, s * .85); y = clamp(y + th * (.12 + rnd() * .2), 0, th * .9); c.lineTo(x, y); }
      c.stroke(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = Math.max(1, s * .012); c.stroke();
      c.restore();
    }
  } else if (wl.k === 'tech') {
    const ins = s * .12;
    c.fillStyle = wl.top2; rr(c, p + ins, ins, w - ins * 2, th - ins * 2, s * .04); c.fill();
    c.save(); c.shadowColor = wl.vein; c.shadowBlur = s * .14; c.strokeStyle = wl.vein; c.lineWidth = Math.max(1.5, s * .028);
    rr(c, p + ins, ins, w - ins * 2, th - ins * 2, s * .04); c.stroke();
    const v = Math.floor(rnd() * 3);
    c.beginPath();
    if (v === 0) { c.moveTo(s * .5, ins); c.lineTo(s * .5, th * .38); c.moveTo(s * .5, th * .62); c.lineTo(s * .5, th - ins); }
    else if (v === 1) { c.moveTo(p + ins, th * .5); c.lineTo(s * .36, th * .5); c.moveTo(s * .64, th * .5); c.lineTo(p + w - ins, th * .5); }
    else { c.moveTo(p + ins, th * .3); c.lineTo(s * .35, th * .3); c.lineTo(s * .42, th * .4); c.moveTo(p + w - ins, th * .7); c.lineTo(s * .65, th * .7); c.lineTo(s * .58, th * .6); }
    c.stroke();
    c.fillStyle = wl.vein; rr(c, s * .41, th * .41, s * .18, th * .18, s * .03); c.fill();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.7)'; rr(c, s * .45, th * .45, s * .1, th * .1, s * .02); c.fill();
  }
  const lg = c.createLinearGradient(0, 0, s, th);
  lg.addColorStop(0, 'rgba(255,255,255,.24)'); lg.addColorStop(.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,.2)');
  c.fillStyle = lg; c.fillRect(0, 0, s, s);
  c.restore();
  const lw = Math.max(1, s * .028);
  c.lineWidth = lw; c.strokeStyle = 'rgba(255,255,255,.38)'; rr(c, p + lw / 2, lw / 2, w - lw, th - lw, r); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.moveTo(p + r, th - lw / 2); c.lineTo(p + w - r, th - lw / 2); c.stroke();
  c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.65)'; rr(c, p + .5, .5, w - 1, H - 1, r); c.stroke();
}

function paintShadow(c, s, pad) {
  c.save();
  c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = s * .16; c.shadowOffsetX = 4000; c.shadowOffsetY = 0;
  c.fillStyle = '#000'; rr(c, pad - 4000, pad, s, s, s * .1); c.fill();
  c.restore();
}

/* ---------- the hero: a small bomb technician in an orange suit ---------- */
function drawHero(c, x, y, s, h) {
  c.save(); c.translate(x, y);
  c.globalAlpha = h.alpha == null ? 1 : h.alpha;
  c.fillStyle = 'rgba(0,0,0,.38)'; ell(c, 0, s * .33, s * .27 * (h.sx || 1), s * .085); c.fill();
  c.translate(0, s * .33 - (h.lift || 0) * s); c.scale(h.sx || 1, h.sy || 1); c.translate(0, -s * .33);
  const dir = h.dir, mv = h.moving || 0;
  const fx = dir === 2 ? -1 : dir === 3 ? 1 : 0, fy = dir === 0 ? -1 : dir === 1 ? 1 : 0;
  const ph = Math.sin(h.walk * TAU) * mv;
  const bob = -Math.abs(Math.cos(h.walk * TAU)) * s * .03 * mv;
  const lean = (h.push || 0);
  const ol = Math.max(1, s * .025);
  c.lineJoin = 'round';
  // boots
  for (const i of [-1, 1]) {
    const o = i * ph * s * .06;
    const bx = i * s * .115 + (fx ? o : 0), by = s * .255 + (fy ? o * .6 : -Math.abs(o) * .3);
    c.fillStyle = '#20242e'; rr(c, bx - s * .09, by - s * .05, s * .18, s * .12, s * .05); c.fill();
    c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, bx - s * .07, by - s * .04, s * .1, s * .03, s * .015); c.fill();
  }
  const bx0 = fx * lean * s * .05, by0 = bob + fy * lean * s * .03;
  // back arm (behind body) when facing sideways
  const glove = (gx, gy) => {
    c.fillStyle = '#2b3140'; ell(c, gx, gy, s * .075, s * .075); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = ol; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.2)'; ell(c, gx - s * .02, gy - s * .025, s * .025, s * .02); c.fill();
  };
  const swing = ph * s * .05;
  if (fx) glove(bx0 - fx * s * .12 + fx * lean * s * .22 - fx * swing, s * .1 + by0);
  // body
  const g = c.createLinearGradient(-s * .2, 0, s * .2, s * .3);
  g.addColorStop(0, '#ffab4a'); g.addColorStop(1, '#de6417');
  c.fillStyle = g; rr(c, bx0 - s * .205, -s * .07 + by0, s * .41, s * .33, s * .13); c.fill();
  c.strokeStyle = '#6b2b05'; c.lineWidth = ol; c.stroke();
  c.save(); rr(c, bx0 - s * .205, -s * .07 + by0, s * .41, s * .33, s * .13); c.clip();
  c.fillStyle = '#fff3b0'; c.fillRect(-s * .3, s * .1 + by0, s * .6, s * .035);
  c.fillStyle = '#9aa0ad'; c.fillRect(-s * .3, s * .135 + by0, s * .6, s * .02);
  if (dir === 0) {
    c.fillStyle = '#3a4152'; rr(c, bx0 - s * .11, -s * .02 + by0, s * .22, s * .2, s * .04); c.fill();
    c.fillStyle = '#58e08f'; ell(c, bx0 + s * .05, s * .03 + by0, s * .02, s * .02); c.fill();
  } else if (dir === 1) {
    c.fillStyle = '#3a4152'; rr(c, bx0 - s * .07, s * .17 + by0, s * .14, s * .07, s * .02); c.fill();
    c.fillStyle = '#ff5340'; ell(c, bx0 - s * .03, s * .205 + by0, s * .014, s * .014); c.fill();
    c.fillStyle = '#58e08f'; ell(c, bx0 + s * .03, s * .205 + by0, s * .014, s * .014); c.fill();
  }
  c.restore();
  // arms
  if (fx) glove(bx0 + fx * s * .1 + fx * lean * s * .16 + fx * swing, s * .13 + by0);
  else {
    const ay = s * .1 + by0 + fy * lean * s * .12;
    glove(bx0 - s * .235, ay + swing * .6); glove(bx0 + s * .235, ay - swing * .6);
  }
  // helmet
  const hx = bx0 + fx * s * .035, hy = -s * .19 + by0 * 1.2 + fy * lean * s * .02;
  const hg = c.createRadialGradient(hx - s * .08, hy - s * .1, s * .02, hx, hy, s * .27);
  hg.addColorStop(0, '#fff3a6'); hg.addColorStop(.55, '#ffcf33'); hg.addColorStop(1, '#d99a00');
  c.fillStyle = hg; ell(c, hx, hy, s * .25, s * .235); c.fill();
  c.strokeStyle = '#6b4a00'; c.lineWidth = ol; c.stroke();
  // helmet ridge
  c.strokeStyle = 'rgba(120,80,0,.5)'; c.lineWidth = Math.max(1, s * .02);
  c.beginPath(); c.arc(hx, hy, s * .25, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  if (dir !== 0) {
    const vw = dir === 1 ? s * .33 : s * .25, vx = hx + fx * s * .075 - vw / 2, vy = hy - s * .04;
    c.fillStyle = '#141b29'; rr(c, vx, vy, vw, s * .15, s * .065); c.fill();
    c.strokeStyle = '#05080d'; c.lineWidth = Math.max(1, s * .018); c.stroke();
    const vg = c.createLinearGradient(vx, vy, vx + vw, vy + s * .15);
    vg.addColorStop(0, 'rgba(120,220,255,.75)'); vg.addColorStop(.45, 'rgba(120,220,255,0)');
    c.fillStyle = vg; rr(c, vx + s * .015, vy + s * .015, vw - s * .03, s * .12, s * .05); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; rr(c, vx + s * .035, vy + s * .03, s * .06, s * .025, s * .012); c.fill();
  } else {
    c.fillStyle = 'rgba(120,80,0,.35)'; rr(c, hx - s * .03, hy - s * .2, s * .06, s * .32, s * .03); c.fill();
  }
  // headlamp
  const lx = hx + fx * s * .13, ly = hy - (dir === 0 ? s * .2 : s * .17) + (dir === 1 ? s * .02 : 0);
  c.fillStyle = '#3a4152'; rr(c, lx - s * .05, ly - s * .035, s * .1, s * .07, s * .02); c.fill();
  c.fillStyle = '#fffbe0'; ell(c, lx, ly, s * .03, s * .03); c.fill();
  c.globalCompositeOperation = 'lighter';
  const lgl = c.createRadialGradient(lx, ly, 0, lx, ly, s * .16);
  lgl.addColorStop(0, 'rgba(255,240,180,.7)'); lgl.addColorStop(1, 'rgba(255,240,180,0)');
  c.fillStyle = lgl; ell(c, lx, ly, s * .16, s * .16); c.fill();
  c.restore();
}

/* ---------- bombs ---------- */
function drawBomb(c, x, y, s, t, urg, state) {
  // state: 0 live, 1 defused
  c.save(); c.translate(x, y);
  const pulse = state ? 0 : .5 + .5 * Math.sin(t * (4 + urg * 10));
  if (!state) {
    c.globalCompositeOperation = 'lighter';
    const rg = c.createRadialGradient(0, s * .12, s * .05, 0, s * .12, s * .55);
    rg.addColorStop(0, 'rgba(255,70,40,' + (.22 + pulse * .2) + ')'); rg.addColorStop(1, 'rgba(255,70,40,0)');
    c.fillStyle = rg; ell(c, 0, s * .12, s * .55, s * .45); c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  c.fillStyle = 'rgba(0,0,0,.4)'; ell(c, s * .02, s * .32, s * .25, s * .08); c.fill();
  const by = s * .07 - (state ? 0 : pulse * s * .012), r = s * .255;
  const g = c.createRadialGradient(-r * .4, by - r * .45, r * .05, 0, by, r);
  g.addColorStop(0, '#7d8798'); g.addColorStop(.35, '#353b48'); g.addColorStop(1, '#0c0e13');
  c.fillStyle = g; ell(c, 0, by, r, r); c.fill();
  c.strokeStyle = '#000'; c.lineWidth = Math.max(1, s * .022); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = Math.max(1, s * .03); c.lineCap = 'round';
  c.beginPath(); c.arc(0, by, r * .68, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
  // warning band
  c.save(); ell(c, 0, by, r, r); c.clip();
  c.fillStyle = state ? '#58e08f' : '#ff5340'; c.fillRect(-r, by + r * .28, r * 2, r * .2);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-r, by + r * .44, r * 2, r * .05);
  c.restore();
  // cap
  c.fillStyle = '#9aa3b2'; rr(c, -s * .065, by - r - s * .045, s * .13, s * .085, s * .02); c.fill();
  c.strokeStyle = '#000'; c.lineWidth = Math.max(1, s * .018); c.stroke();
  // fuse
  const fx = s * .19, fyy = by - r - s * .17;
  c.strokeStyle = '#3d2c18'; c.lineWidth = s * .055; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, by - r - s * .04); c.quadraticCurveTo(s * .02, fyy - s * .02, fx, fyy); c.stroke();
  c.strokeStyle = '#d9b47a'; c.lineWidth = s * .032;
  c.beginPath(); c.moveTo(0, by - r - s * .04); c.quadraticCurveTo(s * .02, fyy - s * .02, fx, fyy); c.stroke();
  if (!state) {
    c.globalCompositeOperation = 'lighter';
    const fl = .7 + .3 * Math.sin(t * 37) * Math.sin(t * 23);
    const sg = c.createRadialGradient(fx, fyy, 0, fx, fyy, s * .2 * fl);
    sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(.25, 'rgba(255,190,60,.9)'); sg.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = sg; ell(c, fx, fyy, s * .2, s * .2); c.fill();
    c.strokeStyle = 'rgba(255,230,150,.9)'; c.lineWidth = Math.max(1, s * .018);
    for (let i = 0; i < 5; i++) {
      const a = t * 9 + i * 1.3 + Math.sin(t * 31 + i) * .8, d = s * (.07 + .09 * Math.abs(Math.sin(t * 19 + i * 2.1)));
      c.beginPath(); c.moveTo(fx + Math.cos(a) * s * .03, fyy + Math.sin(a) * s * .03); c.lineTo(fx + Math.cos(a) * d, fyy + Math.sin(a) * d); c.stroke();
    }
  } else {
    c.fillStyle = '#58e08f'; c.strokeStyle = '#0b3d20'; c.lineWidth = Math.max(1, s * .02);
    c.beginPath(); c.moveTo(-s * .1, by - s * .02); c.lineTo(-s * .03, by + s * .05); c.lineTo(s * .11, by - s * .09);
    c.lineWidth = s * .06; c.strokeStyle = '#58e08f'; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  c.restore();
}

/* ---------- fixed pillar: a dark anchored block that will not budge ---------- */
function paintPillar(c, s, hh, th) {
  const p = Math.max(1, Math.round(s * 0.025)), w = s - 2 * p, r = s * .08, H = s + hh - p, tp = s - p;
  const g0 = c.createLinearGradient(0, tp - r, 0, s + hh);
  g0.addColorStop(0, '#3a3f48'); g0.addColorStop(1, '#101216');
  c.fillStyle = g0; rr(c, p, 0, w, H, r); c.fill();
  // front face: iron plate with two bolts
  for (const ax of [.2, .8]) {
    c.fillStyle = 'rgba(0,0,0,.5)'; ell(c, s * ax + 1, tp + hh * .5 + 1, s * .04, s * .04); c.fill();
    c.fillStyle = '#8d949f'; ell(c, s * ax, tp + hh * .5, s * .036, s * .036); c.fill();
  }
  c.save(); rr(c, p, 0, w, tp, r); c.clip();
  const tg = c.createLinearGradient(0, 0, s, tp);
  tg.addColorStop(0, shade(th.frame, .05)); tg.addColorStop(1, shade(th.frame, -.45));
  c.fillStyle = tg; c.fillRect(0, 0, s, s);
  // iron frame
  const b = s * .14;
  c.lineWidth = b; c.strokeStyle = '#25282e'; c.strokeRect(p + b / 2, b / 2, w - b, tp - b);
  c.lineWidth = Math.max(1, s * .02); c.strokeStyle = 'rgba(255,255,255,.18)'; c.strokeRect(p + b * .2, b * .2, w - b * .4, tp - b * .4);
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeRect(p + b, b, w - b * 2, tp - b * 2);
  // cross brace
  c.save(); c.beginPath(); c.rect(p + b, b, w - b * 2, tp - b * 2); c.clip();
  c.lineCap = 'butt'; c.lineWidth = s * .1; c.strokeStyle = '#2b2f36';
  c.beginPath(); c.moveTo(p + b, b); c.lineTo(p + w - b, tp - b); c.moveTo(p + w - b, b); c.lineTo(p + b, tp - b); c.stroke();
  c.lineWidth = Math.max(1, s * .018); c.strokeStyle = 'rgba(255,255,255,.14)';
  c.beginPath(); c.moveTo(p + b, b - s * .04); c.lineTo(p + w - b + s * .04, tp - b); c.stroke();
  c.restore();
  // corner bolts and centre nut
  for (const [ax, ay] of [[.12, .12], [.88, .12], [.12, .88], [.88, .88]]) {
    c.fillStyle = 'rgba(0,0,0,.55)'; ell(c, p + w * ax + 1, tp * ay + 1, s * .045, s * .045); c.fill();
    const bg = c.createRadialGradient(p + w * ax - s * .015, tp * ay - s * .015, 0, p + w * ax, tp * ay, s * .045);
    bg.addColorStop(0, '#e6eaf0'); bg.addColorStop(1, '#6b727d');
    c.fillStyle = bg; ell(c, p + w * ax, tp * ay, s * .042, s * .042); c.fill();
  }
  const nx = s / 2, ny = tp / 2, nr = s * .1;
  c.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; k ? c.lineTo(nx + Math.cos(a) * nr, ny + Math.sin(a) * nr) : c.moveTo(nx + Math.cos(a) * nr, ny + Math.sin(a) * nr); } c.closePath();
  const ng = c.createLinearGradient(nx - nr, ny - nr, nx + nr, ny + nr); ng.addColorStop(0, '#c9ced6'); ng.addColorStop(1, '#4d535c');
  c.fillStyle = ng; c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1; c.stroke();
  c.fillStyle = '#2a2e35'; ell(c, nx, ny, nr * .42, nr * .42); c.fill();
  c.restore();
  c.lineWidth = Math.max(1, s * .028); c.strokeStyle = 'rgba(255,255,255,.22)'; rr(c, p + .5, .5, w - 1, tp - 1, r); c.stroke();
  c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.8)'; rr(c, p + .5, .5, w - 1, H - 1, r); c.stroke();
}

/* ---------- ice block: translucent, slides until it hits something ---------- */
function paintIce(c, s, hh, rnd) {
  const p = Math.max(1, Math.round(s * 0.025)), w = s - 2 * p, r = s * .12, H = s + hh - p, tp = s - p;
  const fg = c.createLinearGradient(0, tp - r, 0, s + hh);
  fg.addColorStop(0, 'rgba(110,190,235,.86)'); fg.addColorStop(1, 'rgba(30,95,160,.92)');
  c.fillStyle = fg; rr(c, p, 0, w, H, r); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(p + w * .12, tp, w * .07, hh * .9); c.fillRect(p + w * .7, tp, w * .035, hh * .8);
  c.save(); rr(c, p, 0, w, tp, r); c.clip();
  const tg = c.createLinearGradient(p, 0, p + w, tp);
  tg.addColorStop(0, 'rgba(235,250,255,.95)'); tg.addColorStop(.55, 'rgba(170,225,250,.88)'); tg.addColorStop(1, 'rgba(110,185,235,.9)');
  c.fillStyle = tg; c.fillRect(0, 0, s, s);
  // inner facets
  for (let k = 0; k < 4; k++) {
    c.fillStyle = 'rgba(255,255,255,' + (.1 + rnd() * .18) + ')';
    const x0 = p + w * (.15 + rnd() * .7), y0 = tp * (.15 + rnd() * .7);
    c.beginPath(); c.moveTo(x0, y0);
    for (let q = 0; q < 3; q++) c.lineTo(x0 + (rnd() - .5) * s * .45, y0 + (rnd() - .5) * s * .45);
    c.closePath(); c.fill();
  }
  c.strokeStyle = 'rgba(70,140,200,.35)'; c.lineWidth = Math.max(1, s * .012);
  c.beginPath(); c.moveTo(p + w * .55, tp * .95); c.lineTo(p + w * .62, tp * .6); c.lineTo(p + w * .9, tp * .48); c.moveTo(p + w * .62, tp * .6); c.lineTo(p + w * .45, tp * .42); c.stroke();
  // bubbles
  for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, p + w * (.2 + rnd() * .6), tp * (.2 + rnd() * .6), s * (.008 + rnd() * .014), s * (.008 + rnd() * .014)); c.fill(); }
  // specular streaks
  c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineCap = 'round'; c.lineWidth = Math.max(1.5, s * .045);
  c.beginPath(); c.moveTo(p + w * .14, tp * .4); c.lineTo(p + w * .36, tp * .14); c.stroke();
  c.lineWidth = Math.max(1, s * .022); c.beginPath(); c.moveTo(p + w * .2, tp * .55); c.lineTo(p + w * .5, tp * .2); c.stroke();
  c.restore();
  c.lineWidth = Math.max(1, s * .03); c.strokeStyle = 'rgba(255,255,255,.85)'; rr(c, p + c.lineWidth / 2, c.lineWidth / 2, w - c.lineWidth, tp - c.lineWidth, r); c.stroke();
  c.lineWidth = 1; c.strokeStyle = 'rgba(20,60,110,.8)'; rr(c, p + .5, .5, w - 1, H - 1, r); c.stroke();
}

/* ---------- hole in the floor, and a hole that a block has filled ---------- */
function paintHole(c, s, th) {
  const f = th.floor, m = Math.max(1, s * .06), r = s * .08, iw = s - 2 * m;
  c.save(); rr(c, m, m, iw, iw, r); c.clip();
  c.fillStyle = '#020304'; c.fillRect(0, 0, s, s);
  // far inner wall (we look down into the pit from the front)
  const dep = iw * .46;
  const wg = c.createLinearGradient(0, m, 0, m + dep);
  wg.addColorStop(0, shade(f.a, -.05)); wg.addColorStop(.6, shade(f.a, -.6)); wg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = wg; c.fillRect(0, m, s, dep);
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = Math.max(1, s * .018);
  for (let k = 1; k < 3; k++) { const y = m + dep * k / 3.2; c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke(); }
  for (let k = 0; k < 4; k++) { const x = m + iw * (k + (k % 2 ? .5 : .25)) / 4, y0 = m + dep * (k % 2 ? 1 : 0) / 3.2; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + dep / 3.2); c.stroke(); }
  // side walls narrowing into the dark
  c.fillStyle = 'rgba(255,255,255,.06)';
  c.beginPath(); c.moveTo(m, m); c.lineTo(m + iw * .16, m + dep); c.lineTo(m + iw * .16, s); c.lineTo(m, s); c.fill();
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath(); c.moveTo(s - m, m); c.lineTo(s - m - iw * .16, m + dep); c.lineTo(s - m - iw * .16, s); c.lineTo(s - m, s); c.fill();
  c.restore();
  // stone lip around the pit
  c.lineWidth = Math.max(2, s * .06); c.strokeStyle = shade(f.a, .18); rr(c, m, m, iw, iw, r); c.stroke();
  c.lineWidth = Math.max(1, s * .02); c.strokeStyle = 'rgba(0,0,0,.6)'; rr(c, m + s * .03, m + s * .03, iw - s * .06, iw - s * .06, r * .8); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(m + r, s - m + s * .02); c.lineTo(s - m - r, s - m + s * .02); c.stroke();
}
function paintPlug(c, s, block) {
  const m = Math.max(1, s * .05), r = s * .1;
  c.save(); rr(c, m, m, s - 2 * m, s - 2 * m, r); c.clip();
  c.drawImage(block, 0, 0, s, s, 0, 0, s, s);
  c.fillStyle = 'rgba(10,10,12,.34)'; c.fillRect(0, 0, s, s);
  const ig = c.createLinearGradient(0, m, 0, m + s * .2); ig.addColorStop(0, 'rgba(0,0,0,.55)'); ig.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = ig; c.fillRect(0, 0, s, s * .25);
  c.restore();
  c.lineWidth = Math.max(1, s * .03); c.strokeStyle = 'rgba(0,0,0,.55)'; rr(c, m, m, s - 2 * m, s - 2 * m, r); c.stroke();
  c.lineWidth = Math.max(1, s * .015); c.strokeStyle = 'rgba(255,255,255,.18)';
  c.beginPath(); c.moveTo(m + r, s - m - 1); c.lineTo(s - m - r, s - m - 1); c.stroke();
}

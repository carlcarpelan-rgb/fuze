/* ===== Procedural music: one key and groove per world, tighter on boss levels and when the fuse runs low ===== */
const Music = {
  bus: null, timer: 0, next: 0, step: 0, want: null,
  ROOTS: [110, 98, 116.54, 103.83, 110, 92.5, 123.47, 87.31, 103.83, 116.54],
  PROGS: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 5, 2, 6], [0, 6, 5, 4], [0, 3, 6, 4], [0, 5, 3, 6], [0, 2, 5, 4], [0, 6, 3, 4], [0, 4, 5, 3], [0, 5, 6, 4]],
  SCALE: [0, 2, 3, 5, 7, 8, 10],
  set(mode) { this.want = mode; this.kick(); },
  enabled() { return this.want && Save.d.music !== false; },
  kick() {
    const ac = Snd.ac; if (!ac) return;
    if (!this.bus) this.build(ac);
    const on = this.enabled();
    const level = on ? (this.want.menu ? .55 : 1) : 0;
    try { this.bus.gain.setTargetAtTime(level * .2, ac.currentTime, .35); } catch (e) { /* ignore */ }
    if (on && !this.timer) { this.next = ac.currentTime + .08; this.timer = setInterval(() => this.sched(), 40); }
    if (!on && this.timer) setTimeout(() => { if (!this.enabled() && this.timer) { clearInterval(this.timer); this.timer = 0; } }, 1500);
  },
  build(ac) {
    this.bus = ac.createGain(); this.bus.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    const dl = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
    dl.delayTime.value = .3; fb.gain.value = .3; wet.gain.value = .28;
    this.bus.connect(lp); this.bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(lp);
    lp.connect(Snd.out);
  },
  semi(world, deg) {
    const n = this.SCALE.length, o = Math.floor(deg / n), d = ((deg % n) + n) % n;
    return this.ROOTS[world % this.ROOTS.length] * Math.pow(2, (this.SCALE[d] + 12 * o) / 12);
  },
  voice(type, f, t, dur, vol, o) {
    const ac = Snd.ac; o = o || {};
    try {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur * .8);
      if (o.detune) osc.detune.value = o.detune;
      const a = o.attack || .006;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      let node = osc;
      if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); node = fl; }
      node.connect(g); g.connect(this.bus); osc.start(t); osc.stop(t + dur + .05);
    } catch (e) { /* ignore */ }
  },
  hat(t, vol) {
    const ac = Snd.ac; if (!Snd.nz) return;
    try {
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = Snd.nz; fl.type = 'highpass'; fl.frequency.value = 7000;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
      s.connect(fl); fl.connect(g); g.connect(this.bus); s.start(t, Math.random() * .5); s.stop(t + .07);
    } catch (e) { /* ignore */ }
  },
  sched() {
    const ac = Snd.ac; if (!ac || !this.want) return;
    const m = this.want, w = m.world | 0;
    const bpm = m.menu ? 84 : m.boss ? 134 + w * 2 : 96 + w * 3;
    const sd = 60 / bpm / 4;
    if (this.next < ac.currentTime - .2) this.next = ac.currentTime + .05;
    while (this.next < ac.currentTime + .25) {
      const t = this.next, s = this.step, pos = s % 16, bar = Math.floor(s / 16) % 4;
      if (!Save.d.mute && this.enabled() && !Platform.adBusy) this.play(t, pos, bar, w, m, sd);
      this.next += sd; this.step++;
    }
  },
  play(t, pos, bar, w, m, sd) {
    const prog = this.PROGS[w % this.PROGS.length], root = prog[bar];
    const intense = !m.menu && typeof G !== 'undefined' && G.mode === 'play' && G.timeLeft < 10;
    // pad: a soft chord swelling over each bar
    if (pos === 0) {
      for (const [deg, dt] of [[root, -7], [root + 2, 6], [root + 4, -4]]) this.voice('sawtooth', this.semi(w, deg + 7), t, sd * 16, .028, { attack: .5, lp: 900, detune: dt });
    }
    // bass
    const bassHits = m.boss ? [0, 3, 6, 8, 11, 14] : [0, 6, 10];
    if (!m.menu ? bassHits.includes(pos) : pos === 0 || pos === 8) this.voice('triangle', this.semi(w, root) / 2, t, sd * 2.6, .34, { lp: 600 });
    // kick
    if (!m.menu && (m.boss || intense ? pos % 4 === 0 : pos % 8 === 0)) this.voice('sine', 130, t, .16, .55, { to: 42 });
    // hats
    if (!m.menu) { if (intense || m.boss ? pos % 2 === 1 : pos % 4 === 2) this.hat(t, pos % 4 === 2 ? .07 : .04); }
    // arpeggio
    const pat = [0, 2, 4, 2, 7, 4, 2, 4];
    const arpOn = m.menu ? pos % 4 === 0 : intense ? true : pos % 2 === 0;
    if (arpOn) {
      const k = (m.menu ? pos / 4 : intense ? pos : pos / 2) % pat.length;
      this.voice(intense ? 'square' : 'triangle', this.semi(w, root + pat[k | 0]) * 2, t, sd * 1.7, intense ? .045 : .07, { lp: intense ? 2600 : 3600 });
    }
    // a little lead phrase every other bar during play
    if (!m.menu && bar % 2 === 1 && (pos === 4 || pos === 7 || pos === 10)) this.voice('square', this.semi(w, root + [4, 2, 0][pos === 4 ? 0 : pos === 7 ? 1 : 2]) * 4, t, sd * 2.2, .03, { lp: 2200 });
  }
};

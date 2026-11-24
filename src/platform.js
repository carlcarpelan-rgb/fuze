/* ===== Platform layer: CrazyGames SDK when present, plain browser otherwise ===== */
const Platform = {
  sdk: null, playing: null, adBusy: false, sysMute: false, levelsThisSession: 0,
  async init() {
    try {
      const C = window.CrazyGames && window.CrazyGames.SDK;
      if (C) {
        await C.init();
        if (C.environment === 'crazygames' || C.environment === 'local') this.sdk = C;
      }
    } catch (e) { this.sdk = null; }
    if (this.sdk) {
      try {
        const s = this.sdk.game.settings; if (s && s.muteAudio) this.sysMute = true;
        if (this.sdk.game.addSettingsChangeListener) this.sdk.game.addSettingsChangeListener(ns => { this.sysMute = !!(ns && ns.muteAudio); Snd.applyGain(); });
      } catch (e) { /* settings are optional */ }
    }
  },
  isMobile() {
    if (this.sdk) {
      try { const t = this.sdk.user.systemInfo.device.type; return t === 'mobile' || t === 'tablet'; } catch (e) { /* fall back below */ }
    }
    return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  },
  getItem(k) {
    try { return this.sdk ? this.sdk.data.getItem(k) : localStorage.getItem(k); } catch (e) { return null; }
  },
  setItem(k, v) {
    try { if (this.sdk) this.sdk.data.setItem(k, v); else localStorage.setItem(k, v); } catch (e) { /* keep playing without saving */ }
  },
  gameplay(on) {
    if (on === this.playing) return;
    this.playing = on;
    if (!this.sdk) return;
    try { if (on) this.sdk.game.gameplayStart(); else this.sdk.game.gameplayStop(); } catch (e) { /* ignore */ }
  },
  happy() { if (this.sdk) try { this.sdk.game.happytime(); } catch (e) { /* ignore */ } },
  // A midgame ad at a natural break. The SDK itself limits how often one is shown.
  // Calls done() exactly once: after the ad, after an error, or if nothing starts.
  breakThen(done) {
    if (!this.sdk || this.levelsThisSession < 3) { done(); return; }
    let finished = false, started = false;
    const end = () => { if (finished) return; finished = true; this.adBusy = false; Snd.applyGain(); done(); };
    this.adBusy = true;
    try {
      this.sdk.ad.requestAd('midgame', {
        adStarted: () => { started = true; Snd.applyGain(); },
        adFinished: end,
        adError: end
      });
    } catch (e) { end(); return; }
    setTimeout(() => { if (!started) end(); }, 2500);
  }
};

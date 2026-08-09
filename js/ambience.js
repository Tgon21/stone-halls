/* A room tone for a stone building, synthesised — no audio files.
   A low drone through a long convolution, and a bell now and then. */

let ctx = null, master = null, running = false, bellTimer = null;

function impulse(seconds, decay) {
  const rate = ctx.sampleRate, len = rate * seconds;
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function start() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const verb = ctx.createConvolver();
  verb.buffer = impulse(5.5, 2.4);
  const wet = ctx.createGain(); wet.gain.value = 0.9;
  verb.connect(wet); wet.connect(master);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = .6;
  lp.connect(verb); lp.connect(master);

  [55, 82.4, 110.5].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine';
    o.frequency.value = f * (1 + (i - 1) * 0.0015);
    const g = ctx.createGain(); g.gain.value = [0.16, 0.09, 0.045][i];
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045 + i * 0.021;
    const lg = ctx.createGain(); lg.gain.value = [0.07, 0.05, 0.03][i];
    lfo.connect(lg); lg.connect(g.gain);
    o.connect(g); g.connect(lp); o.start(); lfo.start();
  });

  const bell = () => {
    if (!running) return;
    const t = ctx.currentTime;
    [1, 2.02, 2.98, 4.11].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = 220 * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.055 / (i + 1), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5 - i * 0.7);
      o.connect(g); g.connect(verb); o.start(t); o.stop(t + 6);
    });
    bellTimer = setTimeout(bell, 26000 + Math.random() * 40000);
  };
  bellTimer = setTimeout(bell, 9000);

  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3);
}

export const ambience = {
  toggle() {
    if (!running) {
      if (!ctx) start(); else { ctx.resume(); master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2); }
      running = true;
    } else {
      running = false;
      clearTimeout(bellTimer);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      setTimeout(() => !running && ctx.suspend(), 1400);
    }
    return running;
  },
};

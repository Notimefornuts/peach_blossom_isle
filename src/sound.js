export function createSound() {
  let context, master, active = false,
    next = 0;

  function initialize() {
    context = new(window.AudioContext || window.webkitAudioContext)();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    const b = context.createBuffer(1, context.sampleRate * 4, context.sampleRate),
      a = b.getChannelData(0);
    let value = 0;
    for (let i = 0; i < a.length; i++) {
      value = (value + .04 * (Math.random() * 2 - 1)) / 1.025;
      a[i] = value;
    }
    const n = context.createBufferSource();
    n.buffer = b;
    n.loop = true;
    const f = context.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1300;
    n.connect(f);
    f.connect(master);
    n.start();
  }

  function tone(hz, volume = .1, decay = 1.8) {
    if (!active) return;
    const now = context.currentTime,
      o = context.createOscillator(),
      g = context.createGain();
    o.type = 'sine';
    o.frequency.value = hz;
    g.gain.setValueAtTime(.0001, now);
    g.gain.exponentialRampToValueAtTime(volume, now + .016);
    g.gain.exponentialRampToValueAtTime(.0001, now + decay);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(now + decay + .03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  return {
    async toggle() {
      if (!context) initialize();
      active = !active;
      if (active) await context.resume();
      master.gain.setTargetAtTime(active ? .45 : 0, context.currentTime, .12);
      return active;
    },
    act(id) {
      tone(id === 'relations' ? 570 : id === 'lake' ? 350 : 740, id === 'relations' ? .12 : .06, id ===
        'relations' ? .1 : 1.5);
    },
    update(t) {
      if (t > next) {
        next = t + 12 + Math.random() * 11;
        tone([660, 740, 880][Math.floor(Math.random() * 3)], .03, 2.4);
      }
    }
  };
}

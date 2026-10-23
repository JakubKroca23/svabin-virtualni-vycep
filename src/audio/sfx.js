/** Short Mixkit-style SFX keys: can-open, bottle-open, pour-loop, foam, sip, burp */
const GAIN_BY_NAME = {
  burp: 1.55,
  sip: 1,
};

export function createSfx(baseUrl = `${import.meta.env.BASE_URL}sounds/`) {
  let enabled = false;
  let ctx = null;
  const buffers = new Map();
  const loops = new Map();

  async function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async function load(name) {
    if (buffers.has(name)) return buffers.get(name);
    const res = await fetch(`${baseUrl}${name}.mp3`);
    const arr = await res.arrayBuffer();
    await ensure();
    const buf = await ctx.decodeAudioData(arr.slice(0));
    buffers.set(name, buf);
    return buf;
  }

  return {
    async unlock() {
      await ensure();
    },
    setEnabled(v) {
      enabled = v;
      if (!v) this.stopLoop('pour-loop');
    },
    isEnabled: () => enabled,
    async play(name) {
      if (!enabled) return;
      await ensure();
      const buf = await load(name);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gainNode = ctx.createGain();
      gainNode.gain.value = GAIN_BY_NAME[name] ?? 1;
      src.connect(gainNode);
      gainNode.connect(ctx.destination);
      src.start();
    },
    async startLoop(name) {
      if (!enabled || loops.has(name)) return;
      await ensure();
      const buf = await load(name);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(ctx.destination);
      src.start();
      loops.set(name, src);
    },
    stopLoop(name) {
      const src = loops.get(name);
      if (src) {
        try {
          src.stop();
        } catch {}
        loops.delete(name);
      }
    },
  };
}

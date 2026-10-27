// Minimal BaseAudioContext stand-in for node tests: records what each recipe creates and connects.

interface FakeParam {
  value: number;
  setValueAtTime(v: number, t: number): FakeParam;
  exponentialRampToValueAtTime(v: number, t: number): FakeParam;
  linearRampToValueAtTime(v: number, t: number): FakeParam;
  setTargetAtTime(v: number, t: number, c: number): FakeParam;
}

export interface FakeCtx extends BaseAudioContext {
  readonly created: Record<string, number>;
  /** Latest stop time of any scheduled source. */
  readonly lastStop: () => number;
}

const param = (value = 0): FakeParam => {
  const p: FakeParam = {
    value,
    setValueAtTime: () => p,
    exponentialRampToValueAtTime: (v) => {
      if (!(v > 0)) throw new RangeError('exponential ramp target must be > 0');
      return p;
    },
    linearRampToValueAtTime: () => p,
    setTargetAtTime: () => p,
  };
  return p;
};

export function fakeCtx(opts: { noPanner?: boolean } = {}): FakeCtx {
  const created: Record<string, number> = {};
  let lastStop = 0;
  const node = (kind: string, extra: Record<string, unknown> = {}) => {
    created[kind] = (created[kind] ?? 0) + 1;
    const n = {
      connected: [] as unknown[],
      connect(dest: unknown) {
        n.connected.push(dest);
        return dest;
      },
      disconnect() {
        n.connected.length = 0;
      },
      start: () => undefined,
      stop: (t: number) => {
        lastStop = Math.max(lastStop, t);
      },
      onended: null as null | (() => void),
      ...extra,
    };
    return n;
  };
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    created,
    lastStop: () => lastStop,
    createGain: () => node('Gain', { gain: param(1) }),
    createOscillator: () => node('Oscillator', { type: 'sine', frequency: param(440), detune: param(0) }),
    createBiquadFilter: () => node('BiquadFilter', { type: 'lowpass', frequency: param(350), Q: param(1) }),
    createWaveShaper: () => node('WaveShaper', { curve: null }),
    createBufferSource: () => node('BufferSource', { buffer: null }),
    createDynamicsCompressor: () =>
      node('DynamicsCompressor', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createBuffer: (_ch: number, len: number) => {
      const data = new Float32Array(len);
      return { getChannelData: () => data };
    },
    ...(opts.noPanner ? {} : { createStereoPanner: () => node('StereoPanner', { pan: param(0) }) }),
  };
  return ctx as unknown as FakeCtx;
}

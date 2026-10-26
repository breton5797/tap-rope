// Low-level WebAudio voices shared by sfx and music. Every voice cleans itself up.

export interface ToneOpts {
  readonly type?: OscillatorType;
  readonly freq: number;
  readonly freqEnd?: number; // exponential glide target
  readonly start: number; // ctx time
  readonly dur: number;
  readonly gain?: number;
  readonly attack?: number;
  readonly detune?: number;
  readonly filter?: number; // lowpass cutoff
  readonly filterEnd?: number; // exponential lowpass sweep target (needs `filter`)
  readonly q?: number; // lowpass resonance
  readonly drive?: number; // 0..1 soft-clip distortion before the filter
}

export interface NoiseOpts {
  readonly start: number;
  readonly dur: number;
  readonly gain?: number;
  readonly type?: BiquadFilterType;
  readonly freq?: number;
  readonly q?: number;
  readonly freqEnd?: number;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1), ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  noiseCache.set(ctx, buf);
  return buf;
}

function envelope(ctx: BaseAudioContext, start: number, dur: number, peak: number, attack: number): GainNode {
  const g = ctx.createGain();
  const a = Math.min(attack, dur * 0.5);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + a);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  return g;
}

const curveCache = new Map<number, Float32Array<ArrayBuffer>>();

/** tanh soft-clip curve; drive 0..1 (cached per rounded amount). */
function driveCurve(drive: number): Float32Array<ArrayBuffer> {
  const key = Math.round(drive * 20) / 20;
  const cached = curveCache.get(key);
  if (cached) return cached;
  const k = 1 + key * 30;
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  curveCache.set(key, curve);
  return curve;
}

function chain(nodes: readonly AudioNode[]): void {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
}

export function tone(ctx: BaseAudioContext, out: AudioNode, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, o.start);
  if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), o.start + o.dur);
  if (o.detune) osc.detune.setValueAtTime(o.detune, o.start);
  const env = envelope(ctx, o.start, o.dur, o.gain ?? 0.3, o.attack ?? 0.005);
  const nodes: AudioNode[] = [osc];
  if (o.drive) {
    const ws = ctx.createWaveShaper();
    ws.curve = driveCurve(o.drive);
    nodes.push(ws);
  }
  if (o.filter !== undefined) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.filter, o.start);
    if (o.filterEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filterEnd), o.start + o.dur);
    if (o.q !== undefined) f.Q.value = o.q;
    nodes.push(f);
  }
  chain([...nodes, env, out]);
  osc.start(o.start);
  osc.stop(o.start + o.dur + 0.02);
  osc.onended = () => env.disconnect();
}

export function noise(ctx: BaseAudioContext, out: AudioNode, o: NoiseOpts): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'highpass';
  f.frequency.setValueAtTime(o.freq ?? 6000, o.start);
  if (o.freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(o.freqEnd, o.start + o.dur);
  f.Q.value = o.q ?? 0.7;
  const env = envelope(ctx, o.start, o.dur, o.gain ?? 0.2, 0.002);
  chain([src, f, env, out]);
  src.start(o.start, Math.random() * 0.5);
  src.stop(o.start + o.dur + 0.02);
  src.onended = () => env.disconnect();
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

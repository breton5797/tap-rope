// v7.1 sfx bus plumbing: master compressor, sfx peak limiter, stereo pan pool and same-name dedupe.

export const MASTER_ATTACK = 0.015; // v6 was 0.004: slower so hit transients punch through before the glue clamps

/** Glue compressor shared by music + sfx (the v6 master stage), with a soft-clip ceiling at the very end. */
export function createMaster(ctx: BaseAudioContext, dest: AudioNode): AudioNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = MASTER_ATTACK;
  comp.release.value = 0.2;
  const master = ctx.createGain();
  master.gain.value = 0.85;
  comp.connect(master).connect(createLimiter(ctx, dest));
  return comp;
}

const LIMIT_KNEE = 0.8; // linear below this, tanh-rounded above, never past ~0.95

let limitCurve: Float32Array<ArrayBuffer> | null = null;

/** Soft clipper: identity up to ±LIMIT_KNEE, then a tanh shoulder (input is clamped to ±1 by the shaper). */
export function softLimitCurve(n = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(n);
  const room = 1 - LIMIT_KNEE;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= LIMIT_KNEE ? a : LIMIT_KNEE + room * Math.tanh((a - LIMIT_KNEE) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/**
 * Peak limiter for the sfx bus: a soft clipper, so stacked hits round off instead of clipping.
 * Not a DynamicsCompressor — its auto makeup gain lifts quiet blips while squashing short sub-heavy hits.
 * Returns the input node.
 */
export function createLimiter(ctx: BaseAudioContext, dest: AudioNode): AudioNode {
  const clip = ctx.createWaveShaper();
  limitCurve ??= softLimitCurve();
  clip.curve = limitCurve;
  clip.connect(dest);
  return clip;
}

/** Clamp a pan request to −1…1 and snap it to 0.1 steps (non-finite → centre). */
export function clampPan(pan: number): number {
  if (!Number.isFinite(pan)) return 0;
  const snapped = Math.round(Math.max(-1, Math.min(1, pan)) * 10) / 10;
  return snapped === 0 ? 0 : snapped; // no −0
}

const panPools = new WeakMap<AudioNode, Map<number, AudioNode>>();

/** A reusable StereoPannerNode per snapped pan value feeding `bus`; `bus` itself for centre or old browsers. */
export function panBus(ctx: BaseAudioContext, bus: AudioNode, pan: number): AudioNode {
  const p = clampPan(pan);
  if (p === 0 || typeof ctx.createStereoPanner !== 'function') return bus;
  const pool = panPools.get(bus) ?? new Map<number, AudioNode>();
  panPools.set(bus, pool);
  const hit = pool.get(p);
  if (hit) return hit;
  const node = ctx.createStereoPanner();
  node.pan.value = p;
  node.connect(bus);
  pool.set(p, node);
  return node;
}

export const DEDUPE_MS = 50;

/** Gate that drops a repeat of the same name within `windowMs` of the last one it let through. */
export function createDedupe(windowMs = DEDUPE_MS): (name: string, nowMs: number) => boolean {
  const last = new Map<string, number>();
  return (name, nowMs) => {
    const prev = last.get(name);
    if (prev !== undefined && nowMs - prev < windowMs && nowMs >= prev) return false;
    last.set(name, nowMs);
    return true;
  };
}

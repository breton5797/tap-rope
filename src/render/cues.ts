// v7.1 agent cues (GDD-v7.1 §1–3): the last time each impact happened, on the effects clock.
// Effects.impact() records them; the agent painter reads them for anticipation, lean, recoil and
// secondary motion. Module state on purpose: one agent, one renderer, no per-frame allocation.
import type { ImpactKind, ImpactOpts } from '../types';

interface Cue {
  at: number;
  level: number;
  dir: -1 | 1;
  zone: 'low' | 'high' | 'side';
}

const NEVER = -1e9;
const KINDS: readonly ImpactKind[] = ['jump', 'boost', 'land', 'slide', 'lane', 'bump', 'pass', 'graze', 'hit', 'shield'];
const cues = new Map<ImpactKind, Cue>(KINDS.map((k) => [k, { at: NEVER, level: 1, dir: 1, zone: 'low' }]));
let clock = 0;

/** advance the cue clock (called from Effects.update with the same dt as the particles) */
export function tickCues(dt: number): void {
  clock += dt;
}

export function pushCue(kind: ImpactKind, opts: ImpactOpts = {}): void {
  const c = cues.get(kind) as Cue;
  c.at = clock;
  c.level = opts.level ?? 1;
  c.dir = opts.dir ?? 1;
  c.zone = opts.zone ?? 'low';
}

/** seconds since the last `kind` cue (huge when it never happened) */
export function cueAge(kind: ImpactKind): number {
  return clock - (cues.get(kind) as Cue).at;
}

export function cueInfo(kind: ImpactKind): Readonly<Cue> {
  return cues.get(kind) as Cue;
}

/** forget every cue (new run / tests) */
export function resetCues(): void {
  for (const c of cues.values()) c.at = NEVER;
  clock = 0;
}

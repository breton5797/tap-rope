/**
 * Procedural, deterministic beat generation (GDD §3).
 * 1. planSpecs: picks exactly `hazardBeats` hazard specs from singles,
 *    predefined patterns (1-2-3, 1-1-2, 3-1-1, 2-2) and Double-Dutch runs
 *    (capped at 35% of hazard beats; at least one run when mix.doubleDutch > 0).
 * 2. placeSpecs: puts them on the half-beat grid honouring the spacing rule
 *    (after level L: ≥ airtime(L)+0.18s; after a lone bird: ≥ 0.5s) and slots
 *    reachable pickup beats in between.
 * Also builds the endless chunk and daily-challenge stage definitions.
 */
import type { Beat, JumpLevel, Level, Obstacle, ObstacleKind, PhysicsConfig, StageDef, WorldId } from '../types';
import { airtimeForLevel } from './physics';
import { hashString, mulberry32 } from './rng';

type Rng = () => number;

interface Spec {
  readonly obstacles: readonly Obstacle[];
  readonly required: JumpLevel;
  readonly dd: boolean;
  /** part of a pattern / DD run: minimal spacing, no slack, no pickups around */
  readonly tight: boolean;
}

const SAFETY = 0.18;
const BIRD_GAP = 0.5;
const DD_MIN = 4;
const DD_MAX_SHARE = 0.35; // at most 35% of hazard beats are Double-Dutch
const DD_CHUNK_FACTOR = 0.25;
const DD_FORCE_AT = DD_MIN + 3; // force the guaranteed DD run once this few hazards remain
const PATTERNS: readonly (readonly Level[])[] = [[1, 2, 3], [1, 1, 2], [3, 1, 1], [2, 2]];
const RARE_PICKUPS: readonly ObstacleKind[] = ['shield', 'slow', 'heart'];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function difficulty(stage: StageDef): number {
  return clamp01((stage.bpm - 92) / 40);
}

function maxLevel(stage: StageDef): Level {
  const [, w2, w3] = stage.levelWeights;
  return w3 > 0 ? 3 : w2 > 0 ? 2 : 1;
}

function pickLevel(weights: readonly [number, number, number], rng: Rng): Level {
  const total = weights[0] + weights[1] + weights[2];
  const r = rng() * (total > 0 ? total : 1);
  if (total <= 0 || r < weights[0]) return 1;
  return r < weights[0] + weights[1] ? 2 : 3;
}

function barrier(kind: 'rope' | 'hurdle', levels: readonly Level[], dd: boolean): Spec {
  const obstacles = levels.map((level) => ({ kind, level }));
  return { obstacles, required: Math.max(...levels) as Level, dd, tight: false };
}

function singleSpec(stage: StageDef, rng: Rng): Spec {
  const level = pickLevel(stage.levelWeights, rng);
  const { mix } = stage;
  if (rng() < mix.bird) {
    const bird: Obstacle = { kind: 'bird', level: 1 };
    return rng() < 0.5
      ? { obstacles: [bird], required: 0, dd: false, tight: false }
      : { obstacles: [{ kind: 'rope', level: 1 }, bird], required: 1, dd: false, tight: false };
  }
  if (rng() < mix.combo) {
    const hurdleLevel = (1 + Math.floor(rng() * level)) as Level;
    const obstacles: Obstacle[] = [{ kind: 'rope', level }, { kind: 'hurdle', level: hurdleLevel }];
    return { obstacles, required: level, dd: false, tight: false };
  }
  return barrier(rng() < mix.hurdle ? 'hurdle' : 'rope', [level], false);
}

function patternSpecs(stage: StageDef, rng: Rng, remaining: number): Spec[] | null {
  const top = maxLevel(stage);
  const eligible = PATTERNS.filter((p) => p.length <= remaining && Math.max(...p) <= top);
  if (eligible.length === 0) return null;
  const pattern = eligible[Math.floor(rng() * eligible.length)];
  return pattern.map((level) => ({
    ...barrier(rng() < stage.mix.hurdle ? 'hurdle' : 'rope', [level], false),
    tight: true,
  }));
}

function ddSpecs(rng: Rng, budget: number): Spec[] {
  const len = Math.min(budget, 4 + Math.floor(rng() * 5));
  return Array.from({ length: len }, () => ({ ...barrier('rope', [1], true), tight: true }));
}

interface DDState {
  readonly left: number; // DD beats still allowed by the cap
  readonly afterDD: boolean; // previous spec was DD (avoid merging runs)
  readonly none: boolean; // no DD run placed yet
}

function planChunk(stage: StageDef, rng: Rng, remaining: number, dd: DDState): Spec[] {
  const d = difficulty(stage);
  const budget = Math.min(remaining, dd.left);
  if (!dd.afterDD && budget >= DD_MIN) {
    const rolled = rng() < stage.mix.doubleDutch * DD_CHUNK_FACTOR;
    // guarantee one run: patterns are ≤ 3 long, so remaining always passes through 5..7
    const forced = dd.none && stage.mix.doubleDutch > 0 && remaining <= DD_FORCE_AT;
    if (rolled || forced) return ddSpecs(rng, budget);
  }
  if (d >= 0.3 && rng() < 0.3 * d) {
    const pattern = patternSpecs(stage, rng, remaining);
    if (pattern) return pattern;
  }
  return [singleSpec(stage, rng)];
}

function planSpecs(stage: StageDef, rng: Rng): Spec[] {
  const ddCap = Math.floor(stage.hazardBeats * DD_MAX_SHARE);
  let specs: Spec[] = [];
  while (specs.length < stage.hazardBeats) {
    const ddUsed = specs.filter((s) => s.dd).length;
    const dd: DDState = {
      left: ddCap - ddUsed,
      afterDD: specs.length > 0 && specs[specs.length - 1].dd,
      none: ddUsed === 0,
    };
    specs = [...specs, ...planChunk(stage, rng, stage.hazardBeats - specs.length, dd)];
  }
  return specs;
}

/** minimum seconds after `prev` before the next hazard `next` */
function minGap(prev: Spec, next: Spec, cfg: PhysicsConfig): number {
  if (prev.required === 0) return next.required >= 2 ? airtimeForLevel(1, cfg) + SAFETY : BIRD_GAP;
  return airtimeForLevel(prev.required, cfg) + SAFETY;
}

/** minimum seconds after `prev` before any jump-requiring pickup */
function gapAfter(prev: Spec, cfg: PhysicsConfig): number {
  return prev.required === 0 ? BIRD_GAP : airtimeForLevel(prev.required, cfg) + SAFETY;
}

function pickupObstacle(stage: StageDef, rng: Rng): Obstacle {
  const top = maxLevel(stage);
  if (rng() < 0.8) return { kind: 'coin', level: Math.min(top, 1 + Math.floor(rng() * 2)) as Level };
  const kind = RARE_PICKUPS[Math.floor(rng() * RARE_PICKUPS.length)];
  return { kind, level: Math.min(top, 2 + Math.floor(rng() * 2)) as Level };
}

interface Placed {
  readonly slot: number; // half-beat index from startTime
  readonly obstacles: readonly Obstacle[];
  readonly required: JumpLevel;
  readonly dd: boolean;
}

function placeSpecs(specs: readonly Spec[], stage: StageDef, cfg: PhysicsConfig, rng: Rng): Placed[] {
  const half = 30 / stage.bpm;
  const slotsFor = (sec: number) => Math.ceil(sec / half - 1e-9);
  const maxSlack = Math.round(3 * (1 - difficulty(stage)));
  let placed: Placed[] = [];
  let lastSlot = 0;
  specs.forEach((spec, i) => {
    const prev = i > 0 ? specs[i - 1] : null;
    let slot = 0;
    if (prev) {
      slot = lastSlot + slotsFor(minGap(prev, spec, cfg));
      if (!spec.tight) slot += Math.floor(rng() * (maxSlack + 1));
      if (!spec.tight && !prev.tight && rng() < stage.pickupRate) {
        const pickup = pickupObstacle(stage, rng);
        const pSlot = lastSlot + slotsFor(gapAfter(prev, cfg));
        slot = Math.max(slot, pSlot + slotsFor(airtimeForLevel(pickup.level, cfg) + SAFETY));
        placed = [...placed, { slot: pSlot, obstacles: [pickup], required: 0, dd: false }];
      }
    }
    placed = [...placed, { slot, obstacles: spec.obstacles, required: spec.required, dd: spec.dd }];
    lastSlot = slot;
  });
  return placed;
}

export function generateBeats(stage: StageDef, cfg: PhysicsConfig, startTime = 2.0): Beat[] {
  const rng = mulberry32(stage.seed);
  const half = 30 / stage.bpm;
  const placed = placeSpecs(planSpecs(stage, rng), stage, cfg, rng);
  return placed.map((p, id) => ({
    id,
    time: startTime + p.slot * half,
    obstacles: p.obstacles,
    requiredLevel: p.required,
    doubleDutch: p.dd,
  }));
}

export function endlessStage(chunk: number, seed: number): StageDef {
  const d = clamp01(chunk / 15);
  return {
    id: `endless-${chunk}`,
    world: (Math.floor(chunk / 4) % 3) as WorldId,
    index: 0,
    name: '엔드리스',
    bpm: Math.min(140, 100 + chunk * 3),
    hazardBeats: 12,
    seed: hashString(`endless:${seed}:${chunk}`),
    levelWeights: [0.6 - 0.35 * d, 0.3 + 0.05 * d, 0.1 + 0.3 * d],
    mix: {
      hurdle: 0.2 + 0.15 * d,
      bird: 0.1 + 0.2 * d,
      combo: 0.05 + 0.3 * d,
      doubleDutch: chunk >= 2 ? 0.2 + 0.3 * d : 0,
    },
    pickupRate: 0.25,
  };
}

export function dailyStage(dateIso: string): StageDef {
  const seed = hashString(dateIso);
  return {
    id: `daily-${dateIso}`,
    world: (seed % 4) as WorldId,
    index: 0,
    name: '오늘의 도전',
    bpm: 116 + (seed % 7),
    hazardBeats: 30,
    seed,
    levelWeights: [0.35, 0.4, 0.25],
    mix: { hurdle: 0.25, bird: 0.25, combo: 0.25, doubleDutch: 0.4 },
    pickupRate: 0.25,
  };
}

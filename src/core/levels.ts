/**
 * Procedural, deterministic beat generation (GDD §3, v2 §11).
 * 1. planSpecs (specs.ts): exactly `hazardBeats` hazard specs, every listed move guaranteed.
 * 2. placeSpecs: puts them on the half-beat grid honouring the spacing rules —
 *    after level L ≥ airtime(L)+0.18s, after a ring ≥ airtimeTumble+0.18s, after
 *    a cross ≥ airtime(2)+0.18s, after a lone bird ≥ 0.5s; before a cross or a
 *    1-ball beat ≥ airtime(2|1)+0.18s, before a 2-ball beat ≥ 2·airtime(1)+0.3s —
 *    and slots reachable lane pickups in between.
 * Also builds the endless chunk (long/solo alternating) and daily stage definitions.
 */
import type { Beat, JumpLevel, Lane, Level, Obstacle, ObstacleKind, PhysicsConfig, RopeMode, StageDef, WorldId } from '../types';
import { movesForMix } from './content';
import { airtimeForLevel, airtimeTumble } from './physics';
import { hashString, mulberry32 } from './rng';
import { difficulty, maxLevel, planSpecs, type Spec } from './specs';

type Rng = () => number;

const SAFETY = 0.18;
const BIRD_GAP = 0.5;
const TWO_HOP_EXTRA = 0.3;
const RARE_PICKUPS: readonly ObstacleKind[] = ['shield', 'slow', 'heart'];
const LANES: readonly Lane[] = [-1, 0, 1];

const hasKind = (s: Spec, k: ObstacleKind) => s.obstacles.some((o) => o.kind === k);
const ballCount = (s: Spec) => s.obstacles.filter((o) => o.kind === 'ball').length;
const isCross = (s: Spec) => s.obstacles.some((o) => o.kind === 'rope' && o.cross === true);

/** seconds the player needs after `prev` before taking off for anything */
function gapAfter(prev: Spec, cfg: PhysicsConfig): number {
  if (hasKind(prev, 'ring')) return airtimeTumble(cfg) + SAFETY;
  if (isCross(prev)) return airtimeForLevel(2, cfg) + SAFETY;
  if (prev.required > 0) return airtimeForLevel(prev.required as Level, cfg) + SAFETY;
  if (hasKind(prev, 'bird')) return BIRD_GAP;
  return airtimeForLevel(1, cfg) + SAFETY; // ball-only: the side hop was a 1단 jump
}

/** seconds of preparation `next` needs (lane hops, tap → air swipe) */
function gapBefore(next: Spec, cfg: PhysicsConfig): number {
  const a1 = airtimeForLevel(1, cfg);
  const balls = ballCount(next);
  if (balls >= 2) return 2 * a1 + TWO_HOP_EXTRA;
  if (balls === 1) return a1 + SAFETY;
  if (isCross(next)) return airtimeForLevel(2, cfg) + SAFETY;
  return 0;
}

function minGap(prev: Spec, next: Spec, cfg: PhysicsConfig): number {
  const birdOnly = prev.required === 0 && hasKind(prev, 'bird');
  const after = birdOnly && next.required >= 2 ? airtimeForLevel(1, cfg) + SAFETY : gapAfter(prev, cfg);
  return Math.max(after, gapBefore(next, cfg));
}

function pickupObstacle(stage: StageDef, rng: Rng): Obstacle {
  const top = maxLevel(stage);
  const lane = LANES[Math.floor(rng() * 3)];
  if (rng() < 0.8) return { kind: 'coin', level: Math.min(top, 1 + Math.floor(rng() * 2)) as Level, lane };
  const kind = RARE_PICKUPS[Math.floor(rng() * RARE_PICKUPS.length)];
  return { kind, level: Math.min(top, 2 + Math.floor(rng() * 2)) as Level, lane };
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
        const prep = Math.max(airtimeForLevel(pickup.level, cfg) + SAFETY, gapBefore(spec, cfg));
        slot = Math.max(slot, pSlot + slotsFor(prep));
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

type Mix = StageDef['mix'];

function modeMix(mode: RopeMode, mix: Mix): Mix {
  return mode === 'long'
    ? { ...mix, cross: 0, back: 0 }
    : { ...mix, hurdle: 0, doubleDutch: 0, ring: 0 };
}

function endlessMix(chunk: number, d: number): Mix {
  return {
    hurdle: 0.2 + 0.15 * d,
    bird: chunk >= 2 ? 0.1 + 0.15 * d : 0,
    combo: 0.05 + 0.25 * d,
    doubleDutch: chunk >= 4 ? 0.2 + 0.3 * d : 0,
    ball: 0.15 + 0.15 * d,
    ring: chunk >= 2 ? 0.1 + 0.15 * d : 0,
    cross: 0.2 + 0.2 * d,
    back: chunk >= 3 ? 0.25 + 0.25 * d : 0,
  };
}

export function endlessStage(chunk: number, seed: number): StageDef {
  const d = Math.min(1, Math.max(0, chunk / 15));
  const ropeMode: RopeMode = chunk % 2 === 0 ? 'long' : 'solo';
  const levelWeights = [0.6 - 0.35 * d, 0.3 + 0.05 * d, 0.1 + 0.3 * d] as const;
  const mix = modeMix(ropeMode, endlessMix(chunk, d));
  return {
    id: `endless-${chunk}`,
    world: (Math.floor(chunk / 4) % 3) as WorldId,
    index: 0,
    name: '엔드리스',
    ropeMode,
    moves: movesForMix(ropeMode, levelWeights, mix),
    bpm: Math.min(140, 100 + chunk * 3),
    hazardBeats: 12,
    seed: hashString(`endless:${seed}:${chunk}`),
    levelWeights,
    mix,
    pickupRate: 0.25,
  };
}

const DAILY_MIX: Mix = {
  hurdle: 0.25, bird: 0.2, combo: 0.25, doubleDutch: 0.35, ball: 0.25, ring: 0.25, cross: 0.6, back: 0.3,
};

export function dailyStage(dateIso: string): StageDef {
  const seed = hashString(dateIso);
  const ropeMode: RopeMode = (seed >>> 4) % 2 === 0 ? 'long' : 'solo';
  const levelWeights = [0.35, 0.4, 0.25] as const;
  const mix = modeMix(ropeMode, DAILY_MIX);
  return {
    id: `daily-${dateIso}`,
    world: (seed % 4) as WorldId,
    index: 0,
    name: '오늘의 도전',
    ropeMode,
    moves: movesForMix(ropeMode, levelWeights, mix),
    bpm: 116 + (seed % 7),
    hazardBeats: 30,
    seed,
    levelWeights,
    mix,
    pickupRate: 0.25,
  };
}

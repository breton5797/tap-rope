/**
 * Procedural, deterministic beat generation (GDD §3, v2 §11).
 * 1. planSpecs (specs.ts): exactly `hazardBeats` hazard specs, every listed move guaranteed.
 * 2. placeSpecs: puts them on the half-beat grid honouring the spacing rules —
 *    after level L ≥ airtime(L)+0.18s, after a ring ≥ airtimeTumble+0.18s, after
 *    a cross ≥ airtime(2)+0.18s, after a lone bird ≥ 0.5s; before a cross or a
 *    1-ball beat ≥ airtime(2|1)+0.18s, before a 2-ball beat ≥ 2·airtime(1)+0.3s —
 *    and slots reachable lane pickups in between.
 * Also builds the endless chunk (long/solo alternating, non-moon looks cycling) and the
 * daily stage (campaign formula at d ≈ 0.55, look and rope mode from the date seed).
 */
import type { Beat, JumpLevel, Lane, Level, Obstacle, ObstacleKind, PhysicsConfig, RopeMode, StageDef } from '../types';
import { designStage } from './campaign';
import { CHAPTERS, STAGES } from './content';
import { movesForMix } from './moves';
import { airtimeForLevel } from './physics';
import { hashString, mulberry32 } from './rng';
import { gapAfter, gapBefore, minGap, SAFETY } from './spacing';
import { difficulty, maxLevel, planSpecs, type Spec } from './specs';

type Rng = () => number;

const MAX_SLACK = 4; // extra random half-beats between singles on the easiest stages
const RARE_PICKUPS: readonly ObstacleKind[] = ['shield', 'slow', 'heart'];
const LANES: readonly Lane[] = [-1, 0, 1];

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
  // continuous in difficulty so tempo keeps tightening all the way up; bosses run tight
  const maxSlack = stage.kind === 'boss' ? 0 : MAX_SLACK * (1 - difficulty(stage));
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

/** Endless themes cycle through the non-moon chapters, so gravity never changes mid-run. */
const ENDLESS_LOOKS = CHAPTERS.filter((c) => c.theme !== 3);

export function endlessStage(chunk: number, seed: number): StageDef {
  const d = Math.min(1, Math.max(0, chunk / 15));
  const ropeMode: RopeMode = chunk % 2 === 0 ? 'long' : 'solo';
  const levelWeights = [0.6 - 0.35 * d, 0.3 + 0.05 * d, 0.1 + 0.3 * d] as const;
  const mix = modeMix(ropeMode, endlessMix(chunk, d));
  const look = ENDLESS_LOOKS[chunk % ENDLESS_LOOKS.length];
  return {
    id: `endless-${chunk}`,
    world: look.theme,
    chapter: 0,
    variant: look.variant,
    kind: 'normal',
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

const DAILY_D = 0.55;

/** Built with the campaign formula at d ≈ 0.55 with every move unlocked; look from a seeded chapter. */
export function dailyStage(dateIso: string): StageDef {
  const seed = hashString(dateIso);
  const look = CHAPTERS[seed % CHAPTERS.length];
  return designStage({
    id: `daily-${dateIso}`, name: '오늘의 도전', n: STAGES.length, chapter: 0, index: 0, kind: 'normal',
    world: look.theme, variant: look.variant,
    ropeMode: (seed >>> 4) % 2 === 0 ? 'long' : 'solo',
    d: DAILY_D, seed,
  });
}

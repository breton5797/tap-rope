/**
 * Procedural, deterministic beat generation (GDD §3, v4 §4).
 * 1. planSpecs (specs.ts): exactly `hazardBeats` hazard specs, every listed move guaranteed.
 * 2. placeSpecs: puts them on the half-beat grid honouring the spacing rules (spacing.ts),
 *    adds random slack that shrinks with tempo (none for bosses or inside patterns/pulses),
 *    and slots reachable pickups between hazards.
 * Also builds the endless chunk (moves unlock and tempo ramps per chunk, designed looks cycle)
 * and the daily stage (campaign formula at d ≈ 0.55 with every move, look from the date seed).
 */
import type { Beat, JumpLevel, Level, Obstacle, ObstacleKind, PhysicsConfig, StageDef } from '../types';
import { designStage } from './campaign';
import { CHAPTERS, STAGES } from './content';
import { airtimeForLevel } from './physics';
import { hashString, mulberry32 } from './rng';
import { gapAfter, minGap, SAFETY } from './spacing';
import { difficulty, maxLevel, planSpecs, type Spec } from './specs';

type Rng = () => number;

const MAX_SLACK = 4; // extra random half-beats between singles on the easiest stages
const RARE_PICKUPS: readonly ObstacleKind[] = ['shield', 'slow', 'heart'];

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
  readonly needsSlide: boolean;
  readonly pulse: boolean;
}

const placedOf = (s: Spec, slot: number): Placed => ({
  slot, obstacles: s.obstacles, required: s.required, needsSlide: s.needsSlide, pulse: s.pulse,
});

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
        slot = Math.max(slot, pSlot + slotsFor(airtimeForLevel(pickup.level, cfg) + SAFETY));
        placed = [...placed, { slot: pSlot, obstacles: [pickup], required: 0, needsSlide: false, pulse: false }];
      }
    }
    placed = [...placed, placedOf(spec, slot)];
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
    needsSlide: p.needsSlide,
    pulse: p.pulse,
  }));
}

const ENDLESS_HAZARDS = 16; // fits every move's quota (pulse needs 4)
const ENDLESS_UNLOCK_PER_CHUNK = 4; // campaign stage numbers unlocked per chunk

/** Endless chunk k: moves unlock like the campaign (4 stage numbers per chunk), tempo ramps. */
export function endlessStage(chunk: number, seed: number): StageDef {
  const d = Math.min(1, Math.max(0, chunk / 15));
  const look = CHAPTERS[chunk % CHAPTERS.length];
  const def = designStage({
    id: `endless-${chunk}`, name: '엔드리스', n: Math.min(STAGES.length, 1 + chunk * ENDLESS_UNLOCK_PER_CHUNK),
    chapter: 0, index: 0, kind: 'normal', world: look.theme, variant: look.variant, d,
    seed: hashString(`endless:${seed}:${chunk}`), unlockedOnly: true,
  });
  return { ...def, bpm: Math.min(140, 100 + chunk * 3), hazardBeats: ENDLESS_HAZARDS, pickupRate: 0.25 };
}

const DAILY_D = 0.55;

/** Built with the campaign formula at d ≈ 0.55 with every move unlocked; look from a seeded chapter. */
export function dailyStage(dateIso: string): StageDef {
  const seed = hashString(dateIso);
  const look = CHAPTERS[seed % CHAPTERS.length];
  return designStage({
    id: `daily-${dateIso}`, name: '오늘의 도전', n: STAGES.length, chapter: 0, index: 0, kind: 'normal',
    world: look.theme, variant: look.variant, d: DAILY_D, seed,
  });
}

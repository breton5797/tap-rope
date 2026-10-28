/**
 * Procedural, deterministic beat generation (GDD §3, v4 §4, v5 §5–§6).
 * 1. planSpecs (specs.ts): exactly `hazardBeats` hazard specs, every listed move guaranteed.
 * 2. splitSections (sections.ts): near-even sections, cut only between planned chunks.
 * 3. placeSpecs: puts them on the half-beat grid honouring the spacing rules (spacing.ts),
 *    adds random slack that shrinks with tempo (none for bosses or inside patterns/pulses),
 *    slots reachable pickups (in one lane, safe for the next hazard) between hazards, delays lane beats
 *    a human could not reach (spacing.laneReach), and leaves a DOOR_BREAK rest after each section with a
 *    door in its middle.
 * v8 campaign-only shaping (stage.campaign; daily / endless never set it): each section opens on a warm-up
 * (sections.warmUp), an intro stage's first chunk with its new move gets ISOLATE seconds of room on both
 * sides, and a boss leaves a shield pickup in each door break (the boss staggers and drops a crate).
 * Also builds the endless chunk (moves unlock and tempo ramps per chunk, designed looks cycle; v8: after
 * chunk 15 the tempo keeps rising by 1 bpm per chunk to 160 and each chunk is plain, mirrored or dense)
 * and the daily stage (campaign formula at d ≈ 0.55 with every move, look from the date seed).
 */
import type { Beat, Door, JumpLevel, LaneId, Level, Obstacle, ObstacleKind, PhysicsConfig, StageDef } from '../types';
import { LANES } from '../types';
import { designStage } from './campaign';
import { CHAPTERS, sceneFor, STAGES, transitionFor } from './content';
import { airtimeForLevel } from './physics';
import { hashString, mulberry32 } from './rng';
import { splitSections, warmUp } from './sections';
import { blockedOf, gapAfter, LANE_SWAP_GAP, laneReach, minGap, SAFETY } from './spacing';
import { blockStartLane, difficulty, maxLevel, planSpecs, specMove, type Spec } from './specs';

type Rng = () => number;

/** seconds of rest after a section's last hazard (on top of its gapAfter) before the next section */
export const DOOR_BREAK = 2.4;
const MAX_SLACK = 4; // extra random half-beats between singles on the easiest stages
const RARE_PICKUPS: readonly ObstacleKind[] = ['shield', 'slow', 'heart'];
/** v8: seconds of room around the first chunk with an intro stage's new move */
export const ISOLATE = 1.5;

/** a pickup in one lane, never one the following hazard blocks */
function pickupObstacle(stage: StageDef, rng: Rng, avoid: readonly LaneId[]): Obstacle {
  const top = maxLevel(stage);
  const free = LANES.filter((l) => !avoid.includes(l));
  const lanes = (): LaneId[] => [free[Math.floor(rng() * free.length)]];
  if (rng() < 0.8) return { kind: 'coin', level: Math.min(top, 1 + Math.floor(rng() * 2)) as Level, lanes: lanes() };
  const kind = RARE_PICKUPS[Math.floor(rng() * RARE_PICKUPS.length)];
  return { kind, level: Math.min(top, 2 + Math.floor(rng() * 2)) as Level, lanes: lanes() };
}

interface Placed {
  readonly slot: number; // half-beat index from startTime
  readonly obstacles: readonly Obstacle[];
  readonly required: JumpLevel;
  readonly needsSlide: boolean;
  readonly pulse: boolean;
  readonly section: number;
}

interface Layout {
  readonly placed: readonly Placed[];
  readonly doorSlots: readonly number[]; // one per section boundary
}

const placedOf = (s: Spec, slot: number, section: number): Placed => ({
  slot, obstacles: s.obstacles, required: s.required, needsSlide: s.needsSlide, pulse: s.pulse, section,
});

interface LaneState {
  readonly slot: number; // slot of the previous lane beat
  readonly can: readonly LaneId[]; // lanes the agent can be in there
}

const START_LANES: LaneState = { slot: Number.NEGATIVE_INFINITY, can: [1] };

/** indices whose spec needs ISOLATE before it: the first chunk with the intro move, and the spec after it */
function isolated(specs: readonly Spec[], stage: StageDef): readonly number[] {
  const first = stage.campaign && stage.intro ? specs.findIndex((s) => specMove(s) === stage.intro) : -1;
  if (first < 0) return [];
  const head = specs.slice(0, first + 1).map((s) => s.head).lastIndexOf(true);
  const after = specs.findIndex((s, i) => i > first && s.head);
  return after < 0 ? [head] : [head, after];
}

/** v8 boss door supply: a 1단 shield in a lane the next hazard leaves open (the middle one if it can) */
function doorSupply(next: Spec, slot: number, section: number): Placed {
  const free = LANES.filter((l) => !blockedOf(next.obstacles).includes(l));
  const lane = free.includes(1) ? 1 : free[0];
  return { slot, obstacles: [{ kind: 'shield', level: 1, lanes: [lane] }], required: 0, needsSlide: false, pulse: false, section };
}

/** delays a lane beat that no lane reachable at a human pace would survive (spacing.laneReach) */
function reachable(spec: Spec, slot: number, lane: LaneState, half: number): { slot: number; lane: LaneState } {
  const blocked = blockedOf(spec.obstacles);
  if (blocked.length === 0) return { slot, lane };
  const reachAt = (at: number) => laneReach(lane.can, (at - lane.slot) * half, blocked);
  const at = reachAt(slot).length > 0 ? slot : Math.max(slot, lane.slot + Math.ceil(LANE_SWAP_GAP / half - 1e-9));
  return { slot: at, lane: { slot: at, can: reachAt(at) } };
}

function placeSpecs(specs: readonly Spec[], starts: readonly number[], stage: StageDef, cfg: PhysicsConfig, rng: Rng): Layout {
  const half = 30 / stage.bpm;
  const slotsFor = (sec: number) => Math.ceil(sec / half - 1e-9);
  const breakSlots = slotsFor(DOOR_BREAK);
  // continuous in difficulty so tempo keeps tightening all the way up; bosses run tight
  const maxSlack = stage.kind === 'boss' ? 0 : MAX_SLACK * (1 - difficulty(stage));
  let placed: Placed[] = [];
  let doorSlots: number[] = [];
  let lastSlot = 0;
  let lane = START_LANES;
  const isolate = isolated(specs, stage);
  specs.forEach((spec, i) => {
    const prev = i > 0 ? specs[i - 1] : null;
    const section = starts.filter((s) => s <= i).length;
    let slot = 0;
    if (prev && starts.includes(i)) {
      const rest = lastSlot + slotsFor(gapAfter(prev, cfg));
      doorSlots = [...doorSlots, rest + Math.floor(breakSlots / 2)];
      slot = Math.max(rest + breakSlots, lastSlot + slotsFor(minGap(prev, spec, cfg)));
      if (stage.campaign && stage.kind === 'boss') placed = [...placed, doorSupply(spec, rest, section - 1)];
    } else if (prev) {
      slot = lastSlot + slotsFor(minGap(prev, spec, cfg));
      if (!spec.tight) slot += Math.floor(rng() * (maxSlack + 1));
      if (!spec.tight && !prev.tight && rng() < stage.pickupRate) {
        const pickup = pickupObstacle(stage, rng, blockedOf(spec.obstacles));
        const pSlot = lastSlot + slotsFor(gapAfter(prev, cfg));
        slot = Math.max(slot, pSlot + slotsFor(airtimeForLevel(pickup.level, cfg) + SAFETY));
        placed = [...placed, { slot: pSlot, obstacles: [pickup], required: 0, needsSlide: false, pulse: false, section }];
      }
      if (isolate.includes(i)) slot = Math.max(slot, lastSlot + slotsFor(ISOLATE));
    }
    ({ slot, lane } = reachable(spec, slot, lane, half));
    placed = [...placed, placedOf(spec, slot, section)];
    lastSlot = slot;
  });
  return { placed, doorSlots };
}

const mirrorLanes = (o: Obstacle): Obstacle =>
  (o.lanes ? { ...o, lanes: o.lanes.map((l) => (LANES.length - 1 - l) as LaneId).sort((a, b) => a - b) } : o);

/** The stage's beats and the section doors between them (deterministic from the seed). */
export function generateStage(stage: StageDef, cfg: PhysicsConfig, startTime = 2.0): { beats: Beat[]; doors: Door[] } {
  const rng = mulberry32(stage.seed);
  const half = 30 / stage.bpm;
  const { specs, starts } = splitSections(planSpecs(stage, rng), stage.sections);
  const ordered = stage.campaign ? warmUp(specs, starts) : specs;
  const { placed, doorSlots } = placeSpecs(blockStartLane(ordered), starts, stage, cfg, rng);
  const beats = placed.map((p, id): Beat => {
    const obstacles = stage.mirror ? p.obstacles.map(mirrorLanes) : p.obstacles;
    return {
      id,
      time: startTime + p.slot * half,
      obstacles,
      requiredLevel: p.required,
      needsSlide: p.needsSlide,
      pulse: p.pulse,
      blockedLanes: blockedOf(obstacles),
      section: p.section,
    };
  });
  const doors = doorSlots.map((slot, j): Door => ({
    time: startTime + slot * half,
    section: j + 1,
    transition: transitionFor(stage, j + 1),
    from: sceneFor(stage, j),
    to: sceneFor(stage, j + 1),
  }));
  return { beats, doors };
}

export function generateBeats(stage: StageDef, cfg: PhysicsConfig, startTime = 2.0): Beat[] {
  return generateStage(stage, cfg, startTime).beats;
}

const ENDLESS_HAZARDS = 18; // fits every move's quota (13 single moves + pulse needs 4)
const ENDLESS_UNLOCK_PER_CHUNK = 4; // campaign stage numbers unlocked per chunk
/** v8 late endless: from this chunk the tempo climbs 1 bpm per chunk up to ENDLESS_MAX_BPM */
export const ENDLESS_LATE = 15;
export const ENDLESS_MAX_BPM = 160;
/** v8 dense chunk: a longer run between doors with fewer pickups and more pulse sections */
const DENSE = { hazards: 24, pickupRate: 0.15, pulse: 0.15 } as const;

export type EndlessVariant = 'plain' | 'mirror' | 'dense';

/** v8: chunks after ENDLESS_LATE vary (seeded); earlier chunks are plain */
export function endlessVariant(chunk: number, seed: number): EndlessVariant {
  if (chunk <= ENDLESS_LATE) return 'plain';
  return (['plain', 'mirror', 'dense'] as const)[hashString(`endless-variant:${seed}:${chunk}`) % 3];
}

function endlessBpm(chunk: number): number {
  return chunk <= ENDLESS_LATE ? Math.min(140, 100 + chunk * 3) : Math.min(ENDLESS_MAX_BPM, 140 + chunk - ENDLESS_LATE);
}

function withVariant(def: StageDef, variant: EndlessVariant): StageDef {
  if (variant === 'mirror') return { ...def, mirror: true };
  if (variant !== 'dense') return def;
  const mix = { ...def.mix, pulse: Math.min(1, def.mix.pulse + DENSE.pulse) };
  return { ...def, mix, hazardBeats: DENSE.hazards, pickupRate: DENSE.pickupRate };
}

/** Endless chunk k: moves unlock like the campaign (4 stage numbers per chunk), tempo ramps. */
export function endlessStage(chunk: number, seed: number): StageDef {
  const d = Math.min(1, Math.max(0, chunk / 15));
  const look = CHAPTERS[chunk % CHAPTERS.length];
  const def = designStage({
    id: `endless-${chunk}`, name: '엔드리스', n: Math.min(STAGES.length, 1 + chunk * ENDLESS_UNLOCK_PER_CHUNK),
    chapter: 0, index: 0, kind: 'normal', world: look.theme, variant: look.variant, d,
    seed: hashString(`endless:${seed}:${chunk}`), unlockedOnly: true,
  });
  // one section: the session puts a door at every chunk boundary instead
  const plain = { ...def, bpm: endlessBpm(chunk), hazardBeats: ENDLESS_HAZARDS, pickupRate: 0.25, sections: 1 };
  return withVariant(plain, endlessVariant(chunk, seed));
}

const DAILY_D = 0.55;

/** Built with the campaign formula at d ≈ 0.55 with every move unlocked; look from a seeded chapter. */
export function dailyStage(dateIso: string): StageDef {
  const seed = hashString(dateIso);
  const look = CHAPTERS[seed % CHAPTERS.length];
  return designStage({
    id: `daily-${dateIso}`, name: '일일 작전', n: STAGES.length, chapter: 0, index: 0, kind: 'normal',
    world: look.theme, variant: look.variant, d: DAILY_D, seed,
  }); // a normal stage: 2 sections
}

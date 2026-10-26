/**
 * Hazard planning for the generator (GDD v4 §4): picks exactly `hazardBeats` hazard specs,
 * in order, from singles (jump laser, slide laser, drone / gate), short patterns (jump levels,
 * or jump ↔ slide switches) and pulse-laser sections. A move quota guarantees every MoveId in `stage.moves` appears: random
 * chunks may only use hazards not reserved for still-missing moves, and once nothing is left
 * the missing moves are forced. Pulse lasers are capped at 25% of hazard beats (§4 allows 35%).
 * Never generated: a drone with a ≥ 2단 jump, a jump + slide laser in one beat, slides/drones
 * inside a pulse section.
 * v5 (GDD v5 §5): a hazard beat is a lane beat with chance mix.lane — one lane-hazard kind (drop by
 * mix.drop, chaser by mix.chaser, else guard) on 1–2 lanes (chaser 1, never all 3), plus with chance
 * mix.laneCombo a level-1 jump laser or a slide laser (lanejump; never a drone). Patterns may use 'L'
 * (a lane beat) once lanes are unlocked; pulse sections never hold lane hazards. The first lane beat
 * always blocks the start lane (1), so every stage with lanes really asks for a lane change.
 */
import type { JumpLevel, LaneId, LaserFrom, Level, MoveId, Obstacle, ObstacleKind, StageDef } from '../types';
import { LANE_HAZARD_KINDS, LANES } from '../types';
import { moveForBeat } from './moves';

type Rng = () => number;

export interface Spec {
  readonly obstacles: readonly Obstacle[];
  readonly required: JumpLevel;
  readonly needsSlide: boolean;
  readonly pulse: boolean;
  /** part of a pattern / pulse run: minimal spacing, no slack, no pickups around */
  readonly tight: boolean;
  /** first spec of a planned chunk (single, pattern or pulse run): a section door may come before it */
  readonly head: boolean;
}

const PULSE_MIN = 4;
const PULSE_MAX = 8;
const PULSE_MAX_SHARE = 0.25; // §4 allows ≤ 35%; 25% keeps long bosses varied
const PULSE_CHUNK_FACTOR = 0.2;
/** chance a guard / drop blocks two lanes instead of one, rising with difficulty */
const TWO_LANES_BASE = 0.25;
const TWO_LANES_SLOPE = 0.35;
/** jump-level patterns; 'S' = a slide laser, 'L' = a lane beat (used only when the stage has them) */
type Token = Level | 'S' | 'L';
const PATTERNS: readonly (readonly Token[])[] = [
  [1, 2, 3], [1, 1, 2], [3, 1, 1], [2, 2], [1, 'S', 1], ['S', 1, 'S'], [2, 'S', 2],
  [1, 'L', 1], ['L', 'L'], ['L', 1, 'L'], [2, 'L', 2],
];

const spec = (obstacles: readonly Obstacle[], required: JumpLevel, extra: Partial<Spec> = {}): Spec => ({
  obstacles, required, needsSlide: false, pulse: false, tight: false, head: false, ...extra,
});
const FLOOR: Obstacle = { kind: 'floor', level: 1 };
const DRONE: Obstacle = { kind: 'drone', level: 1 };
const beam = (level: Level, from: LaserFrom): Obstacle => ({ kind: 'beam', level, from });
const slideSpec = (o: Obstacle): Spec => spec([o], 0, { needsSlide: true });

export function specMove(s: Spec): MoveId {
  return moveForBeat({ obstacles: s.obstacles, requiredLevel: s.required, pulse: s.pulse });
}

export function difficulty(stage: StageDef): number {
  return Math.min(1, Math.max(0, (stage.bpm - 88) / 62)); // campaign tempo range 88..150 bpm
}

export function maxLevel(stage: StageDef): Level {
  const [, w2, w3] = stage.levelWeights;
  return w3 > 0 ? 3 : w2 > 0 ? 2 : 1;
}

function pickLevel(weights: readonly [number, number, number], rng: Rng): Level {
  const total = weights[0] + weights[1] + weights[2];
  const r = rng() * (total > 0 ? total : 1);
  if (total <= 0 || r < weights[0]) return 1;
  return r < weights[0] + weights[1] ? 2 : 3;
}

const pickFrom = (stage: StageDef, rng: Rng): LaserFrom => (rng() < stage.mix.rear ? 'back' : 'front');

/** level 1: floor laser or (mix.beam) a flying beam; level 2/3: stacked beams */
function jumpSpec(stage: StageDef, level: Level, rng: Rng, tight = false): Spec {
  const flying = level > 1 || rng() < stage.mix.beam;
  return spec([flying ? beam(level, pickFrom(stage, rng)) : FLOOR], level, { tight });
}

function slideLaser(stage: StageDef, rng: Rng, tight = false): Spec {
  const o: Obstacle = rng() < stage.mix.high ? { kind: 'high', level: 1, from: pickFrom(stage, rng) } : { kind: 'ceiling', level: 1 };
  return spec([o], 0, { needsSlide: true, tight });
}

/** `count` distinct lanes, sorted (count 2 = every lane but one open lane) */
function pickLanes(count: 1 | 2, rng: Rng): LaneId[] {
  const lane = LANES[Math.floor(rng() * LANES.length)];
  return count === 1 ? [lane] : LANES.filter((l) => l !== lane);
}

function laneHazard(stage: StageDef, rng: Rng): Obstacle {
  const { mix } = stage;
  const r = rng();
  const kind: ObstacleKind = r < mix.drop ? 'drop' : r < mix.drop + mix.chaser ? 'chaser' : 'guard';
  const two = kind !== 'chaser' && rng() < TWO_LANES_BASE + TWO_LANES_SLOPE * difficulty(stage);
  return { kind, level: 1, lanes: pickLanes(two ? 2 : 1, rng) };
}

/** a lane beat; with mix.laneCombo also a level-1 jump laser or a slide laser (lanejump) */
function laneSpec(stage: StageDef, rng: Rng, tight = false): Spec {
  const hazard = laneHazard(stage, rng);
  if (rng() >= stage.mix.laneCombo) return spec([hazard], 0, { tight });
  const laser = rng() < stage.mix.slide ? slideLaser(stage, rng, tight) : jumpSpec(stage, 1, rng, tight);
  return { ...laser, obstacles: [hazard, ...laser.obstacles] };
}

function single(stage: StageDef, rng: Rng): Spec {
  const level = pickLevel(stage.levelWeights, rng);
  const { mix } = stage;
  if (mix.lane > 0 && rng() < mix.lane) return laneSpec(stage, rng);
  if (rng() < mix.drone) return rng() < mix.gate ? spec([FLOOR, DRONE], 1) : spec([DRONE], 0);
  if (rng() < mix.slide) return slideLaser(stage, rng);
  return jumpSpec(stage, level, rng);
}

function patternSpecs(stage: StageDef, rng: Rng, room: number): Spec[] | null {
  const usable = (t: Token) => {
    if (t === 'S') return stage.mix.slide > 0;
    if (t === 'L') return stage.mix.lane > 0;
    return t === 1 || stage.levelWeights[t - 1] > 0;
  };
  const eligible = PATTERNS.filter((p) => p.length <= room && p.every(usable));
  if (eligible.length === 0) return null;
  const pattern = eligible[Math.floor(rng() * eligible.length)];
  return pattern.map((t) => {
    if (t === 'S') return slideLaser(stage, rng, true);
    return t === 'L' ? laneSpec(stage, rng, true) : jumpSpec(stage, t, rng, true);
  });
}

function pulseSpecs(len: number): Spec[] {
  return Array.from({ length: len }, () => spec([FLOOR], 1, { pulse: true, tight: true }));
}

/** hazard specs needed to guarantee a move */
function forcedSpecs(move: MoveId, rng: Rng): Spec[] {
  const lanes = (kind: ObstacleKind): Obstacle => ({ kind, level: 1, lanes: pickLanes(1, rng) });
  switch (move) {
    case 'lane': return [spec([lanes('guard')], 0)];
    case 'drop': return [spec([lanes('drop')], 0)];
    case 'chaser': return [spec([lanes('chaser')], 0)];
    case 'lanejump': return [spec([lanes('guard'), FLOOR], 1)];
    case 'beam': return [spec([beam(1, 'front')], 1)];
    case 'double': return [spec([beam(2, 'front')], 2)];
    case 'triple': return [spec([beam(3, 'front')], 3)];
    case 'slide': return [slideSpec({ kind: 'ceiling', level: 1 })];
    case 'high': return [slideSpec({ kind: 'high', level: 1, from: 'front' })];
    case 'rear': return [spec([beam(1, 'back')], 1)];
    case 'drone': return [spec([DRONE], 0)];
    case 'gate': return [spec([FLOOR, DRONE], 1)];
    case 'pulse': return pulseSpecs(PULSE_MIN);
    default: return [spec([FLOOR], 1)];
  }
}

const quotaSize = (m: MoveId): number => (m === 'pulse' ? PULSE_MIN : 1);

interface PlanState {
  readonly room: number; // hazards a random chunk may use (not reserved for missing moves)
  readonly pulseLeft: number; // pulse beats still allowed by the 35% cap
  readonly afterPulse: boolean; // previous spec was a pulse (avoid merging runs)
}

function planChunk(stage: StageDef, rng: Rng, st: PlanState): Spec[] {
  const pulseRoom = Math.min(st.room, st.pulseLeft);
  if (!st.afterPulse && pulseRoom >= PULSE_MIN && rng() < stage.mix.pulse * PULSE_CHUNK_FACTOR) {
    return pulseSpecs(Math.min(pulseRoom, PULSE_MIN + Math.floor(rng() * (PULSE_MAX - PULSE_MIN + 1))));
  }
  const d = difficulty(stage);
  if (d >= 0.3 && rng() < 0.3 * d) {
    const pattern = patternSpecs(stage, rng, st.room);
    if (pattern) return pattern;
  }
  return [single(stage, rng)];
}

const START_LANE: LaneId = 1;

/** the same lane count, but covering the start lane ([0, 2] → [0, 1]) */
const withStartLane = (lanes: readonly LaneId[]): LaneId[] =>
  (lanes.includes(START_LANE) ? [...lanes] : lanes.length === 1 ? [START_LANE] : [lanes[0], START_LANE]);

/** makes the first lane beat block the start lane (spacing is applied later, on the result) */
function blockStartLane(specs: readonly Spec[]): Spec[] {
  const isLaneHazard = (o: Obstacle) => LANE_HAZARD_KINDS.includes(o.kind);
  const first = specs.findIndex((s) => s.obstacles.some(isLaneHazard));
  return specs.map((s, i) => (i !== first ? s : {
    ...s, obstacles: s.obstacles.map((o) => (isLaneHazard(o) ? { ...o, lanes: withStartLane(o.lanes ?? []) } : o)),
  }));
}

export function planSpecs(stage: StageDef, rng: Rng): Spec[] {
  const pulseCap = Math.floor(stage.hazardBeats * PULSE_MAX_SHARE);
  let specs: Spec[] = [];
  while (specs.length < stage.hazardBeats) {
    const used = new Set(specs.map(specMove));
    const missing = stage.moves.filter((m) => !used.has(m));
    const reserved = missing.reduce((n, m) => n + quotaSize(m), 0);
    const room = stage.hazardBeats - specs.length - reserved;
    const chunk = room <= 0 && missing.length > 0
      ? forcedSpecs(missing[0], rng)
      : planChunk(stage, rng, {
        room,
        pulseLeft: pulseCap - specs.filter((s) => s.pulse).length,
        afterPulse: specs.length > 0 && specs[specs.length - 1].pulse,
      });
    specs = [...specs, ...chunk.map((s, i) => (i === 0 ? { ...s, head: true } : s))];
  }
  return blockStartLane(specs);
}

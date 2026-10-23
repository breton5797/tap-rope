/**
 * Hazard planning for the generator (GDD v2 §11): picks exactly `hazardBeats`
 * hazard specs, in order, from singles, patterns, Double-Dutch runs (long) and
 * 뒤로넘기 sections (solo). A move quota guarantees every MoveId in
 * `stage.moves` appears (cross ×4 in stages of ≥ 20 hazards): random chunks may
 * only use hazards not reserved for still-missing moves, and once nothing is
 * left the missing moves are forced. DD is capped at 35%, back ropes at 30%. The first ball
 * beat always blocks the centre lane (where the player starts), so `side` is truly needed.
 */
import type { JumpLevel, Lane, Level, MoveId, Obstacle, StageDef } from '../types';
import { moveForBeat } from './moves';

type Rng = () => number;

export interface Spec {
  readonly obstacles: readonly Obstacle[];
  readonly required: JumpLevel;
  readonly dd: boolean;
  /** part of a pattern / DD run / back section: minimal spacing, no slack, no pickups around */
  readonly tight: boolean;
}

const DD_MIN = 4;
const DD_MAX = 8;
const DD_MAX_SHARE = 0.35; // at most 35% of hazard beats are Double-Dutch
const DD_CHUNK_FACTOR = 0.25;
const BACK_MIN = 3;
const BACK_MAX = 8;
const BACK_CHUNK_FACTOR = 0.2;
const BACK_MAX_SHARE = 0.3; // at most 30% of hazard beats are 뒤로넘기 ropes
const CROSS_QUOTA = 4; // stages with ≥ CROSS_QUOTA_FROM hazards that list cross get at least this many
const CROSS_QUOTA_FROM = 20;
const BACK_L2_FROM = 30; // campaign index (chapter·10 + index) of w4-s1: level-2 back ropes from here on
const TWO_BALLS = 0.35;
const PATTERNS: readonly (readonly Level[])[] = [[1, 2, 3], [1, 1, 2], [3, 1, 1], [2, 2]];
const LANES: readonly Lane[] = [-1, 0, 1];

const spec = (obstacles: readonly Obstacle[], required: JumpLevel, extra: Partial<Spec> = {}): Spec => ({
  obstacles, required, dd: false, tight: false, ...extra,
});
const rope = (level: Level, extra: Partial<Obstacle> = {}): Obstacle => ({ kind: 'rope', level, ...extra });

export function specMove(s: Spec): MoveId {
  return moveForBeat({ obstacles: s.obstacles, requiredLevel: s.required, doubleDutch: s.dd });
}

export function difficulty(stage: StageDef): number {
  return Math.min(1, Math.max(0, (stage.bpm - 88) / 62)); // v3 tempo range 88..150 bpm
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

function ballSpec(rng: Rng, withRope: boolean): Spec {
  const first = LANES[Math.floor(rng() * 3)];
  const rest = LANES.filter((l) => l !== first);
  const lanes = rng() < TWO_BALLS ? [first, rest[Math.floor(rng() * 2)]] : [first];
  const balls: Obstacle[] = lanes.map((lane) => ({ kind: 'ball', level: 1, lane }));
  return withRope ? spec([rope(1), ...balls], 1) : spec(balls, 0);
}

function birdSpec(rng: Rng): Spec {
  const bird: Obstacle = { kind: 'bird', level: 1 };
  return rng() < 0.5 ? spec([bird], 0) : spec([rope(1), bird], 1);
}

function singleLong(stage: StageDef, rng: Rng): Spec {
  const level = pickLevel(stage.levelWeights, rng);
  const { mix } = stage;
  if (rng() < mix.bird) return birdSpec(rng);
  if (rng() < mix.ring) return spec([{ kind: 'ring', level: 2 }], 0);
  if (rng() < mix.ball) return ballSpec(rng, rng() < mix.combo);
  if (rng() < mix.combo) {
    const hurdleLevel = (1 + Math.floor(rng() * level)) as Level;
    return spec([rope(level), { kind: 'hurdle', level: hurdleLevel }], level);
  }
  return spec([rng() < mix.hurdle ? { kind: 'hurdle', level } : rope(level)], level);
}

function singleSolo(stage: StageDef, rng: Rng): Spec {
  const level = pickLevel(stage.levelWeights, rng);
  const { mix } = stage;
  if (rng() < mix.bird) return birdSpec(rng);
  if (rng() < mix.ball) return ballSpec(rng, rng() < mix.combo);
  const cross = level <= 2 && rng() < mix.cross;
  return spec([cross ? rope(level, { cross: true }) : rope(level)], level);
}

function patternSpecs(stage: StageDef, rng: Rng, room: number): Spec[] | null {
  const top = maxLevel(stage);
  const usable = (l: Level) => l === 1 || stage.levelWeights[l - 1] > 0;
  const eligible = PATTERNS.filter((p) => p.length <= room && Math.max(...p) <= top && p.every(usable));
  if (eligible.length === 0) return null;
  const pattern = eligible[Math.floor(rng() * eligible.length)];
  const long = stage.ropeMode === 'long';
  return pattern.map((level) => {
    if (long) {
      const o: Obstacle = rng() < stage.mix.hurdle ? { kind: 'hurdle', level } : rope(level);
      return spec([o], level, { tight: true });
    }
    const cross = level <= 2 && rng() < stage.mix.cross;
    return spec([cross ? rope(level, { cross: true }) : rope(level)], level, { tight: true });
  });
}

function ddSpecs(len: number): Spec[] {
  return Array.from({ length: len }, () => spec([rope(1)], 1, { dd: true, tight: true }));
}

/** `len` back ropes followed by one forward 1단 rope (the second ↓ signal) */
function backSpecs(stage: StageDef, rng: Rng, len: number): Spec[] {
  const campaignIndex = stage.chapter * 10 + stage.index;
  const allowL2 = campaignIndex >= BACK_L2_FROM && stage.levelWeights[1] > 0;
  const section = Array.from({ length: len }, () => {
    const level: Level = allowL2 ? (Math.min(2, pickLevel(stage.levelWeights, rng)) as Level) : 1;
    return spec([rope(level, { back: true })], level, { tight: true });
  });
  return [...section, spec([rope(1)], 1, { tight: true })];
}

/** hazard specs needed to guarantee a move */
function forcedSpecs(move: MoveId, stage: StageDef, rng: Rng): Spec[] {
  switch (move) {
    case 'double': return [spec([rope(2)], 2)];
    case 'triple': return [spec([rope(3)], 3)];
    case 'tumble': return [spec([{ kind: 'ring', level: 2 }], 0)];
    case 'side': return [ballSpec(rng, false)];
    case 'cross': return [spec([rope(1, { cross: true })], 1)];
    case 'back': return backSpecs(stage, rng, BACK_MIN);
    case 'dd': return ddSpecs(DD_MIN);
    case 'bird': return [spec([{ kind: 'bird', level: 1 }], 0)];
    default: return [spec([rope(1)], 1)];
  }
}

const QUOTA_SIZE: Readonly<Record<MoveId, number>> = {
  jump: 1, double: 1, triple: 1, tumble: 1, side: 1, cross: 1, back: BACK_MIN + 1, dd: DD_MIN, bird: 1,
};

function quotaFor(stage: StageDef, move: MoveId): number {
  return move === 'cross' && stage.hazardBeats >= CROSS_QUOTA_FROM ? CROSS_QUOTA : 1;
}

const isBackSpec = (s: Spec) => s.obstacles.some((o) => o.kind === 'rope' && o.back === true);

interface PlanState {
  readonly room: number; // hazards a random chunk may use (not reserved for missing moves)
  readonly ddLeft: number; // DD beats still allowed by the 35% cap
  readonly backLeft: number; // back ropes still allowed by the 35% cap
  readonly afterRun: boolean; // previous spec was DD (avoid merging runs)
}

function planChunk(stage: StageDef, rng: Rng, st: PlanState): Spec[] {
  const long = stage.ropeMode === 'long';
  const { mix } = stage;
  const ddRoom = Math.min(st.room, st.ddLeft);
  if (long && !st.afterRun && ddRoom >= DD_MIN && rng() < mix.doubleDutch * DD_CHUNK_FACTOR) {
    return ddSpecs(Math.min(ddRoom, DD_MIN + Math.floor(rng() * (DD_MAX - DD_MIN + 1))));
  }
  const backRoom = Math.min(st.room - 1, st.backLeft);
  if (!long && backRoom >= BACK_MIN && rng() < mix.back * BACK_CHUNK_FACTOR) {
    const len = Math.min(backRoom, BACK_MIN + Math.floor(rng() * (BACK_MAX - BACK_MIN + 1)));
    return backSpecs(stage, rng, len);
  }
  const d = difficulty(stage);
  if (d >= 0.3 && rng() < 0.3 * d) {
    const pattern = patternSpecs(stage, rng, st.room);
    if (pattern) return pattern;
  }
  return [long ? singleLong(stage, rng) : singleSolo(stage, rng)];
}

export function planSpecs(stage: StageDef, rng: Rng): Spec[] {
  const ddCap = stage.ropeMode === 'long' ? Math.floor(stage.hazardBeats * DD_MAX_SHARE) : 0;
  const backCap = Math.floor(stage.hazardBeats * BACK_MAX_SHARE);
  let specs: Spec[] = [];
  while (specs.length < stage.hazardBeats) {
    const moves = specs.map(specMove);
    const short = (m: MoveId) => Math.max(0, quotaFor(stage, m) - moves.filter((x) => x === m).length);
    const missing = stage.moves.filter((m) => short(m) > 0);
    const reserved = missing.reduce((n, m) => n + short(m) * QUOTA_SIZE[m], 0);
    const room = stage.hazardBeats - specs.length - reserved;
    const chunk = room <= 0 && missing.length > 0
      ? forcedSpecs(missing[0], stage, rng)
      : planChunk(stage, rng, {
        room,
        ddLeft: ddCap - specs.filter((s) => s.dd).length,
        backLeft: backCap - specs.filter(isBackSpec).length,
        afterRun: specs.length > 0 && specs[specs.length - 1].dd,
      });
    specs = [...specs, ...chunk];
  }
  return centreFirstBall(specs);
}

/**
 * The player starts in the centre lane; if the first ball beat left it free, a stage could
 * list `side` without ever forcing a hop. Move that beat's first ball into the centre.
 */
function centreFirstBall(specs: readonly Spec[]): Spec[] {
  const i = specs.findIndex((s) => s.obstacles.some((o) => o.kind === 'ball'));
  if (i < 0 || specs[i].obstacles.some((o) => o.kind === 'ball' && (o.lane ?? 0) === 0)) return [...specs];
  const j = specs[i].obstacles.findIndex((o) => o.kind === 'ball');
  const obstacles = specs[i].obstacles.map((o, k): Obstacle => (k === j ? { ...o, lane: 0 } : o));
  return specs.map((s, k) => (k === i ? { ...s, obstacles } : s));
}

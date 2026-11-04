/**
 * Office v2 stage composer (spec §3.1), swapped in for src/core/levels.ts: an office stage is three mission
 * parts, each generated on its own by the v8 generator (one section, a seed derived from the run seed, the
 * stage's single bpm) and stitched the way endless stitches its chunks (game/session.ts extendEndless): after
 * a part's last beat comes its gapAfter, a shield pickup (the v8 boss door supply), then a DOOR_BREAK with the
 * door in its middle, all on the stage's half-beat grid.
 * Per part: a collect part spreads out (density < 1) and every pickup becomes a 1단 coin on a lane the next
 * hazard leaves open, with at least target + 2 of them; a finale's last hazard becomes a jump (the leap over
 * the superior); a part with a `warmup` opens with plain single jumps / slides for that many seconds. The coins of a
 * collect part (and of a part with a bonus collectible) are flagged Obstacle.item: mission items, never ₵. Beats carry `part`. Stages without a mission script (menu demo, endless) use v8 unchanged.
 */
import type { Beat, Door, LaneId, Obstacle, PhysicsConfig, StageDef } from '../../types';
import { HAZARD_KINDS, LANES } from '../../types';
import { DOOR_BREAK, generateStage as v8GenerateStage } from '../../core/levels';
import { mulberry32 } from '../../core/rng';
import { airtimeForLevel } from '../../core/physics';
import { beatShape, gapAfter, laneReach, minGap, SAFETY } from '../../core/spacing';
import { missionPartStage, sceneFor, transitionFor } from './content';
import { STAGE_MISSIONS, type MissionSpec } from './missions';

export * from '../../core/levels';

type Rng = () => number;
type Stage = { readonly beats: Beat[]; readonly doors: Door[] };

const isHazard = (b: Beat): boolean => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
/** half-beats a 1단 jump for a pickup takes, with the spacing margin */
const jumpSlots = (half: number, cfg: PhysicsConfig): number => Math.ceil((airtimeForLevel(1, cfg) + SAFETY) / half - 1e-9);
/** extra items on a collect part beyond its target, so a missed one or two can be made up */
const COLLECT_SPARE = 2;
/** part-2 balance (part 2 spec §4): every door restores one heart, the same for every character */
export const DOOR_HEAL = 1;

/** a part's beats as half-beat slots from its own start (exact: the generator works on that grid) */
function partSlots(spec: MissionSpec, def: StageDef, cfg: PhysicsConfig): { beats: Beat[]; slots: number[] } {
  const beats = v8GenerateStage(def, cfg, 0).beats;
  const half = 30 / def.bpm;
  const slots = beats.map((b) => Math.round(b.time / half));
  // collect parts breathe: stretch the gaps (never below the generator's spacing)
  return spec.density < 1 ? { beats, slots: slots.map((s) => Math.round(s / spec.density)) } : { beats, slots };
}

const coin = (lane: LaneId): Obstacle => ({ kind: 'coin', level: 1, lanes: [lane] });

/** a part's coins as mission items (collect part, or a part with a bonus collectible): never paid as ₵ */
const asItems = (beats: readonly Beat[]): Beat[] =>
  beats.map((b) => (b.obstacles.some((o) => o.kind === 'coin')
    ? { ...b, obstacles: b.obstacles.map((o) => (o.kind === 'coin' ? { ...o, item: true as const } : o)) }
    : b));

function pickLane(rng: Rng, open: readonly LaneId[]): LaneId {
  return open[Math.floor(rng() * open.length)] ?? 1;
}

/**
 * collect: the generator's pickups make way for 1단 coins laid in the hazard gaps — the first one gapAfter the
 * hazard, each next one a 1단 jump (airtime + SAFETY) later, the last one that far before the next hazard.
 * The lanes are chained for a player who takes every coin at a human pace (spacing.laneReach, one lane per
 * LANE_STEP): a coin's lane is reachable from where the previous hazard or coin left the player, and the next
 * hazard is still survivable from it; taking the coin commits the player to that lane. Up to 1, then 2, then
 * any number of coins per gap, then trailing the last hazard, until target + COLLECT_SPARE fit.
 */
function collectPart(spec: MissionSpec, beats: Beat[], slots: number[], half: number, cfg: PhysicsConfig, rng: Rng): { beats: Beat[]; slots: number[] } {
  const hz = beats.map((b, i) => ({ b, slot: slots[i] })).filter(({ b }) => isHazard(b));
  const need = spec.target + COLLECT_SPARE;
  const room = jumpSlots(half, cfg);
  const lay = (cap: number, trail: boolean): { b: Beat; slot: number }[] => {
    const out: { b: Beat; slot: number }[] = [];
    let can: readonly LaneId[] = [1];
    let at = Number.NEGATIVE_INFINITY;
    let placed = 0;
    hz.forEach(({ b, slot }, i) => {
      can = laneReach(can, (slot - at) * half, b.blockedLanes);
      at = slot;
      out.push({ b, slot });
      const nextHz = hz[i + 1];
      const next = nextHz ? nextHz.slot : trail ? Number.POSITIVE_INFINITY : null;
      if (next === null) return;
      let p = slot + Math.ceil(gapAfter(beatShape(b), cfg) / half - 1e-9);
      for (let n = 0; n < cap && placed < need && p + room <= next; n += 1, p += room) {
        const lanes = laneReach(can, (p - at) * half, []).filter((l) =>
          !nextHz || laneReach([l], (next - p) * half, nextHz.b.blockedLanes).length > 0);
        if (lanes.length === 0) continue;
        const lane = pickLane(rng, lanes);
        out.push({ b: { id: 0, time: 0, obstacles: [coin(lane)], requiredLevel: 0, needsSlide: false, pulse: false, blockedLanes: [], section: 0 }, slot: p });
        can = [lane];
        at = p;
        placed += 1;
      }
    });
    return out;
  };
  const tries = [lay(1, false), lay(2, false), lay(Number.POSITIVE_INFINITY, false), lay(Number.POSITIVE_INFINITY, true)];
  const coins = (o: readonly { b: Beat }[]) => o.filter((x) => !isHazard(x.b)).length;
  const out = tries.find((o) => coins(o) >= need) ?? tries[tries.length - 1];
  return { beats: out.map((x) => x.b), slots: out.map((x) => x.slot) };
}

/** a hazard as the plainest move of its kind: a slide stays a slide (under a ceiling), anything else a 1단 jump */
function plainHazard(b: Beat): Beat {
  const obstacles: Obstacle[] = b.needsSlide ? [{ kind: 'ceiling', level: 1 }] : [{ kind: 'floor', level: 1 }];
  return { ...b, obstacles, requiredLevel: b.needsSlide ? 0 : 1, needsSlide: b.needsSlide, pulse: false, blockedLanes: [] };
}

/**
 * warm-up: the hazards in the first `seconds` of a part become plain (plainHazard). A plain beat can need more
 * room than the move it replaces (a 1단 jump's airtime vs a lane step), so where a changed beat sits closer to
 * its neighbour than minGap allows, it and everything after it move later on the half-beat grid.
 */
function warmupPart(beats: readonly Beat[], slots: readonly number[], seconds: number, half: number, cfg: PhysicsConfig): { beats: Beat[]; slots: number[] } {
  const limit = seconds / half;
  const changed = beats.map((b, i) => isHazard(b) && slots[i] < limit - 1e-9);
  const out = beats.map((b, i) => (changed[i] ? plainHazard(b) : b));
  const placed: number[] = [];
  let shift = 0;
  out.forEach((b, i) => {
    let slot = slots[i] + shift;
    if (i > 0 && (changed[i] || changed[i - 1])) {
      const need = Math.ceil(minGap(beatShape(out[i - 1]), beatShape(b), cfg) / half - 1e-9);
      const room = slot - placed[i - 1];
      if (room < need) {
        shift += need - room;
        slot += need - room;
      }
    }
    placed.push(slot);
  });
  return { beats: out, slots: placed };
}

/** finale: the last hazard becomes a 1단 floor jump (its spacing to the previous beat only gets easier) */
function finalePart(beats: Beat[]): Beat[] {
  const last = beats.map(isHazard).lastIndexOf(true);
  if (last < 0) return beats;
  const b = beats[last];
  const jump = b.obstacles.every((o) => o.kind === 'floor' || o.kind === 'beam') && b.requiredLevel >= 1 && !b.needsSlide;
  if (jump) return beats;
  const leap: Beat = { ...b, obstacles: [{ kind: 'floor', level: 1 }], requiredLevel: 1, needsSlide: false, pulse: false, blockedLanes: [] };
  return [...beats.slice(0, last), leap, ...beats.slice(last + 1)];
}

/** the shield before a door: on the lane the next part's first hazard leaves open (middle if it can) */
function doorShield(next: readonly Beat[]): Obstacle {
  const first = next.find(isHazard);
  const free = LANES.filter((l) => !(first?.blockedLanes ?? []).includes(l));
  return { kind: 'shield', level: 1, lanes: [free.includes(1) ? 1 : free[0]] };
}

function composeOffice(stage: StageDef, specs: readonly MissionSpec[], cfg: PhysicsConfig, startTime: number): Stage {
  const half = 30 / stage.bpm;
  const breakSlots = Math.ceil(DOOR_BREAK / half - 1e-9);
  const parts = specs.map((spec, k) => {
    const def = missionPartStage(stage, k, spec);
    const rng = mulberry32(def.seed ^ 0x5bd1e995);
    let { beats, slots } = partSlots(spec, def, cfg);
    if (spec.warmup) ({ beats, slots } = warmupPart(beats, slots, spec.warmup, half, cfg));
    if (spec.kind === 'collect') ({ beats, slots } = collectPart(spec, beats, slots, half, cfg, rng));
    if (spec.kind === 'finale') beats = finalePart(beats);
    if (spec.kind === 'collect' || spec.collectible) beats = asItems(beats);
    return { beats, slots };
  });
  let beats: Beat[] = [];
  let doors: Door[] = [];
  let base = 0; // the part's first slot on the stage grid
  parts.forEach((p, k) => {
    if (k > 0) {
      const prev = beats[beats.length - 1];
      const prevSlot = Math.round((prev.time - startTime) / half);
      // after a hazard its gapAfter; after a pickup (a jump for an item) a full 1단 jump
      const rest = prevSlot + (isHazard(prev) ? Math.ceil(gapAfter(beatShape(prev), cfg) / half - 1e-9) : jumpSlots(half, cfg));
      const shield: Beat = {
        id: 0, time: startTime + rest * half, obstacles: [doorShield(p.beats)], requiredLevel: 0, needsSlide: false, pulse: false,
        blockedLanes: [], section: k - 1, part: k - 1,
      };
      beats = [...beats, shield];
      doors = [...doors, {
        time: startTime + (rest + Math.floor(breakSlots / 2)) * half, section: k, transition: transitionFor(stage, k),
        from: sceneFor(stage, k - 1), to: sceneFor(stage, k), heal: DOOR_HEAL,
      }];
      base = rest + breakSlots;
    }
    const placed = p.beats.map((b, i): Beat => ({ ...b, time: startTime + (base + p.slots[i]) * half, section: k, part: k }));
    beats = [...beats, ...placed];
  });
  return { beats: beats.map((b, id) => ({ ...b, id })), doors };
}

/** Office stages: three stitched mission parts; anything else: the v8 generator. */
export function generateStage(stage: StageDef, cfg: PhysicsConfig, startTime = 2.0): Stage {
  const specs = STAGE_MISSIONS[stage.id];
  return specs ? composeOffice(stage, specs, cfg, startTime) : v8GenerateStage(stage, cfg, startTime);
}

export function generateBeats(stage: StageDef, cfg: PhysicsConfig, startTime = 2.0): Beat[] {
  return generateStage(stage, cfg, startTime).beats;
}

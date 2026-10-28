/**
 * Office v2 stage composer (spec §3.1), swapped in for src/core/levels.ts: an office stage is three mission
 * parts, each generated on its own by the v8 generator (one section, a seed derived from the run seed, the
 * stage's single bpm) and stitched the way endless stitches its chunks (game/session.ts extendEndless): after
 * a part's last beat comes its gapAfter, a shield pickup (the v8 boss door supply), then a DOOR_BREAK with the
 * door in its middle, all on the stage's half-beat grid.
 * Per part: a collect part spreads out (density < 1) and every pickup becomes a 1단 coin on a lane the next
 * hazard leaves open, with at least target + 2 of them; a finale's last hazard becomes a jump (the leap over
 * the superior). Beats carry `part`. Stages without a mission script (menu demo, endless) use v8 unchanged.
 */
import type { Beat, Door, LaneId, Obstacle, PhysicsConfig, StageDef } from '../../types';
import { HAZARD_KINDS, LANES } from '../../types';
import { DOOR_BREAK, generateStage as v8GenerateStage } from '../../core/levels';
import { mulberry32 } from '../../core/rng';
import { airtimeForLevel } from '../../core/physics';
import { beatShape, gapAfter, SAFETY } from '../../core/spacing';
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

/** a part's beats as half-beat slots from its own start (exact: the generator works on that grid) */
function partSlots(spec: MissionSpec, def: StageDef, cfg: PhysicsConfig): { beats: Beat[]; slots: number[] } {
  const beats = v8GenerateStage(def, cfg, 0).beats;
  const half = 30 / def.bpm;
  const slots = beats.map((b) => Math.round(b.time / half));
  // collect parts breathe: stretch the gaps (never below the generator's spacing)
  return spec.density < 1 ? { beats, slots: slots.map((s) => Math.round(s / spec.density)) } : { beats, slots };
}

const coin = (lane: LaneId): Obstacle => ({ kind: 'coin', level: 1, lanes: [lane] });

function pickLane(rng: Rng, open: readonly LaneId[]): LaneId {
  return open[Math.floor(rng() * open.length)] ?? 1;
}

/**
 * collect: the generator's pickups make way for 1단 coins laid in the hazard gaps — the first one gapAfter the
 * hazard, each next one a 1단 jump (airtime + SAFETY) later, the last one that far before the next hazard — on
 * a lane the next hazard leaves open. Spread first (≤ 2 per gap), then fill the gaps, then trail the last
 * hazard, until there are target + COLLECT_SPARE.
 */
function collectPart(spec: MissionSpec, beats: Beat[], slots: number[], half: number, cfg: PhysicsConfig, rng: Rng): { beats: Beat[]; slots: number[] } {
  const hz = beats.map((b, i) => ({ b, slot: slots[i] })).filter(({ b }) => isHazard(b));
  const need = spec.target + COLLECT_SPARE;
  const room = jumpSlots(half, cfg);
  const coins = new Map<number, number[]>(); // hazard index → coin slots after it
  const count = () => [...coins.values()].reduce((n, c) => n + c.length, 0);
  const place = (cap: number, trail: boolean) => {
    hz.forEach(({ b, slot }, i) => {
      const next = i + 1 < hz.length ? hz[i + 1].slot : trail ? Number.POSITIVE_INFINITY : null;
      if (next === null) return;
      const mine = coins.get(i) ?? [];
      coins.set(i, mine);
      let p = mine.length > 0 ? mine[mine.length - 1] + room : slot + Math.ceil(gapAfter(beatShape(b), cfg) / half - 1e-9);
      while (count() < need && mine.length < cap && p + room <= next) {
        mine.push(p);
        p += room;
      }
    });
  };
  place(2, false);
  place(Number.POSITIVE_INFINITY, false);
  place(Number.POSITIVE_INFINITY, true);
  const out: { b: Beat; slot: number }[] = hz.flatMap(({ b, slot }, i) => {
    const lanes = LANES.filter((l) => !(hz[i + 1]?.b.blockedLanes ?? []).includes(l));
    const after = (coins.get(i) ?? []).map((p) => ({
      b: { id: 0, time: 0, obstacles: [coin(pickLane(rng, lanes))], requiredLevel: 0, needsSlide: false, pulse: false, blockedLanes: [], section: 0 } as Beat,
      slot: p,
    }));
    return [{ b, slot }, ...after];
  });
  return { beats: out.map((x) => x.b), slots: out.map((x) => x.slot) };
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
    if (spec.kind === 'collect') ({ beats, slots } = collectPart(spec, beats, slots, half, cfg, rng));
    if (spec.kind === 'finale') beats = finalePart(beats);
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
        from: sceneFor(stage, k - 1), to: sceneFor(stage, k),
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

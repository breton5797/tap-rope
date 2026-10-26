/**
 * Which player-facing move a beat asks for (GDD v4 §8 + v5 §8), by priority:
 * lane hazard + any full-width laser → lanejump, chaser → chaser, drop → drop, guard → lane, then
 * pulse → pulse, floor + drone → gate, drone → drone, high → high, ceiling → slide,
 * beam from behind → rear, level 3 → triple, level 2 → double, beam → beam, floor → jump.
 * movesForMix: which moves a stage definition can produce (keeps `moves` honest) — it
 * mirrors the generator: jump beats are a floor laser (level 1, unless mix.beam picks a beam)
 * or stacked beams (level 2/3); mix.rear sends beams from behind; slide beats are a head-height
 * beam (mix.high) or a ceiling laser; drone beats are a gate (mix.gate) or a lone drone; v5 lane
 * beats (mix.lane) are drops (mix.drop), chasers (mix.chaser) or guards, and with mix.laneCombo they
 * also carry a full-width laser (lanejump).
 */
import type { Beat, MoveId, StageDef } from '../types';
import { HAZARD_KINDS, LANE_HAZARD_KINDS } from '../types';

/** every move in the order the campaign introduces it (GDD v5 §7) */
export const MOVE_ORDER: readonly MoveId[] = [
  'jump', 'lane', 'beam', 'double', 'slide', 'drone', 'drop', 'triple', 'high', 'rear', 'chaser', 'gate', 'pulse', 'lanejump',
];

export type BeatShape = Pick<Beat, 'obstacles' | 'requiredLevel' | 'pulse'>;

export function moveForBeat(beat: BeatShape): MoveId {
  const obs = beat.obstacles;
  const has = (k: string) => obs.some((o) => o.kind === k);
  if (obs.some((o) => LANE_HAZARD_KINDS.includes(o.kind))) {
    const laser = obs.some((o) => HAZARD_KINDS.includes(o.kind) && !LANE_HAZARD_KINDS.includes(o.kind));
    if (laser) return 'lanejump';
    if (has('chaser')) return 'chaser';
    return has('drop') ? 'drop' : 'lane';
  }
  if (beat.pulse) return 'pulse';
  if (has('drone')) return has('floor') ? 'gate' : 'drone';
  if (has('high')) return 'high';
  if (has('ceiling')) return 'slide';
  if (obs.some((o) => o.kind === 'beam' && o.from === 'back')) return 'rear';
  if (beat.requiredLevel === 3) return 'triple';
  if (beat.requiredLevel === 2) return 'double';
  if (has('beam')) return 'beam';
  return 'jump';
}

type Mix = StageDef['mix'];

/** The moves level weights + mix can produce, in canonical order. */
export function movesForMix(w: readonly [number, number, number], mix: Mix): MoveId[] {
  const frontBeams = mix.rear < 1;
  const anyBeam = mix.beam > 0 || w[1] > 0 || w[2] > 0;
  const laneAlone = mix.lane > 0 && mix.laneCombo < 1;
  const on: Record<MoveId, boolean> = {
    lane: laneAlone && mix.drop + mix.chaser < 1,
    drop: laneAlone && mix.drop > 0,
    chaser: laneAlone && mix.chaser > 0 && mix.drop < 1,
    lanejump: mix.lane > 0 && mix.laneCombo > 0,
    jump: w[0] > 0 && mix.beam < 1,
    beam: w[0] > 0 && mix.beam > 0 && frontBeams,
    double: w[1] > 0 && frontBeams,
    slide: mix.slide > 0 && mix.high < 1,
    drone: mix.drone > 0 && mix.gate < 1,
    triple: w[2] > 0 && frontBeams,
    high: mix.slide > 0 && mix.high > 0,
    rear: mix.rear > 0 && anyBeam,
    gate: mix.drone > 0 && mix.gate > 0,
    pulse: mix.pulse > 0,
  };
  return MOVE_ORDER.filter((m) => on[m]);
}

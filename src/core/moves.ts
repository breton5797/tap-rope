/**
 * Which player-facing move a beat asks for (GDD v2 §13), by priority:
 * ring → tumble, ball → side, cross rope → cross, back rope → back,
 * level 3 → triple, level 2 → double, bird-only → bird, Double-Dutch → dd, else jump.
 * Shared by the timeline (lane badges) and the generator (move quotas).
 * movesForMix: which moves a stage definition can produce (keeps `moves` honest).
 */
import type { Beat, MoveId, RopeMode, StageDef } from '../types';

export const MOVE_ORDER: readonly MoveId[] = ['jump', 'double', 'triple', 'tumble', 'side', 'cross', 'back', 'dd', 'bird'];

export type BeatShape = Pick<Beat, 'obstacles' | 'requiredLevel' | 'doubleDutch'>;

export function moveForBeat(beat: BeatShape): MoveId {
  const obs = beat.obstacles;
  const has = (k: string) => obs.some((o) => o.kind === k);
  const ropes = obs.filter((o) => o.kind === 'rope');
  if (has('ring')) return 'tumble';
  if (has('ball')) return 'side';
  if (ropes.some((o) => o.cross)) return 'cross';
  if (ropes.some((o) => o.back)) return 'back';
  if (beat.requiredLevel === 3) return 'triple';
  if (beat.requiredLevel === 2) return 'double';
  if (has('bird') && beat.requiredLevel === 0) return 'bird';
  if (beat.doubleDutch) return 'dd';
  return 'jump';
}

type Mix = StageDef['mix'];

/** The moves a rope mode + level weights + mix can produce, in canonical order. */
export function movesForMix(
  mode: RopeMode, w: readonly [number, number, number], mix: Mix,
): MoveId[] {
  const long = mode === 'long';
  const on: Record<MoveId, boolean> = {
    jump: true,
    double: w[1] > 0,
    triple: w[2] > 0,
    tumble: long && mix.ring > 0,
    side: mix.ball > 0,
    cross: !long && mix.cross > 0,
    back: !long && mix.back > 0,
    dd: long && mix.doubleDutch > 0,
    bird: mix.bird > 0,
  };
  return MOVE_ORDER.filter((m) => on[m]);
}

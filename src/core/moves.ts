/**
 * Which player-facing move a beat asks for (GDD v2 §13), by priority:
 * ring → tumble, ball → side, cross rope → cross, back rope → back,
 * level 3 → triple, level 2 → double, bird-only → bird, Double-Dutch → dd, else jump.
 * Shared by the timeline (lane badges) and the generator (move quotas).
 */
import type { Beat, MoveId } from '../types';

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

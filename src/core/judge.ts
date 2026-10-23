/**
 * Beat judgement (GDD §1, v2 §10). Effective level = tumble ? 2 : level.
 * Check order: bird → ball → ring → rope/hurdle (height, level) → cross → dir.
 * Pass is PERFECT at height ≥ PERFECT_H, for ball/bird-only beats, or for a ring
 * cleared by a tumble; otherwise GOOD. Pickups need the player's lane, airborne
 * and effective level ≥ pickup level, and are never collected on a hit.
 */
import type { Beat, JudgeResult, JumpLevel, ObstacleKind, PlayerState, RopeMode } from '../types';
import { CLEAR_H, PERFECT_H } from './physics';

type MissReason = NonNullable<JudgeResult['reason']>;

const PICKUPS: readonly ObstacleKind[] = ['coin', 'shield', 'slow', 'heart'];

function effectiveLevel(p: PlayerState): JumpLevel {
  return p.tumble ? 2 : p.level;
}

function collect(beat: Beat, p: PlayerState): readonly ObstacleKind[] {
  if (p.grounded) return [];
  const level = effectiveLevel(p);
  return beat.obstacles
    .filter((o) => PICKUPS.includes(o.kind) && (o.lane ?? 0) === p.lane && level >= o.level)
    .map((o) => o.kind);
}

/** first failing rule in §10 order, or null when the beat is cleared */
function missReason(beat: Beat, p: PlayerState, mode: RopeMode): MissReason | null {
  const obs = beat.obstacles;
  const level = effectiveLevel(p);
  const has = (k: ObstacleKind) => obs.some((o) => o.kind === k);
  if (has('bird') && !p.grounded && (level >= 2 || p.tumble)) return 'bird';
  if (obs.some((o) => o.kind === 'ball' && (o.lane ?? 0) === p.lane)) return 'ball';
  if (has('ring') && !p.tumble) return 'tumble';
  const barriers = obs.filter((o) => o.kind === 'rope' || o.kind === 'hurdle');
  if (barriers.length === 0) return null;
  if (p.grounded || p.height < CLEAR_H) return 'low';
  if (level < Math.max(...barriers.map((o) => o.level))) return 'level';
  const ropes = obs.filter((o) => o.kind === 'rope');
  if (ropes.some((o) => o.cross) && !p.cross) return 'cross';
  if (mode === 'solo' && ropes.some((o) => (o.back ?? false) !== p.backward)) return 'dir';
  return null;
}

export function judgeBeat(beat: Beat, p: PlayerState, mode: RopeMode): JudgeResult {
  const reason = missReason(beat, p, mode);
  if (reason) return { beatId: beat.id, grade: 'miss', hit: true, reason, collected: [] };
  const kinds = beat.obstacles.map((o) => o.kind);
  const collected = collect(beat, p);
  const barrier = kinds.some((k) => k === 'rope' || k === 'hurdle');
  const hazard = kinds.some((k) => k === 'bird' || k === 'ball' || k === 'ring');
  if (!barrier && !hazard) return { beatId: beat.id, grade: 'none', hit: false, reason: null, collected };
  const perfect = !barrier || kinds.includes('ring') || p.height >= PERFECT_H;
  return { beatId: beat.id, grade: perfect ? 'perfect' : 'good', hit: false, reason: null, collected };
}

/**
 * Beat judgement (GDD §1). Bird violations win over everything; rope/hurdle
 * need airborne, height ≥ CLEAR_H and level ≥ required. Passing at
 * height ≥ PERFECT_H is PERFECT. Pickups are collected only if not hit.
 */
import type { Beat, JudgeResult, ObstacleKind, PlayerState } from '../types';
import { CLEAR_H, PERFECT_H } from './physics';

const PICKUPS: readonly ObstacleKind[] = ['coin', 'shield', 'slow', 'heart'];

function collect(beat: Beat, p: PlayerState): readonly ObstacleKind[] {
  if (p.grounded) return [];
  return beat.obstacles
    .filter((o) => PICKUPS.includes(o.kind) && p.level >= o.level)
    .map((o) => o.kind);
}

export function judgeBeat(beat: Beat, p: PlayerState): JudgeResult {
  const miss = (reason: 'low' | 'level' | 'bird'): JudgeResult => ({
    beatId: beat.id, grade: 'miss', hit: true, reason, collected: [],
  });
  const kinds = beat.obstacles.map((o) => o.kind);
  const hasBird = kinds.includes('bird');
  const barriers = beat.obstacles.filter((o) => o.kind === 'rope' || o.kind === 'hurdle');
  const collected = collect(beat, p);

  if (hasBird && !p.grounded && p.level >= 2) return miss('bird');
  if (barriers.length > 0) {
    const required = Math.max(...barriers.map((o) => o.level));
    if (p.grounded || p.height < CLEAR_H) return miss('low');
    if (p.level < required) return miss('level');
    const grade = p.height >= PERFECT_H ? 'perfect' : 'good';
    return { beatId: beat.id, grade, hit: false, reason: null, collected };
  }
  const grade = hasBird ? 'perfect' : 'none';
  return { beatId: beat.id, grade, hit: false, reason: null, collected };
}

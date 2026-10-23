/**
 * Beat judgement — GDD v4 §3. Check order: drone → slide lasers → jump lasers.
 * - drone: airborne with level ≥ 2 → 'drone' (floor, slide or a 1단 hop are fine)
 * - high / ceiling: not sliding → 'standing'
 * - floor / beam L: sliding → 'slide'; on the floor or below CLEAR_H → 'low'; level < L → 'level'
 * Grades: jump beats perfect at height ≥ PERFECT_H; slide beats perfect when the slide is
 * 0.05–0.35s old; a lone drone passed is perfect. Pickups need airborne + level ≥ L, never on a hit.
 */
import type { Beat, JudgeResult, ObstacleKind, PlayerState } from '../types';
import { CLEAR_H, PERFECT_H } from './physics';

type MissReason = NonNullable<JudgeResult['reason']>;

const PICKUPS: readonly ObstacleKind[] = ['coin', 'shield', 'slow', 'heart'];
const SLIDE_PERFECT_MIN = 0.05;
const SLIDE_PERFECT_MAX = 0.35;

const isJumpLaser = (k: ObstacleKind) => k === 'floor' || k === 'beam';
const isSlideLaser = (k: ObstacleKind) => k === 'high' || k === 'ceiling';

function collect(beat: Beat, p: PlayerState): readonly ObstacleKind[] {
  if (p.grounded) return [];
  return beat.obstacles.filter((o) => PICKUPS.includes(o.kind) && p.level >= o.level).map((o) => o.kind);
}

function missReason(beat: Beat, p: PlayerState): MissReason | null {
  const obs = beat.obstacles;
  if (obs.some((o) => o.kind === 'drone') && !p.grounded && p.level >= 2) return 'drone';
  if (obs.some((o) => isSlideLaser(o.kind)) && !p.sliding) return 'standing';
  const jumps = obs.filter((o) => isJumpLaser(o.kind));
  if (jumps.length === 0) return null;
  if (p.sliding) return 'slide';
  if (p.grounded || p.height < CLEAR_H) return 'low';
  if (p.level < Math.max(...jumps.map((o) => o.level))) return 'level';
  return null;
}

export function judgeBeat(beat: Beat, p: PlayerState): JudgeResult {
  const reason = missReason(beat, p);
  if (reason) return { beatId: beat.id, grade: 'miss', hit: true, reason, collected: [] };
  const kinds = beat.obstacles.map((o) => o.kind);
  const collected = collect(beat, p);
  const pass = (perfect: boolean): JudgeResult => ({
    beatId: beat.id, grade: perfect ? 'perfect' : 'good', hit: false, reason: null, collected,
  });
  if (kinds.some(isJumpLaser)) return pass(p.height >= PERFECT_H);
  if (kinds.some(isSlideLaser)) return pass(p.slideAge >= SLIDE_PERFECT_MIN && p.slideAge <= SLIDE_PERFECT_MAX);
  if (kinds.includes('drone')) return pass(true);
  return { beatId: beat.id, grade: 'none', hit: false, reason: null, collected };
}

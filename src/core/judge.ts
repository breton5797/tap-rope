/**
 * Beat judgement — GDD v4 §3 + v5 §4. Check order: lane → drone → slide lasers → jump lasers.
 * - lane: a lane hazard (guard / drop / chaser) whose `lanes` include player.lane → 'lane'
 * - drone: airborne with level ≥ 2 → 'drone' (floor, slide or a 1단 hop are fine)
 * - high / ceiling: not sliding → 'standing'
 * - floor / beam L: sliding → 'slide'; on the floor or below CLEAR_H → 'low'; level < L → 'level'
 * v8 grades (GDD-v8 B) by how far the deciding input was from its ideal moment — pass / fail is unchanged:
 * - jump: the ideal tap puts the apex of the last segment over the laser, so offset = time to that apex
 *   (vy / gravity: + = rising = tapped late, − = falling = tapped early);
 * - slide: ideal slide age SLIDE_IDEAL (offset = SLIDE_IDEAL − slideAge, + = started late);
 * - lane: a dodge out of a blocked lane laneAge s before the beat is late by LANE_EARLY − laneAge
 *   (0 when it came LANE_EARLY or more ahead, or no dodge was needed); lane + laser takes the worse;
 * - |offset| ≤ PERFECT_WINDOW perfect, ≤ GREAT_WINDOW great, else good; a lone drone passed is perfect.
 * Pickups need airborne + level ≥ L (+ player.lane ∈ lanes when listed), never on a hit.
 */
import type { Beat, Grade, JudgeResult, Obstacle, ObstacleKind, PhysicsConfig, PlayerState } from '../types';
import { LANE_HAZARD_KINDS } from '../types';
import { CLEAR_H, DEFAULT_PHYSICS } from './physics';

type MissReason = NonNullable<JudgeResult['reason']>;

const PICKUPS: readonly ObstacleKind[] = ['coin', 'shield', 'slow', 'heart'];
export const PERFECT_WINDOW = 0.05;
export const GREAT_WINDOW = 0.11;
/** slide age (s) at the beat for a perfect slide: the middle of the slide's safe span */
export const SLIDE_IDEAL = 0.2;
/** a lane dodge this long (s) or more before the beat counts as on time */
export const LANE_EARLY = 0.16;

const isJumpLaser = (k: ObstacleKind) => k === 'floor' || k === 'beam';
const isSlideLaser = (k: ObstacleKind) => k === 'high' || k === 'ceiling';
const inLane = (o: Obstacle, p: PlayerState) => o.lanes === undefined || o.lanes.includes(p.lane);

function collect(beat: Beat, p: PlayerState): readonly ObstacleKind[] {
  if (p.grounded) return [];
  return beat.obstacles.filter((o) => PICKUPS.includes(o.kind) && p.level >= o.level && inLane(o, p)).map((o) => o.kind);
}

function missReason(beat: Beat, p: PlayerState): MissReason | null {
  const obs = beat.obstacles;
  if (obs.some((o) => LANE_HAZARD_KINDS.includes(o.kind) && (o.lanes ?? []).includes(p.lane))) return 'lane';
  if (obs.some((o) => o.kind === 'drone') && !p.grounded && p.level >= 2) return 'drone';
  if (obs.some((o) => isSlideLaser(o.kind)) && !p.sliding) return 'standing';
  const jumps = obs.filter((o) => isJumpLaser(o.kind));
  if (jumps.length === 0) return null;
  if (p.sliding) return 'slide';
  if (p.grounded || p.height < CLEAR_H) return 'low';
  if (p.level < Math.max(...jumps.map((o) => o.level))) return 'level';
  return null;
}

export function gradeFor(offset: number): Grade {
  const off = Math.abs(offset);
  return off <= PERFECT_WINDOW + 1e-9 ? 'perfect' : off <= GREAT_WINDOW + 1e-9 ? 'great' : 'good';
}

/** + late / − early, for a beat whose blocked lanes the player already avoids */
function laneOffset(beat: Beat, p: PlayerState): number {
  const dodged = beat.blockedLanes.includes(p.laneFrom) && p.lane !== p.laneFrom;
  return dodged ? Math.max(0, LANE_EARLY - p.laneAge) : 0;
}

/** the deciding input's offset from its ideal moment, or null for a beat without one (drone / pickups) */
function inputOffset(beat: Beat, p: PlayerState, cfg: PhysicsConfig): number | null {
  const kinds = beat.obstacles.map((o) => o.kind);
  const lane = kinds.some((k) => LANE_HAZARD_KINDS.includes(k)) ? laneOffset(beat, p) : null;
  const body = kinds.some(isJumpLaser) ? p.vy / cfg.gravity : kinds.some(isSlideLaser) ? SLIDE_IDEAL - p.slideAge : null;
  if (body === null) return lane;
  return lane === null || Math.abs(body) >= lane ? body : lane;
}

export function judgeBeat(beat: Beat, p: PlayerState, cfg: PhysicsConfig = DEFAULT_PHYSICS): JudgeResult {
  const reason = missReason(beat, p);
  if (reason) return { beatId: beat.id, grade: 'miss', hit: true, reason, collected: [] };
  const kinds = beat.obstacles.map((o) => o.kind);
  const collected = collect(beat, p);
  const offset = inputOffset(beat, p, cfg);
  if (offset !== null) return { beatId: beat.id, grade: gradeFor(offset), hit: false, reason: null, collected, offset };
  const grade: Grade = kinds.includes('drone') ? 'perfect' : 'none';
  return { beatId: beat.id, grade, hit: false, reason: null, collected };
}

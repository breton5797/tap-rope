/**
 * Per-run bookkeeping for v7 (GDD-v7 §3): records the inputs the session actually applied, at the
 * session time they were applied (always a deterministic boundary), counts overdrives, and builds the
 * RunSummary (achievements) and the RunRecord (server re-simulation, endless/daily only).
 */
import type { GameMode, LaneDir, MoveId, RunInput, RunRecord, RunSummary, Swipe } from '../types';
import { LANE_HAZARD_KINDS } from '../types';
import { SIM_VERSION } from './replay';
import type { Session } from './session';

export type LoggedInput = 'tap' | 'slideKey' | Swipe | { readonly lane: LaneDir };

export interface RunLog {
  /** call right before the input is applied to `s` */
  input(s: Session, input: LoggedInput): void;
  fever(): void;
  summary(end: Session, stageId: string | null): RunSummary;
  /** null for campaign stages (only endless/daily go to the leaderboard) */
  record(end: Session): RunRecord | null;
}

function codeOf(input: LoggedInput): RunInput[1] | null {
  if (typeof input === 'object') return input.lane < 0 ? 'U' : 'N';
  if (input === 'tap') return 'T';
  if (input === 'slideKey') return 'S';
  return input === 'down' ? 'D' : null; // other swipes have no effect in the session
}

/** v8 fail tip: the move that would have dodged the beat that took the last heart (the beat before the cursor). */
export function hitBy(end: Session): MoveId | null {
  const beat = end.status === 'failed' ? end.beats[end.cursor - 1] : undefined;
  if (!beat) return null;
  const lane = end.player.lane;
  const laneHit = beat.obstacles.find((o) => o.lanes !== undefined && LANE_HAZARD_KINDS.includes(o.kind) && o.lanes.includes(lane));
  if (laneHit) return laneHit.kind === 'guard' ? 'lane' : (laneHit.kind as 'drop' | 'chaser');
  const kinds = new Set(beat.obstacles.map((o) => o.kind));
  const beam = beat.obstacles.find((o) => o.kind === 'beam');
  if (kinds.has('high')) return 'high';
  if (kinds.has('ceiling')) return 'slide';
  if (beam?.from === 'back') return 'rear';
  if (beam) return beam.level >= 3 ? 'triple' : beam.level === 2 ? 'double' : 'beam';
  if (kinds.has('drone')) return kinds.has('floor') ? 'gate' : 'drone';
  if (kinds.has('floor')) return beat.pulse ? 'pulse' : 'jump';
  return null;
}

export function createRunLog(mode: GameMode, seed: number, date: string): RunLog {
  let inputs: RunInput[] = [];
  let fevers = 0;
  return {
    input(s, input) {
      const code = codeOf(input);
      if (code && s.status === 'playing') inputs = [...inputs, [s.time, code]];
    },
    fever() {
      fevers += 1;
    },
    summary(end, stageId) {
      const sc = end.score;
      return {
        mode, stageId, cleared: end.status === 'cleared', hitsTaken: end.hitsTaken,
        perfects: sc.perfects, goods: sc.goods, misses: sc.misses, maxCombo: sc.maxCombo,
        fevers, seconds: end.time, score: sc.score, date, hitBy: hitBy(end),
      };
    },
    record(end) {
      if (mode === 'stage') return null;
      return { sim: SIM_VERSION, mode, seed, date, inputs, endTime: end.time, clientScore: end.score.score };
    },
  };
}

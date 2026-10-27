/**
 * Per-run bookkeeping for v7 (GDD-v7 §3): records the inputs the session actually applied, at the
 * session time they were applied (always a deterministic boundary), counts overdrives, and builds the
 * RunSummary (achievements) and the RunRecord (server re-simulation, endless/daily only).
 */
import type { GameMode, LaneDir, RunInput, RunRecord, RunSummary, Swipe } from '../types';
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
        fevers, seconds: end.time, score: sc.score, date,
      };
    },
    record(end) {
      if (mode === 'stage') return null;
      return { sim: SIM_VERSION, mode, seed, date, inputs, endTime: end.time, clientScore: end.score.score };
    },
  };
}

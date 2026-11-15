/**
 * Run hook (office live events): counts what a run adds to the weekly goal from the session's events, for
 * core/live applyRun. App wiring (render worker): start with `startCounts()`, fold every step's events with
 * `trackCounts`, and on the run's end call core/live `applyRun(live, summary, counts, today, tier)`.
 */
import type { GameEvent, Session } from '../../../game/session';
import type { LiveRunCounts } from '../../core/live/types';

export const ZERO_COUNTS: LiveRunCounts = { coffee: 0, 'dodge-dinner': 0, docs: 0, perfects: 0, jumps: 0, 'part2-clears': 0 };

const todo = (name: string): never => {
  throw new Error(`live: ${name} not implemented yet`);
};

export function startCounts(): LiveRunCounts {
  return ZERO_COUNTS;
}
/** folds one step's events in (session = the state after the step) */
export function trackCounts(counts: LiveRunCounts, s: Pick<Session, 'stage'>, events: readonly GameEvent[]): LiveRunCounts {
  return todo(`trackCounts(${counts.coffee}, ${s.stage.id}, ${events.length})`);
}

/**
 * The reward ledger and the run hook: each reward is paid once per date / week, and a date earlier than the
 * latest one processed (clock turned back) earns nothing.
 */
import type { DateKey, LiveRunCounts, LiveRunOutcome, LiveSave, ProgressTier, RunSummaryLike } from './run-types';

const todo = (name: string): never => {
  throw new Error(`live: ${name} not implemented yet`);
};

/** a finished run (any office stage or the daily) on `date`: daily record + card stamp + weekly goal + rewards */
export function applyRun(live: LiveSave, run: RunSummaryLike, counts: LiveRunCounts, date: DateKey, tier: ProgressTier): LiveRunOutcome {
  return todo(`applyRun(${live.v}, ${run.stageId}, ${counts.coffee}, ${date}, ${tier})`);
}
/** the save on opening the game on `date`: rolls the card / goal into the new week, records the theme as seen */
export function rollover(live: LiveSave, date: DateKey): LiveSave {
  return todo(`rollover(${live.v}, ${date})`);
}

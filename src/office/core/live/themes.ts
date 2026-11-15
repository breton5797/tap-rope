/** 이번 주 이벤트: six themes rotating by week; each dresses the daily and sets one weekly goal. */
import type { GoalProgress, LiveRunCounts, WeekKey, WeekTheme } from './types';

const todo = (name: string): never => {
  throw new Error(`live: ${name} not implemented yet`);
};

export const THEMES: readonly WeekTheme[] = [];

/** the theme of `week` (rotation by weekIndex) */
export function themeOf(week: WeekKey): WeekTheme {
  return todo(`themeOf(${week})`);
}
/** the goal progress after a run (a new week starts at 0; done is sticky) */
export function addGoalProgress(prev: GoalProgress | null, week: WeekKey, counts: LiveRunCounts): GoalProgress {
  return todo(`addGoalProgress(${prev?.week}, ${week}, ${counts.coffee})`);
}

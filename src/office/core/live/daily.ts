/** 오늘의 칼퇴 미션: one short three-mission stage per (date, tier), only the moves the player has unlocked. */
import type { DailyPlan, DateKey, ProgressTier } from './types';

/** BALANCE knobs: the daily's difficulty per tier (casual bot ≈ 80 % at the player's tier) */
export const DAILY_D_OFFSET = -0.1;
export const DAILY_HAZARDS: readonly [number, number, number] = [8, 8, 10];
/** a theme may at most double the pickup rate */
export const THEME_PICKUP_MAX = 2;
/** points for the first clear of a day's mission */
export const DAILY_POINTS = 60;

const todo = (name: string): never => {
  throw new Error(`live: ${name} not implemented yet`);
};

/** "live-YYYY-MM-DD-t<tier>": the daily stage id (office levels / missions / boss recognise it) */
export function dailyId(date: DateKey, tier: ProgressTier): string {
  return `live-${date}-t${tier}`;
}
/** the (date, tier) of a daily stage id, else null */
export function parseDailyId(id: string): { readonly date: DateKey; readonly tier: ProgressTier } | null {
  return todo(`parseDailyId(${id})`);
}
/** the player's tier: the highest office stage cleared (save.stars ≥ 1), 0 = none */
export function progressTier(stars: Readonly<Record<string, number>>): ProgressTier {
  return todo(`progressTier(${Object.keys(stars).length})`);
}
/** the daily opens once stage 1 is cleared */
export function dailyUnlocked(tier: ProgressTier): boolean {
  return tier >= 1;
}
/** the day's plan: deterministic in (date, tier) */
export function dailyPlan(date: DateKey, tier: ProgressTier): DailyPlan {
  return todo(`dailyPlan(${date}, ${tier})`);
}

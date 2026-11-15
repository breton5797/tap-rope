/** Local calendar dates and Monday-start weeks as pure functions on "YYYY-MM-DD" (no time zone / DST maths). */
import type { DateKey, WeekKey, Weekday } from './types';

const todo = (name: string): never => {
  throw new Error(`live: ${name} not implemented yet`);
};

/** the device's local date at `now` */
export function todayKey(now: Date): DateKey {
  return todo(`todayKey(${now.toISOString()})`);
}
/** true for a real calendar date in "YYYY-MM-DD" form */
export function isDateKey(s: unknown): s is DateKey {
  return todo(`isDateKey(${String(s)})`);
}
/** `date` moved by `days` (negative = earlier), across month and year ends */
export function addDays(date: DateKey, days: number): DateKey {
  return todo(`addDays(${date}, ${days})`);
}
/** 0 = Monday … 6 = Sunday */
export function weekdayOf(date: DateKey): Weekday {
  return todo(`weekdayOf(${date})`);
}
/** the Monday of the week holding `date` */
export function weekOf(date: DateKey): WeekKey {
  return todo(`weekOf(${date})`);
}
/** whole days from `a` to `b` (b − a) */
export function daysBetween(a: DateKey, b: DateKey): number {
  return todo(`daysBetween(${a}, ${b})`);
}
/** a stable index of `week` (weeks since a fixed Monday), for rotations */
export function weekIndex(week: WeekKey): number {
  return todo(`weekIndex(${week})`);
}

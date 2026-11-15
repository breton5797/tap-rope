/**
 * Local calendar dates and Monday-start weeks as pure functions on "YYYY-MM-DD": civil-day arithmetic on
 * integers (days since 1970-01-01 in the proleptic Gregorian calendar), so no time zone or DST ever enters.
 * Only todayKey reads a Date, and only its local Y/M/D.
 */
import type { DateKey, WeekKey, Weekday } from './types';

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
const leap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const monthDays = (y: number, m: number): number => [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** days since 1970-01-01 (H. Hinnant's days_from_civil) */
function toDays(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function fromDays(z0: number): DateKey {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

const parts = (date: DateKey): [number, number, number] => {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
};
const daysOf = (date: DateKey): number => toDays(...parts(date));

/** the device's local date at `now` */
export function todayKey(now: Date): DateKey {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** true for a real calendar date in "YYYY-MM-DD" form */
export function isDateKey(s: unknown): s is DateKey {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = parts(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= monthDays(y, m);
}

/** `date` moved by `days` (negative = earlier), across month and year ends */
export function addDays(date: DateKey, days: number): DateKey {
  return fromDays(daysOf(date) + Math.trunc(days));
}

/** 0 = Monday … 6 = Sunday (1970-01-01 was a Thursday) */
export function weekdayOf(date: DateKey): Weekday {
  return ((((daysOf(date) + 3) % 7) + 7) % 7) as Weekday;
}

/** the Monday of the week holding `date` */
export function weekOf(date: DateKey): WeekKey {
  return addDays(date, -weekdayOf(date));
}

/** whole days from `a` to `b` (b − a) */
export function daysBetween(a: DateKey, b: DateKey): number {
  return daysOf(b) - daysOf(a);
}

/** a stable index of `week` (weeks since the Monday 1969-12-29), for rotations */
export function weekIndex(week: WeekKey): number {
  return Math.floor((daysOf(weekOf(week)) + 3) / 7);
}

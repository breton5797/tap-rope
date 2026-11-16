/**
 * The daily stage id "live-YYYY-MM-DD-t<tier>-b<row>": the date, the player's tier and the superior's
 * OFFICE_BOSSES row. Dependency-free so content / boss / cutscenes / levels can recognise a daily stage
 * without importing the live module (no import cycles).
 */
import type { DateKey, ProgressTier } from './types';

const RE = /^live-(\d{4}-\d{2}-\d{2})-t(\d{1,2})-b(\d{1,2})$/;

export function makeDailyId(date: DateKey, tier: ProgressTier, row: number): string {
  return `live-${date}-t${tier}-b${row}`;
}

/** the parts of a daily stage id, else null (the date is checked by the caller where it matters) */
export function readDailyId(id: string): { readonly date: DateKey; readonly tier: ProgressTier; readonly row: number } | null {
  const m = RE.exec(id);
  if (!m) return null;
  const tier = Number(m[2]);
  if (tier < 1 || tier > 10) return null;
  return { date: m[1], tier: tier as ProgressTier, row: Number(m[3]) };
}

export const isDailyId = (id: string): boolean => readDailyId(id) !== null;

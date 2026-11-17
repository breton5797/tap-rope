/**
 * RewardService ledger (monetization spec §1): each rewarded grant has an id — "ad:daily:<date>:1" or
 * "ad:stage:<date>:<n>" — made before the ad is shown and paid at most once, so a duplicate SDK callback, a
 * replayed promise or an app restart can never pay twice. Kept apart from the live save (officeescape.mon.v1).
 */
import type { DateKey } from '../core/live/types';
import { isDateKey } from '../core/live/dates';
import { DAILY_POINTS } from '../core/live/daily';
import type { MonetizationConfig } from './config';
import type { Placement } from './policy';

export const MON_SAVE_VERSION = 1;
/** newest paid keys kept: at most 6 a day, so ~2 months */
const LEDGER_KEEP = 360;
/** days whose counters are kept */
const DAYS_KEEP = 14;

export interface DayClaims {
  readonly stage: number;
  readonly daily: boolean;
}

export interface MonSave {
  readonly v: typeof MON_SAVE_VERSION;
  /** first launch (ms since epoch) — the start of the new-player grace period */
  readonly firstOpenMs: number;
  readonly days: Readonly<Record<DateKey, DayClaims>>;
  readonly ledger: readonly string[];
}

export function emptyMon(nowMs: number): MonSave {
  return { v: MON_SAVE_VERSION, firstOpenMs: nowMs, days: {}, ledger: [] };
}

const NO_CLAIMS: DayClaims = { stage: 0, daily: false };

export function claimsOn(save: MonSave, date: DateKey): DayClaims {
  return save.days[date] ?? NO_CLAIMS;
}

/** the id for the next grant of `placement` on `date` */
export function nextKey(save: MonSave, placement: Placement, date: DateKey): string {
  return placement === 'daily' ? `ad:daily:${date}:1` : `ad:stage:${date}:${claimsOn(save, date).stage + 1}`;
}

interface ParsedKey {
  readonly placement: Placement;
  readonly date: DateKey;
  readonly n: number;
}

function parseKey(key: string): ParsedKey | null {
  const m = /^ad:(daily|stage):([^:]+):(\d+)$/.exec(key);
  if (!m) return null;
  const date = m[2];
  const n = Number(m[3]);
  if (!isDateKey(date) || n < 1) return null;
  const placement = m[1] as Placement;
  if (placement === 'daily' && n !== 1) return null;
  return { placement, date, n };
}

function pruneDays(days: Readonly<Record<DateKey, DayClaims>>): Record<DateKey, DayClaims> {
  const keep = Object.keys(days).sort().slice(-DAYS_KEEP) as DateKey[];
  return Object.fromEntries(keep.map((d) => [d, days[d]])) as Record<DateKey, DayClaims>;
}

/** pay the grant `key` once: the new save and its points, or null (paid already, over the limit, malformed) */
export function claim(save: MonSave, key: string, config: MonetizationConfig): { readonly save: MonSave; readonly points: number } | null {
  const k = parseKey(key);
  if (!k || save.ledger.includes(key)) return null;
  const day = claimsOn(save, k.date);
  if (k.placement === 'daily' && day.daily) return null;
  if (k.placement === 'stage' && (k.n > config.rewardedDailyLimit || k.n !== day.stage + 1)) return null;
  const nextDay: DayClaims = k.placement === 'daily' ? { ...day, daily: true } : { ...day, stage: day.stage + 1 };
  const points = k.placement === 'daily' ? DAILY_POINTS : config.stageRewardPoints;
  return {
    save: { ...save, days: pruneDays({ ...save.days, [k.date]: nextDay }), ledger: [...save.ledger, key].slice(-LEDGER_KEEP) },
    points,
  };
}

const isClaims = (v: unknown): v is DayClaims =>
  typeof v === 'object' && v !== null && Number.isInteger((v as DayClaims).stage) && (v as DayClaims).stage >= 0 && typeof (v as DayClaims).daily === 'boolean';

/** a stored value → a valid save (anything broken starts fresh at `nowMs`) */
export function parseMon(raw: unknown, nowMs: number): MonSave {
  if (typeof raw !== 'object' || raw === null) return emptyMon(nowMs);
  const r = raw as Partial<MonSave>;
  if (r.v !== MON_SAVE_VERSION || typeof r.firstOpenMs !== 'number' || !Number.isFinite(r.firstOpenMs)) return emptyMon(nowMs);
  const days = Object.fromEntries(
    Object.entries(typeof r.days === 'object' && r.days !== null ? r.days : {}).filter(([d, c]) => isDateKey(d) && isClaims(c)),
  ) as Record<DateKey, DayClaims>;
  const ledger = Array.isArray(r.ledger) ? r.ledger.filter((k): k is string => typeof k === 'string' && parseKey(k) !== null) : [];
  return { v: MON_SAVE_VERSION, firstOpenMs: r.firstOpenMs, days: pruneDays(days), ledger: ledger.slice(-LEDGER_KEEP) };
}

/** take back the grant `key` (its points could not be saved): the reward can be earned again */
export function unclaim(save: MonSave, key: string): MonSave {
  const k = parseKey(key);
  if (!k || !save.ledger.includes(key)) return save;
  const day = claimsOn(save, k.date);
  const back: DayClaims = k.placement === 'daily' ? { ...day, daily: false } : { ...day, stage: Math.max(0, day.stage - 1) };
  return { ...save, days: { ...save.days, [k.date]: back }, ledger: save.ledger.filter((x) => x !== key) };
}

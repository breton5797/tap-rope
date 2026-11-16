/**
 * The live save under 'officeescape.live.v1' (spec §6): its own key (the main save is untouched), versioned,
 * and validated field by field on load — anything missing, corrupt, from another version, or a storage that
 * throws (private mode, quota) gives a usable save instead of an error.
 */
import type { CardHistoryEntry, CosmeticCategory, DailyRecord, GoalProgress, LiveSave, ThemeId, WeekCard } from './types';
import { LIVE_SAVE_KEY, LIVE_SAVE_VERSION } from './types';
import { isDateKey, weekOf } from './dates';
import { cosmeticById } from './cosmetics';
import { THEMES } from './themes';

/** recent days kept in LiveSave.daily */
export const DAILY_KEEP_DAYS = 14;
const HISTORY_KEEP = 26;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const defaultStore = (): Store | undefined => {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
};

export function emptyLive(): LiveSave {
  return {
    v: LIVE_SAVE_VERSION, maxDate: null, daily: {}, card: null, history: [], goal: null, owned: [], equipped: {}, badges: [],
    themeSeen: {}, ledger: [],
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
/** a week key is a real Monday */
const isWeekKey = (v: unknown): v is string => isDateKey(v) && weekOf(v) === v;
const CATEGORIES: readonly CosmeticCategory[] = ['trail', 'jump', 'stamp', 'cardTheme'];
const THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id);

function parseDaily(raw: unknown): Record<string, DailyRecord> {
  if (!isObj(raw)) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([d, r]) =>
    isDateKey(d) && isObj(r) && typeof r.cleared === 'boolean' && count(r.best) ? [[d, { cleared: r.cleared, best: r.best }]] : []));
}

function parseCard(raw: unknown): WeekCard | null {
  if (!isObj(raw) || !isWeekKey(raw.week) || !Array.isArray(raw.stamps) || raw.stamps.length !== 7) return null;
  if (!raw.stamps.every((s) => typeof s === 'boolean')) return null;
  return { week: raw.week, stamps: raw.stamps as unknown as WeekCard['stamps'] };
}

function parseHistory(raw: unknown): CardHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((h): h is CardHistoryEntry => isObj(h) && isWeekKey(h.week) && count(h.stamps, 7)).slice(0, HISTORY_KEEP)
    .map((h) => ({ week: h.week, stamps: h.stamps }));
}

function parseGoal(raw: unknown): GoalProgress | null {
  return isObj(raw) && isWeekKey(raw.week) && count(raw.value) && typeof raw.done === 'boolean' ? { week: raw.week, value: raw.value, done: raw.done } : null;
}

/** validates unknown JSON into a LiveSave (drops what does not fit; another version = a fresh save) */
export function parseLive(raw: unknown): LiveSave {
  if (!isObj(raw) || raw.v !== LIVE_SAVE_VERSION) return emptyLive();
  const owned = Array.isArray(raw.owned) ? [...new Set(raw.owned.filter((id): id is string => typeof id === 'string' && cosmeticById(id) !== undefined))] : [];
  const eq = isObj(raw.equipped) ? raw.equipped : {};
  const equipped = Object.fromEntries(CATEGORIES.flatMap((c) => {
    const id = eq[c];
    return typeof id === 'string' && owned.includes(id) && cosmeticById(id)?.category === c ? [[c, id]] : [];
  }));
  const seen = isObj(raw.themeSeen) ? raw.themeSeen : {};
  return {
    v: LIVE_SAVE_VERSION,
    maxDate: isDateKey(raw.maxDate) ? raw.maxDate : null,
    daily: parseDaily(raw.daily),
    card: parseCard(raw.card),
    history: parseHistory(raw.history),
    goal: parseGoal(raw.goal),
    owned,
    equipped,
    badges: Array.isArray(raw.badges) ? [...new Set(raw.badges.filter(isWeekKey))] : [],
    themeSeen: Object.fromEntries(THEME_IDS.flatMap((t) => (isDateKey(seen[t]) ? [[t, seen[t]]] : []))),
    ledger: Array.isArray(raw.ledger) ? raw.ledger.filter((k): k is string => typeof k === 'string') : [],
  };
}

/** the stored live save, or a fresh one (missing, corrupt, other version, storage refused) */
export function loadLive(store: Store | undefined = defaultStore()): LiveSave {
  try {
    const text = store?.getItem(LIVE_SAVE_KEY);
    return text ? parseLive(JSON.parse(text)) : emptyLive();
  } catch {
    return emptyLive();
  }
}

/** writes the live save; false when storage refused it (private mode / quota) */
export function saveLive(live: LiveSave, store: Store | undefined = defaultStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(LIVE_SAVE_KEY, JSON.stringify(live));
    return true;
  } catch {
    return false;
  }
}

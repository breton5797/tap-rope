/** The live save under 'officeescape.live.v1': versioned, corrupt-safe and private-mode-safe. */
import type { LiveSave } from './types';
import { LIVE_SAVE_VERSION } from './types';

export const DAILY_KEEP_DAYS = 14;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const todo = (name: string): never => {
  throw new Error(`live: ${name} not implemented yet`);
};

export function emptyLive(): LiveSave {
  return {
    v: LIVE_SAVE_VERSION, maxDate: null, daily: {}, card: null, history: [], goal: null, owned: [], equipped: {}, badges: [],
    themeSeen: {}, ledger: [],
  };
}
/** the stored live save, or a fresh one (missing, corrupt, other version, storage refused) */
export function loadLive(store?: Store): LiveSave {
  return todo(`loadLive(${store ? 'store' : 'default'})`);
}
/** writes the live save; false when storage refused it (private mode / quota) */
export function saveLive(live: LiveSave, store?: Store): boolean {
  return todo(`saveLive(${live.v}, ${store ? 'store' : 'default'})`);
}
/** validates unknown JSON into a LiveSave (drops what does not fit) */
export function parseLive(raw: unknown): LiveSave {
  return todo(`parseLive(${typeof raw})`);
}

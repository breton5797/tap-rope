// v8 (GDD-v8 A6, design P0-3): achievement banners one at a time. Unlocks that arrive together collapse
// into "업적 N개 달성"; nothing shows while the countdown / briefing / cutscene is up (they wait), and
// whatever is still waiting when the result card opens is dropped (the card shows the badges).
import type { AchievementMeta } from '../types';

export interface Banner {
  /** the achievement when the banner shows exactly one (its badge art), else null */
  readonly id: string | null;
  readonly title: string;
  readonly desc: string;
  readonly count: number;
}

/** the banner for everything waiting: the achievement itself, or a count with the names */
export function bannerFor(pending: readonly AchievementMeta[]): Banner | null {
  if (pending.length === 0) return null;
  if (pending.length === 1) return { id: pending[0].id, title: pending[0].name, desc: pending[0].desc, count: 1 };
  return { id: null, title: `업적 ${pending.length}개 달성`, desc: pending.map((a) => a.name).join(' · '), count: pending.length };
}

export interface ToastQueue {
  push(a: AchievementMeta): void;
  /** true while a countdown / briefing / cutscene is up: banners wait */
  setBlocked(blocked: boolean): void;
  /** drops everything waiting (the result card shows the badges instead) */
  clear(): void;
}

/** unlocks this close together collapse into one banner */
export const GATHER_MS = 80;
export const BANNER_MS = 3000;
export const LEAVE_MS = 350;

interface Timers {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

const GLOBAL_TIMERS: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => globalThis.clearTimeout(id),
};

/** `show` mounts a banner and returns a function that starts its exit */
export function createToastQueue(show: (b: Banner) => () => void, timers: Timers = GLOBAL_TIMERS): ToastQueue {
  let pending: readonly AchievementMeta[] = [];
  let busy = false;
  let blocked = false;
  let gather = 0;

  const flush = (): void => {
    gather = 0;
    if (busy || blocked) return;
    const b = bannerFor(pending);
    if (!b) return;
    pending = [];
    busy = true;
    const leave = show(b);
    timers.setTimeout(() => {
      leave();
      timers.setTimeout(() => {
        busy = false;
        flush();
      }, LEAVE_MS);
    }, BANNER_MS);
  };
  const schedule = (): void => {
    if (gather === 0) gather = timers.setTimeout(flush, GATHER_MS);
  };
  return {
    push(a) {
      if (pending.some((p) => p.id === a.id)) return;
      pending = [...pending, a];
      schedule();
    },
    setBlocked(next) {
      if (blocked === next) return;
      blocked = next;
      if (!blocked) schedule();
    },
    clear() {
      pending = [];
      if (gather !== 0) timers.clearTimeout(gather);
      gather = 0;
    },
  };
}

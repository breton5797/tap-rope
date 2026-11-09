// One-time move tips (R4, pt-casual): the first lane hazard after 2부 starts (stage 6+) and the first lanejump
// (stage 7) get a short gesture hint a little before the beat — shown once, never again (own storage key, so
// the save format is untouched), never while another overlay (the mission card) is up, never on autoplay.
import type { VisibleObstacle } from '../../types';
import { HAZARD_KINDS } from '../../types';
import { SAVE_PREFIX } from '../../flavor';

export type TipId = 'lane2' | 'lanejump';

export const TIP_KEY = `${SAVE_PREFIX}.tips.v1`;
/** a tip starts this long (s) before its beat at most… */
export const TIP_LEAD = 1.6;
/** …and no later than this (too late to read and act) */
const TIP_LATEST = 0.6;
/** a tip stays up this long at most (s) */
export const TIP_TIME = 1.6;
/** part 2 starts at stage 6 (0-based 5); lanejump is taught on stage 7 */
const PART2 = 5;
const LANEJUMP_STAGE = 6;

export function loadTips(): TipId[] {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(TIP_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is TipId => x === 'lane2' || x === 'lanejump') : [];
  } catch {
    return [];
  }
}

export function saveTip(id: TipId): void {
  const all = loadTips();
  if (all.includes(id)) return;
  try {
    globalThis.localStorage?.setItem(TIP_KEY, JSON.stringify([...all, id]));
  } catch {
    // storage refused: the tip may show once more next time, nothing else
  }
}

export interface Tip {
  readonly id: TipId;
  readonly beat: number;
}

const beatOf = (o: Pick<VisibleObstacle, 'id'>): number => Number.parseInt(o.id, 10);

/** the tip due for the obstacles ahead on stage `stageIndex` (0-based), given the tips already seen */
export function pickTip(stageIndex: number, obs: readonly VisibleObstacle[], seen: readonly TipId[]): Tip | null {
  if (stageIndex < PART2) return null;
  // only the next hazard beat (the one the callout names): a tip for a later beat would contradict it
  let next = -1;
  let nextTu = Number.POSITIVE_INFINITY;
  for (const o of obs) {
    if (!HAZARD_KINDS.includes(o.kind) || o.timeUntil <= 0 || o.timeUntil >= nextTu) continue;
    nextTu = o.timeUntil;
    next = beatOf(o);
  }
  let best: Tip | null = null;
  let bestTu = Number.POSITIVE_INFINITY;
  for (const o of obs) {
    if (!o.lanes || !HAZARD_KINDS.includes(o.kind) || o.timeUntil > TIP_LEAD || o.timeUntil < TIP_LATEST) continue;
    const beat = beatOf(o);
    if (beat !== next) continue;
    const combo = obs.some((x) => beatOf(x) === beat && !x.lanes && HAZARD_KINDS.includes(x.kind));
    const id: TipId | null = combo && stageIndex === LANEJUMP_STAGE && !seen.includes('lanejump') ? 'lanejump' : !seen.includes('lane2') ? 'lane2' : null;
    if (!id) continue;
    // the lanejump tip wins over the plain lane tip; among equals the nearest beat
    const better = !best || (id === 'lanejump' && best.id === 'lane2') || (id === best.id && o.timeUntil < bestTu);
    if (!better) continue;
    best = { id, beat };
    bestTu = o.timeUntil;
  }
  return best;
}

/** per run: which tip is up, since when, for which beat */
export class TipRunner {
  private cur: (Tip & { since: number }) | null = null;
  /** when the tip on screen started (s) */
  get since(): number {
    return this.cur?.since ?? 0;
  }
  private seen: TipId[] | null = null;

  /** the tip to draw this frame (null = none); `blocked` = another overlay is up (the tip waits for a later beat) */
  frame(stageIndex: number, obs: readonly VisibleObstacle[], now: number, blocked: boolean): Tip | null {
    this.seen ??= loadTips();
    if (this.cur) {
      const ahead = obs.find((o) => beatOf(o) === this.cur?.beat);
      if (now - this.cur.since < TIP_TIME && ahead && ahead.timeUntil > -0.3) return this.cur;
      saveTip(this.cur.id);
      this.seen = [...this.seen, this.cur.id];
      this.cur = null;
      return null;
    }
    if (blocked) return null;
    const t = pickTip(stageIndex, obs, this.seen);
    if (!t) return null;
    this.cur = { ...t, since: now };
    return this.cur;
  }
}

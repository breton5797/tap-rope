/**
 * v8 review fixes — small pure rules app.ts applies around a run:
 * - a challenge link (?endless=<seed>&vs=<score>) seeds ONE endless run, then is spent (and leaves the URL);
 * - ?autoplay=1 bot runs earn nothing: no stars, best score, coins, streak or achievements.
 */
import type { GameMode, ResultInfo } from '../types';

export interface SeedChallenge {
  readonly seed: number;
}

/** the seed a run starting now must use (null = random) and the challenge still pending afterwards */
export function takeChallenge<C extends SeedChallenge>(mode: GameMode, pending: C | null): { readonly seed: number | null; readonly pending: C | null } {
  if (mode !== 'endless' || pending === null) return { seed: null, pending };
  return { seed: pending.seed, pending: null };
}

/** `search` without the challenge parameters ('' when nothing else is left) */
export function withoutChallenge(search: string): string {
  const q = new URLSearchParams(search);
  q.delete('endless');
  q.delete('vs');
  const rest = q.toString();
  return rest ? `?${rest}` : '';
}

export const AUTOPLAY_NOTE = 'AUTOPLAY · 보상 없음';

/** the result card of a bot run: nothing earned, no record, flagged in the title */
export function autoplayResult(base: ResultInfo, prevBest: number): ResultInfo {
  return { ...base, best: prevBest, newRecord: false, coinsEarned: 0, title: `${base.title} · ${AUTOPLAY_NOTE}` };
}

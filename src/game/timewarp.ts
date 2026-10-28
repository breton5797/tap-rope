// v7.1 game-clock warp (GDD-v7.1 §4): hit stop and short slow motion. Only the real-time dt fed to
// step() is scaled — judgement, input times and replays all live in session time, so a warped run
// replays to the same score on the server.

export interface Warp {
  /** seconds of real time left in which game time stands still */
  readonly stop: number;
  /** seconds of real time left in slow motion */
  readonly slow: number;
  /** game-time rate during slow motion (0..1) */
  readonly factor: number;
}

export const WARP0: Warp = { stop: 0, slow: 0, factor: 1 };
export const MAX_STOP = 0.12;
const MAX_SLOW = 0.5;

export function hitStop(w: Warp, seconds: number, reduced: boolean): Warp {
  const s = Math.min(MAX_STOP, Math.max(0, seconds) * (reduced ? 0.5 : 1));
  return s > w.stop ? { ...w, stop: s } : w;
}

export function slowMo(w: Warp, seconds: number, factor: number, reduced: boolean): Warp {
  if (reduced || seconds <= 0) return w;
  return { ...w, slow: Math.min(MAX_SLOW, Math.max(w.slow, seconds)), factor: Math.min(1, Math.max(0.1, factor)) };
}

/** Consumes `real` seconds: first the stop, then slow motion, then normal time. Returns the game dt. */
export function stepWarp(w: Warp, real: number): { warp: Warp; dt: number } {
  if (w.stop <= 0 && w.slow <= 0) return { warp: w, dt: real };
  let left = Math.max(0, real);
  const stopped = Math.min(left, w.stop);
  left -= stopped;
  const slowed = Math.min(left, w.slow);
  left -= slowed;
  const stop = w.stop - stopped;
  const slow = w.slow - slowed;
  const warp = stop <= 0 && slow <= 0 ? WARP0 : { stop, slow, factor: w.factor };
  return { warp, dt: slowed * w.factor + left };
}

/**
 * Office build flavour (칼퇴근 대작전), swapped in for src/flavor.ts by build/office-swaps.ts: offline, its own
 * save prefix (never mixes with v8 saves on the same origin), a character pick on a fresh save, and a fresh
 * seed per run. Copy starts as the v8 copy; the office task fills in the comic lines.
 * Imports of '../flavor' from here reach the real v8 module (the swap skips its own replacement).
 */
import type { StageDef } from '../types';
import { V8_COPY, type CopyKey, type Features } from '../flavor';

export { V8_COPY, type CopyKey, type Features };

export const FEATURES: Features = {
  online: false, endless: false, daily: false, shop: false, leaderboard: false, transfer: false, firstRunPick: true,
};

export const SAVE_PREFIX = 'officeescape';

export const COPY: Readonly<Record<CopyKey, string>> = { ...V8_COPY };

/** a fresh uniform uint32 for every run start (P3: chosen once, kept on the run, never steered by input) */
export function runSeedFor(_stage: StageDef): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

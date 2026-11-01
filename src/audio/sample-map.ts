// Sample seam (office v2.1). v8 is synth-only: no files are listed and no sound maps to one, so createAudio
// always plays the procedural recipe. The office build swaps in src/office/audio/sample-map.ts.
import type { SfxName } from '../types';

/** files under ./sfx/ to preload after the first user gesture (v8: none) */
export const SAMPLE_NAMES: readonly string[] = [];

/** the sample a sound plays (and its playback rate), or null for the synth voice */
export function sampleFor(_name: SfxName, _level: number): { readonly id: string; readonly rate: number } | null {
  return null;
}

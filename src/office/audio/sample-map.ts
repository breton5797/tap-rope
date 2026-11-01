// Office sample map (v2.1), swapped in for src/audio/sample-map.ts: which game sound plays which file under
// public-office/sfx (./sfx/<id>.ogg, .m4a on Safari). A file that is missing or fails to decode falls back to
// the synth voice (office/audio/sfx.ts), so the build works before the files land.
import type { SfxName } from '../../types';

export const SAMPLE_NAMES: readonly string[] = [
  'jump1', 'jump2', 'jump3', 'land', 'slide', 'lane', 'pick-coin', 'pick-shield', 'pick-slow', 'pick-heart', 'pick-item',
  'pick-item-done', 'perfect', 'stamp', 'mission-ok', 'mission-miss',
];

const DIRECT: Partial<Record<SfxName, string>> = {
  land: 'land', slide: 'slide', lane: 'lane', coin: 'pick-coin', perfect: 'perfect',
  'pick-shield': 'pick-shield', 'pick-slow': 'pick-slow', 'pick-heart': 'pick-heart', 'pick-item-done': 'pick-item-done',
  stamp: 'stamp', 'mission-ok': 'mission-ok', 'mission-miss': 'mission-miss',
};

const jumpId = (level: number): string => `jump${Math.min(3, Math.max(1, Math.round(level || 1)))}`;

/** jump / boost by level (1–3), 'pick-item' at the level as its playback rate, the rest one file each */
export function sampleFor(name: SfxName, level: number): { readonly id: string; readonly rate: number } | null {
  if (name === 'jump' || name === 'boost') return { id: jumpId(name === 'boost' ? Math.max(2, level) : level), rate: 1 };
  if (name === 'pick-item') return { id: 'pick-item', rate: Number.isFinite(level) && level > 0 ? level : 1 };
  const id = DIRECT[name];
  return id ? { id, rate: 1 } : null;
}

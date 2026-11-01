// v8 stays synth-only: its sample map lists no files and maps no sound to one.
import { describe, expect, it } from 'vitest';
import { SAMPLE_NAMES, sampleFor } from '../../src/audio/sample-map';
import type { SfxName } from '../../src/types';

const ALL: readonly SfxName[] = [
  'jump', 'boost', 'land', 'perfect', 'good', 'hit', 'coin', 'powerup', 'combo', 'fever', 'clear', 'fail', 'click', 'count',
  'slide', 'warn', 'zap', 'rescue', 'lane', 'alert', 'door', 'boss-intro', 'boss-charge', 'boss-stagger', 'boss-down', 'achieve',
  'shield', 'graze', 'bump', 'pick-shield', 'pick-slow', 'pick-heart', 'pick-item', 'pick-item-done', 'stamp', 'mission-ok', 'mission-miss',
];

describe('v8 sample map', () => {
  it('has no samples: every sound is synthesized', () => {
    expect(SAMPLE_NAMES).toEqual([]);
    for (const n of ALL) for (const level of [1, 2, 3]) expect(sampleFor(n, level), n).toBeNull();
  });
});

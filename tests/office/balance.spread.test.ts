// Balance (office part-2 spec §4) on a small seed set: expert clears every stage ≥ 90%; under the normal bot the
// four characters stay within 10 pp (max − min) — part 1 only: part 2 (stages 6–10) is 10–23 pp on 200 seeds, see
// docs/balance/after.md for why (heart counts; the normal bot's error rate is a fixed ~0.4× casual).
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { measureCell, runSeeds, SKINS } from './balance.harness';
import { curve } from './balance.targets';

const SEEDS = runSeeds(30, 100_000);
const PART1 = 5;

describe('balance targets (spec §4, small seed set)', () => {
  it('expert: ≥ 90% on every stage', () => {
    const cells = STAGES.flatMap((_, i) => SKINS.map((skin) => measureCell('expert', i, skin, SEEDS.slice(0, 15))));
    expect(curve(cells, 'expert').clear.every((c) => c >= 90)).toBe(true);
  }, 120_000);

  it('normal: the four characters within 10 pp on every part-1 stage', () => {
    const cells = STAGES.slice(0, PART1).flatMap((_, i) => SKINS.map((skin) => measureCell('normal', i, skin, SEEDS)));
    const { spread } = curve(cells, 'normal');
    expect(spread.every((s) => s <= 10), spread.map((s) => s.toFixed(1)).join(' ')).toBe(true);
  }, 120_000);
});

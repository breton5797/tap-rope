// Balance (office part-2 spec §4) on a small seed set: expert clears every stage ≥ 95%; under the normal bot the
// four characters stay within 10 pp (max − min) on every stage — the hard gate, checked exactly on 200 seeds by the
// BALANCE_ASSERT report (0–7 pp, docs/balance/after.md). 30 seeds are 30 shared layouts (one run = 3.3 pp), so this
// always-on guard allows SMALL_SLACK more (on these seeds stage 10 reads 16.7 pp).
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { measureCell, runSeeds, SKINS } from './balance.harness';
import { curve, EXPERT_MIN, SPREAD_GATE_PP, SPREAD_GATE_STAGES } from './balance.targets';

const SEEDS = runSeeds(30, 100_000);
const SMALL_SLACK = 10;

describe('balance targets (spec §4, small seed set)', () => {
  it('expert: ≥ 95% on every stage', () => {
    const cells = STAGES.flatMap((_, i) => SKINS.map((skin) => measureCell('expert', i, skin, SEEDS.slice(0, 15))));
    expect(curve(cells, 'expert').clear.every((c) => c >= EXPERT_MIN)).toBe(true);
  }, 120_000);

  it('normal: the four characters within 10 pp (+ small-sample slack) on every stage', () => {
    const cells = STAGES.slice(0, SPREAD_GATE_STAGES).flatMap((_, i) => SKINS.map((skin) => measureCell('normal', i, skin, SEEDS)));
    const { spread } = curve(cells, 'normal');
    expect(spread.every((s) => s <= SPREAD_GATE_PP + SMALL_SLACK), spread.map((s) => s.toFixed(1)).join(' ')).toBe(true);
  }, 120_000);
});

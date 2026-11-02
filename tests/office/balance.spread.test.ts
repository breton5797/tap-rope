// Balance (office part-2 spec §4) on a small seed set: expert clears every stage ≥ 90%; under the normal bot the
// four characters stay within 10 pp (max − min) on part 1 (stages 1–5) — the hard gate. Part 2 (6–10) is minimised
// and reported, not gated (10.5–22.5 pp on 200 seeds; heart counts 2–4, see docs/balance/after.md).
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { measureCell, runSeeds, SKINS } from './balance.harness';
import { curve, SPREAD_GATE_PP, SPREAD_GATE_STAGES } from './balance.targets';

const SEEDS = runSeeds(30, 100_000);

describe('balance targets (spec §4, small seed set)', () => {
  it('expert: ≥ 90% on every stage', () => {
    const cells = STAGES.flatMap((_, i) => SKINS.map((skin) => measureCell('expert', i, skin, SEEDS.slice(0, 15))));
    expect(curve(cells, 'expert').clear.every((c) => c >= 90)).toBe(true);
  }, 120_000);

  it('normal: the four characters within 10 pp on every part-1 stage', () => {
    const cells = STAGES.slice(0, SPREAD_GATE_STAGES).flatMap((_, i) => SKINS.map((skin) => measureCell('normal', i, skin, SEEDS)));
    const { spread } = curve(cells, 'normal');
    expect(spread.every((s) => s <= SPREAD_GATE_PP), spread.map((s) => s.toFixed(1)).join(' ')).toBe(true);
  }, 120_000);
});

// @vitest-environment jsdom
// Office tester run (login spec §4): the result card says the run was not recorded.
import { describe, expect, it } from 'vitest';
import type { ResultInfo, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';
import { buildResult } from '../../src/ui/result';

const ctx: Ctx = { cb: new Proxy({}, { get: () => () => undefined }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true };
const base: ResultInfo = {
  mode: 'stage', stageId: 'w1-s10', title: 't', cleared: true, stars: 0, score: 10, best: 0, newRecord: false,
  perfects: 0, goods: 0, misses: 0, maxCombo: 0, coinsEarned: 0, hasNext: true,
};

describe('office tester result', () => {
  it('is marked 테스트 판 · 기록 안 함; a normal run is not', () => {
    expect(buildResult(ctx, { ...base, testRun: true }).querySelector('.report__test')?.textContent).toBe('테스트 판 · 기록 안 함');
    expect(buildResult(ctx, base).querySelector('.report__test')).toBeNull();
  });
});

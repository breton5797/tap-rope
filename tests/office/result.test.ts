// @vitest-environment jsdom
// Office result card (office module graph): Korean comic chrome, the 야근 확정 stamp on a fail, and
// rewards a failed run only catches up on (earned by earlier clears) labelled as such.
import { describe, expect, it } from 'vitest';
import type { ResultInfo, ResultMeta, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';
import { buildResult } from '../../src/ui/result';
import { buildCutscene } from '../../src/ui/cutscene';
import { CUTSCENES } from '../../src/core/cutscenes';

const ctx = (): Ctx => ({ cb: new Proxy({}, { get: () => () => undefined }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true });
const meta = (over: Partial<ResultMeta> = {}): ResultMeta => ({
  rewards: [], streak: null, unlocked: [], hitBy: null, seed: null, vs: null, board: null, hits: 0, frame: null, ...over,
});
const result = (over: Partial<ResultInfo> = {}): ResultInfo => ({
  mode: 'stage', stageId: 'w3-s10', title: '3단계 · 회의실 층', cleared: false, stars: 0, score: 900, best: 900, newRecord: true,
  perfects: 5, goods: 1, misses: 2, maxCombo: 10, coinsEarned: 0, hasNext: false, ...over,
});
const catchUp = meta({ rewards: [{ kind: 'first-mission', label: '첫 칼퇴 보너스', coins: 60 }], unlocked: ['first-clear', 'zone-1'] });

describe('office result card', () => {
  it('a fail is headlined by the 야근 확정 stamp, in Korean', () => {
    const el = buildResult(ctx(), result());
    const stamp = el.querySelector('.report__status');
    expect(stamp?.textContent).toBe('야근 확정');
    expect(el.textContent).not.toMatch(/OVERTIME|CLOCK OUT|SCORE|RANK|NEW RECORD/);
    expect(el.textContent).toContain('점수');
    expect(el.textContent).toContain('최고 기록!');
  });

  it('a clear says 퇴근 성공! with a Korean score box', () => {
    const el = buildResult(ctx(), result({ cleared: true, stars: 2, hasNext: true }));
    expect(el.querySelector('.report__status')?.textContent).toBe('퇴근 성공!');
    expect(el.textContent).toContain('직급 평가');
  });

  it('rewards a failed run only catches up on are labelled as earned earlier', () => {
    const failed = buildResult(ctx(), result({ meta: catchUp }));
    expect(failed.querySelector('.report__earlier')?.textContent).toContain('이전 퇴근 기록');
    const cleared = buildResult(ctx(), result({ cleared: true, stars: 1, meta: catchUp }));
    expect(cleared.querySelector('.report__earlier')).toBeNull();
    expect(buildResult(ctx(), result({ meta: meta() })).querySelector('.report__earlier')).toBeNull();
  });

  it('the cutscene skip button is Korean', () => {
    const player = buildCutscene(CUTSCENES[0], { reduced: true, onClick: () => undefined }, () => undefined);
    expect(player.el.querySelector('.cut__skip')?.textContent).toContain('건너뛰기');
  });
});

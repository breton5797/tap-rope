// @vitest-environment jsdom
// Result card focus (pt-casual round 2): a Space / Enter held as the run ends must not trigger the first button
// (the character card's 사원 선택): focus starts on the primary action and activation keys are ignored briefly.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdFocus } from '../../src/ui/dom';
import { buildResult, RESULT_KEY_GUARD_MS } from '../../src/ui/result';
import type { ResultInfo, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';

const ctx = (): Ctx => ({ cb: new Proxy({}, { get: () => () => undefined }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true });
const fail = (): ResultInfo => ({
  mode: 'stage', stageId: 'w1-s1', title: '1-1', cleared: false, stars: 0, score: 10, best: 10, newRecord: false,
  perfects: 0, goods: 0, misses: 3, maxCombo: 1, coinsEarned: 0, hasNext: false, skin: 'kid',
} as ResultInfo);

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('result card focus', () => {
  it('holdFocus starts on the element marked data-autofocus', async () => {
    const box = document.createElement('div');
    const a = document.createElement('button');
    const b = document.createElement('button');
    b.dataset.autofocus = '';
    box.append(a, b);
    document.body.appendChild(box);
    holdFocus(box);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(b);
  });

  it('the retry button is the primary focus on a failed run', () => {
    const el = buildResult(ctx(), fail());
    const primary = el.querySelector<HTMLElement>('[data-autofocus]');
    expect(primary?.textContent).toContain('재투입');
  });

  it(`ignores Space / Enter for ${'RESULT_KEY_GUARD_MS'} after it appears, then lets them through`, () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const el = buildResult(ctx(), fail());
    document.body.appendChild(el);
    const btn = el.querySelector<HTMLElement>('button')!;
    const press = (key: string) => {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      btn.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(press(' ')).toBe(true);
    expect(press('Enter')).toBe(true);
    expect(press('Tab')).toBe(false);
    now += RESULT_KEY_GUARD_MS + 1;
    expect(press(' ')).toBe(false);
  });
});

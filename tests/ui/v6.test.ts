// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createUi } from '../../src/ui/index';
import { accuracy } from '../../src/ui/result';
import { MOVES } from '../../src/ui/moves';
import type { UiCallbacks } from '../../src/types';

function callbacks(): UiCallbacks {
  const noop = (): void => undefined;
  return {
    onStartStage: noop, onStartEndless: noop, onStartDaily: noop, onPause: noop, onResume: noop, onRetry: noop,
    onQuit: noop, onNextStage: noop, onBuySkin: noop, onSelectSkin: noop, onSettingsChange: noop, onTutorialDone: noop,
    onUiClick: vi.fn(),
    onOpenArchive: noop, onPlayCutscene: noop, onOpenAchievements: noop, onOpenLeaderboard: noop, onOpenNickname: noop,
  };
}

describe('showLoading', () => {
  it('shows a boot progress bar, updates it in place and hides on null', () => {
    const root = document.createElement('div');
    const ui = createUi(root, callbacks());

    ui.showLoading(0.25);
    const bar = root.querySelector('.boot [role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('25');
    expect(root.textContent).toContain('SYSTEM BOOT');

    ui.showLoading(0.8);
    expect(root.querySelector('.boot [role="progressbar"]')).toBe(bar);
    expect(bar?.getAttribute('aria-valuenow')).toBe('80');
    expect(root.textContent).toContain('80%');

    ui.showLoading(7);
    expect(bar?.getAttribute('aria-valuenow')).toBe('100');

    ui.showLoading(null);
    expect(root.querySelector('.boot [role="progressbar"]')).toBeNull();
  });
});

describe('operation report', () => {
  it('accuracy = timing-weighted share of judged beats (v8: PERFECT 1 · GREAT 0.75 · GOOD 0.5)', () => {
    expect(accuracy({ perfects: 32, goods: 11, misses: 2 })).toBe(83);
    expect(accuracy({ perfects: 4, greats: 4, goods: 0, misses: 0 })).toBe(88);
    expect(accuracy({ perfects: 0, goods: 0, misses: 0 })).toBe(0);
    expect(accuracy({ perfects: 0, goods: 0, misses: 5 })).toBe(0);
  });

  it('shows funds as ₵ and combo as a chain', () => {
    const root = document.createElement('div');
    const ui = createUi(root, callbacks());
    ui.showResult({
      mode: 'stage', stageId: 'w1-s3', title: '1-3 · test', cleared: false, stars: 0, score: 100, best: 50, newRecord: true,
      perfects: 1, goods: 1, misses: 2, maxCombo: 20, coinsEarned: 7, hasNext: true,
    });
    const text = root.textContent ?? '';
    expect(text).toContain('MISSION FAILED');
    expect(text).toContain('₵ 7');
    expect(text).toContain('x20');
    expect(text).not.toMatch(/코인|별/);
  });
});

describe('operation report colours', () => {
  const base = { mode: 'stage', stageId: 'w1-s3', title: '1-3 · t', stars: 0, score: 1, best: 1, newRecord: false, perfects: 9, goods: 1, misses: 2, maxCombo: 3, hasNext: true } as const;

  it('accuracy is teal only on success, and zero funds show a dash', () => {
    const root = document.createElement('div');
    const ui = createUi(root, callbacks());
    ui.showResult({ ...base, cleared: false, coinsEarned: 0 });
    const acc = Array.from(root.querySelectorAll('.report__row')).find((r) => r.textContent?.includes('정확도'));
    expect(acc?.classList.contains('report__row--acc')).toBe(false);
    const funds = Array.from(root.querySelectorAll('.report__row')).find((r) => r.textContent?.includes('획득 자금'));
    expect(funds?.querySelector('dd')?.textContent).toBe('—');

    ui.showResult({ ...base, cleared: true, coinsEarned: 5 });
    const acc2 = Array.from(root.querySelectorAll('.report__row')).find((r) => r.textContent?.includes('정확도'));
    expect(acc2?.classList.contains('report__row--acc')).toBe(true);
  });
});

describe('v6 copy', () => {
  it('move hints carry no exclamation marks', () => {
    for (const m of Object.values(MOVES)) expect(m.hint).not.toContain('!');
  });
});

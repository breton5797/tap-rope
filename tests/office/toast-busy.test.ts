// @vitest-environment jsdom
// Code review: the achievement banner is held while a mission card is up; quitting / failing with the card on
// screen must release it (hideAll / showResult reset the mission hold), not leave banners blocked.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUi } from '../../src/ui/index';
import { GATHER_MS } from '../../src/ui/toast-queue';
import { stageById } from '../../src/core/content';
import type { MissionView, StageDef, UiCallbacks } from '../../src/types';

const cb = new Proxy({}, { get: () => () => undefined }) as UiCallbacks;
const view: MissionView = { index: 0, kind: 'dodge', title: '포스트잇 폭풍', value: 0, target: 8, complete: false, stamps: [null, null, null] };
const banner = { id: 'first-clear', title: '첫 퇴근', desc: 'x' } as unknown as Parameters<ReturnType<typeof createUi>['toastAchievement']>[0];

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('achievement banner hold', () => {
  for (const exit of ['hideAll', 'showResult'] as const) {
    it(`is released by ${exit} while a mission card is on screen`, () => {
      vi.useFakeTimers();
      const root = document.createElement('div');
      document.body.appendChild(root);
      const ui = createUi(root, cb);
      ui.showHud();
      ui.updateMission(view, stageById('w1-s10') as StageDef, 1);
      expect(root.querySelector('.mission-card')).not.toBeNull();
      ui.toastAchievement(banner);
      vi.advanceTimersByTime(GATHER_MS + 20);
      expect(root.querySelector('.ach-toast')).toBeNull(); // held by the card
      if (exit === 'hideAll') ui.hideAll();
      else ui.showResult({ mode: 'stage', stageId: 'w1-s10', title: '1', cleared: false, stars: 0, score: 0, best: 0, newRecord: false, perfects: 0, goods: 0, misses: 0, maxCombo: 0, coinsEarned: 0, hasNext: false } as Parameters<typeof ui.showResult>[0]);
      ui.toastAchievement(banner);
      vi.advanceTimersByTime(GATHER_MS + 20);
      expect(root.querySelector('.ach-toast')).not.toBeNull();
    });
  }
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createUi } from '../../src/ui/index';
import { MOVE_ORDER, MOVES } from '../../src/ui/moves';
import { moveArt } from '../../src/ui/move-art';
import type { MoveId, UiCallbacks } from '../../src/types';

const V5_MOVES: readonly MoveId[] = ['lane', 'drop', 'chaser', 'lanejump'];

function callbacks(): UiCallbacks {
  const noop = (): void => undefined;
  return {
    onStartStage: noop, onStartEndless: noop, onStartDaily: noop, onPause: noop, onResume: noop, onRetry: noop,
    onQuit: noop, onNextStage: noop, onBuySkin: noop, onSelectSkin: noop, onSettingsChange: noop, onTutorialDone: noop,
    onUiClick: vi.fn(),
  };
}

describe('showControls', () => {
  it('shows the two-thumb card and calls onDone once when confirmed', () => {
    const root = document.createElement('div');
    const cb = callbacks();
    const ui = createUi(root, cb);
    const onDone = vi.fn();
    ui.showControls(onDone);

    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('위/아래로 밀어');
    expect(dialog?.textContent).toContain('탭 = 점프');
    expect(dialog?.textContent).toContain('Space');
    const ok = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('알겠어!'));
    expect(ok).toBeDefined();

    ok?.click();
    ok?.click();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(cb.onUiClick).toHaveBeenCalled();
    expect(root.querySelector('.screen--controls')).toBeNull();
  });
});

describe('v5 moves', () => {
  it('has a hint, guide entry and art for every new lane move', () => {
    for (const id of V5_MOVES) {
      expect(MOVES[id].hint.length).toBeGreaterThan(0);
      expect(MOVE_ORDER).toContain(id);
      expect(moveArt(id).getAttribute('class')).toContain(`tut__art--${id}`);
    }
    expect(new Set(MOVE_ORDER).size).toBe(Object.keys(MOVES).length);
  });
});

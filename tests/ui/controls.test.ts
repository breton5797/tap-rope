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
    onOpenArchive: noop, onPlayCutscene: noop, onOpenAchievements: noop, onOpenLeaderboard: noop, onOpenNickname: noop,
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
    expect(dialog?.textContent).toContain('위·아래로 밀기');
    expect(dialog?.textContent).toContain('탭 점프');
    expect(dialog?.textContent).toContain('Space');
    const ok = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('확인'));
    expect(ok).toBeDefined();

    ok?.click();
    ok?.click();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(cb.onUiClick).toHaveBeenCalled();
    expect(root.querySelector('.screen--controls')).toBeNull();
  });
});

describe('showControls keyboard', () => {
  function open(): { root: HTMLElement; onDone: ReturnType<typeof vi.fn> } {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const ui = createUi(root, callbacks());
    const onDone = vi.fn();
    ui.showControls(onDone);
    return { root, onDone };
  }

  it('Escape closes the card like the button, calling onDone once, and never reaches game listeners', () => {
    const { root, onDone } = open();
    const gameKeys = vi.fn();
    window.addEventListener('keydown', gameKeys);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.screen--controls')).toBeNull();
    // first Escape was swallowed; the second one (card gone) passes through to the game as usual
    expect(gameKeys).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', gameKeys);
    root.remove();
  });

  it('Tab keeps focus on the card', () => {
    const { root } = open();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    window.dispatchEvent(tab);

    expect(tab.defaultPrevented).toBe(true);
    expect(root.querySelector('.screen--controls')?.contains(document.activeElement)).toBe(true);
    outside.remove();
    root.remove();
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

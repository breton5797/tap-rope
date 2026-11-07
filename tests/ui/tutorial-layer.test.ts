// @vitest-environment jsdom
// P1 (pt-casual part 1): a move-hint strip shown on the same frame the world froze for a tutorial stop replaced
// the stop's hand prompt (both render into the tutorial layer), so the frozen world waited for an input nobody
// was told about. Invariant: while a tutorial stop is up, nothing else in the tutorial layer can remove it.
import { describe, expect, it } from 'vitest';
import { renderTutorial, renderTutorialStop } from '../../src/ui/overlays';
import type { UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';

const ctx = (): Ctx => ({ cb: new Proxy({}, { get: () => () => undefined }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true });

describe('tutorial layer', () => {
  it('a move-hint strip never replaces an active tutorial stop', () => {
    const layer = document.createElement('div');
    renderTutorialStop(layer, { step: 'lane', dir: 1 });
    renderTutorial(layer, ctx(), 'slide');
    expect(layer.querySelector('.tstop')).not.toBeNull();
    expect(layer.querySelector('.tut')).toBeNull(); // the strip waits: one prompt at a time
    renderTutorial(layer, ctx(), null); // the hint timer running out
    expect(layer.querySelector('.tstop')).not.toBeNull();
  });

  it('the stop goes away on resume, and strips show again after', () => {
    const layer = document.createElement('div');
    renderTutorialStop(layer, { step: 'jump', dir: null });
    renderTutorialStop(layer, null);
    expect(layer.querySelector('.tstop')).toBeNull();
    renderTutorial(layer, ctx(), 'slide');
    expect(layer.querySelector('.tut')).not.toBeNull();
  });
});

describe('a tutorial stop owns the screen (P3)', () => {
  it('clears a stale section title (boss phase line) when the stop appears', async () => {
    const { createUi } = await import('../../src/ui/index');
    const root = document.createElement('div');
    const ui = createUi(root, new Proxy({}, { get: () => () => undefined }) as UiCallbacks);
    ui.showHud();
    ui.showBossLine('1차 공격', '포스트잇 폭풍');
    expect(root.querySelector('.bossline')).not.toBeNull();
    ui.showTutorialStop({ step: 'jump', dir: null });
    expect(root.querySelector('.bossline')).toBeNull();
    expect(root.querySelector('.tstop')).not.toBeNull();
  });
});

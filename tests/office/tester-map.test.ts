// @vitest-environment jsdom
// Office tester (login spec §1): the floor map opens all ten stages; members and guests keep the normal unlocks.
import { describe, expect, it, vi } from 'vitest';
import { defaultSave } from '../../src/core/storage';
import type { UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';

const state = vi.hoisted(() => ({ tester: false }));
vi.mock('../../src/office/platform/account', async (orig) => ({
  ...(await orig<object>()),
  accountState: () => ({ signedIn: state.tester, email: null, tester: state.tester }),
}));

const { buildStageSelect } = await import('../../src/ui/stages');

function ctx(): Ctx {
  const noop = (): void => undefined;
  return { cb: new Proxy({}, { get: () => noop }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true };
}
const locked = (el: HTMLElement): number => el.querySelectorAll('.node__disc.is-locked').length;

describe('tester map', () => {
  it('a guest on a fresh save sees stages 2–10 locked', () => {
    state.tester = false;
    expect(locked(buildStageSelect(ctx(), defaultSave(), () => undefined))).toBe(9);
  });

  it('a tester sees every stage open', () => {
    state.tester = true;
    const el = buildStageSelect(ctx(), defaultSave(), () => undefined);
    expect(el.querySelectorAll('.node__disc')).toHaveLength(10);
    expect(locked(el)).toBe(0);
  });
});

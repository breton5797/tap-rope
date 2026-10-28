// @vitest-environment jsdom
// First-run character picker (office spec §4): one card per owned character, a tap picks it.
import { describe, expect, it, vi } from 'vitest';
import { defaultSave } from '../../src/core/storage';
import type { UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';
import { buildPicker } from '../../src/ui/picker';

function ctx(): Ctx {
  const noop = (): void => undefined;
  const cb = new Proxy({}, { get: () => noop }) as UiCallbacks;
  return { cb, tap: (fn) => fn, reducedMotion: () => true };
}

describe('character picker', () => {
  it('offers the owned characters and reports the pick', () => {
    const onPick = vi.fn();
    const save = { ...defaultSave(), ownedSkins: ['kid', 'cat'] as const };
    const el = buildPicker(ctx(), { ...save, ownedSkins: [...save.ownedSkins] }, onPick);
    const picks = Array.from(el.querySelectorAll<HTMLButtonElement>('.picker__pick'));
    expect(picks).toHaveLength(2);
    expect(el.getAttribute('role')).toBe('dialog');
    picks[1].click();
    expect(onPick).toHaveBeenCalledWith('cat');
  });

  it('works without portrait art (the vector avatar stays)', () => {
    const el = buildPicker(ctx(), defaultSave(), vi.fn());
    const img = el.querySelector('img');
    img?.dispatchEvent(new Event('error'));
    expect(el.querySelector('.picker__pick svg, .picker__pick .avatar')).not.toBeNull();
  });
});

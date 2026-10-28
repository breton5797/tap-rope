// Office save rules: storage runs against the office content (as the office build swaps it in), so both
// free characters are owned on a fresh save and kept when an older save lists only one.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/core/content', () => import('../../src/office/core/content'));

const { defaultSave, parseSave } = await import('../../src/core/storage');

describe('office save', () => {
  it('owns both characters on a fresh save', () => {
    expect(defaultSave().ownedSkins).toEqual(['kid', 'cat']);
    expect(defaultSave().skin).toBe('kid');
  });

  it('keeps free characters owned when a stored save lists fewer', () => {
    const save = parseSave({ ...defaultSave(), ownedSkins: ['kid'], skin: 'cat' });
    expect(save.ownedSkins).toEqual(['kid', 'cat']);
    expect(save.skin).toBe('cat');
  });
});

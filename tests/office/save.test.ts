// Office save rules (office module graph: storage sees the office content), so both free characters are
// owned on a fresh save and kept when an older save lists only one.
import { describe, expect, it } from 'vitest';
import { defaultSave, parseSave } from '../../src/core/storage';

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

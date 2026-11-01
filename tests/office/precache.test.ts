// Office v2.1 offline precache: art, fonts and the sfx in ONE format (.m4a — AAC plays in current Chrome,
// Safari and Firefox); the .ogg twins are only fetched (and then runtime-cached) where .m4a will not play.
import { describe, expect, it } from 'vitest';
import { precachedPublicFiles } from '../../build/service-worker';

describe('office precache list', () => {
  const files = precachedPublicFiles('public-office');

  it('holds every sfx once, as .m4a, and no .ogg', () => {
    const sfx = files.filter((f) => f.startsWith('./sfx/'));
    expect(sfx.length).toBe(16);
    expect(sfx.every((f) => f.endsWith('.m4a'))).toBe(true);
    expect(files.some((f) => f.endsWith('.ogg'))).toBe(false);
  });

  it('still holds the art and fonts; v8 lists no sfx at all', () => {
    expect(files.some((f) => f.startsWith('./art/') && f.endsWith('.webp'))).toBe(true);
    expect(files.some((f) => f.startsWith('./fonts/'))).toBe(true);
    expect(precachedPublicFiles('public').some((f) => f.startsWith('./sfx/'))).toBe(false);
  });
});

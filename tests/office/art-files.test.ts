// v2.2 art completeness: every sprite the office renderer asks for ships under public-office/art (a missing
// file only falls back to the v8 look, so it would never fail a run — this catches it before the e2e does).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFICE_ART, OFFICE_EXTRA_ART } from '../../src/office/render/images';

const ART = join(__dirname, '../../public-office/art');
const missing = (names: readonly string[]): string[] => names.filter((n) => !existsSync(join(ART, `${n}.webp`)));

describe('office art files', () => {
  it('the check itself flags an absent file', () => {
    expect(missing(['hero-kid-run1', 'hero-nobody-run1'])).toEqual(['hero-nobody-run1']);
  });

  it('ship every OFFICE_ART sprite (all four heroes, props, superiors)', () => {
    expect(missing(OFFICE_ART)).toEqual([]);
  });

  it('ship every feel-pack sprite the renderer requests', () => {
    expect(missing(OFFICE_EXTRA_ART)).toEqual([]);
  });
});

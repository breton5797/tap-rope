// v2.2 art completeness: every sprite the office renderer asks for ships under public-office/art (a missing
// file only falls back to the v8 look, so it would never fail a run — this catches it before the e2e does).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFICE_ART, OFFICE_EXTRA_ART } from '../../src/office/render/images';
import { CUTSCENE_IMAGES } from '../../src/office/core/cutscenes';
import { corridorArtFiles } from '../../src/render/art';
import { COSMETICS } from '../../src/office/core/live/cosmetics';
import { LIVE_UI_ART, THEME_BADGES } from '../../src/office/ui/live/parts';
import { THEMES } from '../../src/office/core/live/themes';

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

  it('ship every cutscene still the story plays (part 2: boss-6..10, rescue, the 18:30 ending)', () => {
    expect(missing(CUTSCENE_IMAGES.map((n) => `cut/${n}`))).toEqual([]);
  });

  it('ship a badge for every stage-clear achievement (zone-1 … zone-10)', () => {
    expect(missing(['zone-1', 'zone-3', 'zone-5', 'zone-7', 'zone-10'].map((n) => `ach/${n}`))).toEqual([]);
  });

  it('ship a sprite for every live-events cosmetic (all 20 catalog ids, art/cosmetic/<sprite>.webp)', () => {
    expect(COSMETICS).toHaveLength(20);
    expect(missing(COSMETICS.map((c) => `cosmetic/${c.sprite}`))).toEqual([]);
  });

  it('ship the live UI art: a badge per weekly theme, the 개근 badge, the 복지몰 banner, the deco stickers', () => {
    expect(Object.keys(THEME_BADGES).sort()).toEqual(THEMES.map((t) => t.id).sort());
    expect(missing(LIVE_UI_ART.map((n) => `live/${n}`))).toEqual([]);
  });

  it('ship every corridor photo the office fetches (themes 0–6, exterior sets, the stage-10 night street)', () => {
    const files = corridorArtFiles();
    expect(files).toEqual(expect.arrayContaining(['wall-4-night-a', 'floor-4-night', 'ceiling-6', 'wall-0-night-c']));
    expect(missing(files)).toEqual([]);
  });
});

// v2.2 four heroes (spec 2026-11-02-office-four-heroes-design.md): per-hero frame sets, FX accent colours,
// stat-driven ring size, and the facing guard (no front-facing frame while running).
import { describe, expect, it } from 'vitest';
import { OFFICE_ART, OFFICE_EXTRA_ART } from '../../src/office/render/images';
import { HERO_SKINS, heroAccent, heroSkin, jumpRingScale } from '../../src/office/render/hero-style';
import { RIGHT_FACING, heroPose, type PoseCtx } from '../../src/office/render/hero-frames';
import { Juice } from '../../src/office/render/juice';
import type { PlayerState } from '../../src/types';
import { initialPlayer } from '../../src/core/physics';

describe('per-hero frame sets', () => {
  it('the four selectable heroes draw their own frames; any other skin id is the default hero', () => {
    expect(HERO_SKINS).toEqual(['kid', 'cat', 'bunny', 'robot']);
    for (const s of HERO_SKINS) expect(heroSkin(s)).toBe(s);
    expect(heroSkin('ninja')).toBe('kid');
    expect(heroSkin('astro')).toBe('kid');
  });

  it('bunny and robot have the same frame contract as kid and cat', () => {
    for (const s of ['bunny', 'robot']) {
      for (const f of ['run1', 'run4', 'jump', 'slide', 'hit', 'win']) expect(OFFICE_ART).toContain(`hero-${s}-${f}`);
      for (const f of ['run8', 'jump1', 'jump8', 'slide4', 'hit1', 'hit4']) expect(OFFICE_EXTRA_ART).toContain(`hero-${s}-${f}`);
    }
  });
});

describe('per-hero accents and stats', () => {
  it('each hero has its own accent colour', () => {
    const all = HERO_SKINS.map(heroAccent);
    for (const c of all) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
    expect(new Set(all).size).toBe(4);
    expect(heroAccent('ninja')).toBe(heroAccent('kid'));
  });

  it('the take-off ring scales with the jump multiplier (the jumper shows bigger rings)', () => {
    expect(jumpRingScale('kid')).toBe(1);
    expect(jumpRingScale('cat')).toBe(1);
    expect(jumpRingScale('robot')).toBe(1);
    expect(jumpRingScale('bunny')).toBeCloseTo(1.12);
  });

  it('a tinted burst mixes the accent into the particles', () => {
    const j = new Juice() as unknown as { burst: Juice['burst']; color: string[] };
    j.burst('streak', 0, 0, false, 1, '#FF9A3C');
    expect(j.color.slice(0, 4)).toContain('#FF9A3C');
  });
});

describe('facing guard', () => {
  const p0 = initialPlayer();
  const base: PoseCtx = {
    running: true, hitAge: Infinity, win: false, scroll: 37, landAge: Infinity, jumpAge: Infinity, boostAge: Infinity,
    runFrames: 8, art: () => true,
  };

  it('RIGHT_FACING accepts every running frame and rejects the win still', () => {
    for (const f of ['run1', 'run8', 'jump', 'jump5', 'slide', 'slide3', 'hit', 'hit4']) expect(RIGHT_FACING.test(f)).toBe(true);
    expect(RIGHT_FACING.test('win')).toBe(false);
  });

  it('while running (not cleared) every pose is right-facing, for every hero', () => {
    const air = { ...p0, grounded: false, height: 40, level: 2, airTime: 0.2 } as PlayerState;
    const slide = { ...p0, sliding: true, slideAge: 0.2, slideTime: 0.3 } as PlayerState;
    for (const _skin of HERO_SKINS) {
      for (const p of [p0, air, { ...air, level: 3 } as PlayerState, slide]) {
        for (const hitAge of [Infinity, 0.1, 0.3]) {
          for (const scroll of [0, 13, 77]) expect(heroPose(p, { ...base, hitAge, scroll }).frame).toMatch(RIGHT_FACING);
        }
      }
    }
  });
});

describe('picker run-cycle preview', () => {
  it('cycles run1..run8 at 10 fps (run1..run4 without the extra frames)', async () => {
    const { previewFrame } = await import('../../src/office/render/hero-preview');
    expect(previewFrame(0, 8)).toBe('run1');
    expect(previewFrame(0.75, 8)).toBe('run8');
    expect(previewFrame(0.8, 8)).toBe('run1');
    expect(previewFrame(0.5, 4)).toBe('run2');
  });

  it('draws nothing (and does not throw) before the frame has loaded', async () => {
    const { paintRunPreview } = await import('../../src/office/render/hero-preview');
    let draws = 0;
    const ctx = { clearRect: () => undefined, drawImage: () => draws++, canvas: { width: 120, height: 150 } };
    expect(paintRunPreview(ctx as unknown as CanvasRenderingContext2D, 'bunny', 0.3)).toBe(false);
    expect(draws).toBe(0);
  });
});

describe('lane switch honours the hero agility (laneSwitchTime)', () => {
  it('정시원 switches lanes faster than the default; the others keep the v8 time', async () => {
    const { laneSwitchFor } = await import('../../src/office/render/hero-style');
    const { LANE_SWITCH_TIME } = await import('../../src/types');
    expect(laneSwitchFor('kid')).toBe(LANE_SWITCH_TIME);
    expect(laneSwitchFor('bunny')).toBe(LANE_SWITCH_TIME);
    expect(laneSwitchFor('cat')).toBeCloseTo(LANE_SWITCH_TIME * 0.8);
  });

  it('the drawn lane, lean and progress follow the set switch time; the default stays v8', async () => {
    const { laneProgress, setLaneSwitchTime } = await import('../../src/render/layout');
    const p = { ...initialPlayer(), lane: 2, laneFrom: 1, laneAge: 0.1 } as PlayerState;
    setLaneSwitchTime();
    expect(laneProgress(p)).toBeLessThan(1);
    setLaneSwitchTime(0.096);
    expect(laneProgress(p)).toBe(1);
    setLaneSwitchTime();
    expect(laneProgress(p)).toBeLessThan(1);
  });
});

describe('lane switch time outside a run', () => {
  it('menus and previews use the default; only a running stage uses the hero value', async () => {
    const { frameLaneSwitch } = await import('../../src/office/render/hero-style');
    const { LANE_SWITCH_TIME } = await import('../../src/types');
    expect(frameLaneSwitch('cat', true)).toBeCloseTo(LANE_SWITCH_TIME * 0.8);
    expect(frameLaneSwitch('cat', false)).toBe(LANE_SWITCH_TIME);
  });
});

describe('per-hero draw scale (taller 고도약)', () => {
  it('고도약 draws ×1.12, the others ×1', async () => {
    const { heroDrawScale, MAX_DRAW_SCALE } = await import('../../src/office/render/hero-style');
    expect(heroDrawScale('bunny')).toBeCloseTo(1.12);
    for (const s of ['kid', 'cat', 'robot', 'ninja']) expect(heroDrawScale(s)).toBe(1);
    expect(MAX_DRAW_SCALE).toBeCloseTo(1.12);
  });

  it('the picker preview keeps the height ratio inside its canvas (tallest hero fills it)', async () => {
    const { previewHeight } = await import('../../src/office/render/hero-preview');
    expect(previewHeight(150, 'bunny')).toBeCloseTo(150);
    expect(previewHeight(150, 'kid')).toBeCloseTo(150 / 1.12);
  });
});

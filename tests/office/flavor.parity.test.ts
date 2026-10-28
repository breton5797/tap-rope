// Office copy, music and sound (office spec §4, §7): comic Korean on every copy key, no spy words, a
// cheerful major-key loop on the same beat grid, and comic re-voicings of a few sound effects.
import { describe, expect, it } from 'vitest';
import { V8_COPY } from '../../src/flavor';
import { COPY } from '../../src/office/flavor';
import { createMusic, OFFICE_STYLES } from '../../src/office/audio/music';
import { playSfx } from '../../src/office/audio/sfx';
import { playSfx as v8Sfx } from '../../src/audio/sfx';
import type { SfxName } from '../../src/types';
import { fakeCtx } from '../audio/fake-ctx';

const SPY_WORDS = ['작전', '요원', 'MISSION', 'OPERATION', '임무', '포로'];

describe('office copy', () => {
  it('has a non-empty value for every copy key', () => {
    for (const k of Object.keys(V8_COPY) as (keyof typeof V8_COPY)[]) expect(COPY[k]?.trim(), k).toBeTruthy();
  });

  it('uses no spy vocabulary (the game title 칼퇴근 대작전 aside)', () => {
    for (const [k, v] of Object.entries(COPY)) {
      const text = v.split('칼퇴근 대작전').join('').split('대작전').join(''); // the title, also split over two lines
      for (const w of SPY_WORDS) expect(text, `${k}: ${v}`).not.toContain(w);
    }
  });

  it('says the comic lines of the spec', () => {
    expect(COPY.titleStart).toBe('퇴근 시작!');
    expect(COPY.resultWinStatus).toBe('퇴근 성공!');
    expect(COPY.resultFailStatus).toBe('야근 확정');
    expect(COPY.resultRetry).toBe('내일은 꼭…!');
    expect(COPY.titleShop).toBe('사원 선택');
    // stage 5 (w5-s10) clear is the ending, not v8's "phase 2" rescue line
    expect(COPY.resultStoryRescue).toContain('칼퇴 성공! 18:00:00');
    expect([COPY.pickupShield, COPY.pickupSlow, COPY.pickupHeart].join(' ')).toMatch(/노캔 이어폰.*아이스 아메리카노.*삼각김밥/);
    expect(COPY.tutJumpKicker + COPY.tutSlideKicker + COPY.tutLaneKicker).toContain('김대리');
  });

  it('keeps a stage-number placeholder where v8 has one', () => {
    expect(COPY.resultStoryNext).toMatch(/\{(zone|n)\}/);
  });
});

describe('office music', () => {
  it('every theme is in a major key', () => {
    for (const s of Object.values(OFFICE_STYLES)) expect(s.pad.slice(0, 3)).toEqual([0, 4, 7]);
  });

  it('schedules a loop on the shared engine without throwing', () => {
    const ctx = fakeCtx();
    const m = createMusic(ctx, ctx.createGain());
    for (const world of [0, 1, 2, 3] as const) {
      expect(() => m.start(110, world, 3.2)).not.toThrow();
      m.setFever(true);
      m.setBoss(true);
    }
    m.stop();
    expect(ctx.created.Oscillator ?? 0).toBeGreaterThan(0);
  });
});

describe('office sound effects', () => {
  const ALL: readonly SfxName[] = [
    'jump', 'boost', 'land', 'perfect', 'good', 'hit', 'coin', 'powerup', 'combo', 'fever', 'clear', 'fail', 'click', 'count',
    'slide', 'warn', 'zap', 'rescue', 'lane', 'alert', 'door', 'boss-intro', 'boss-charge', 'boss-stagger', 'boss-down', 'achieve',
    'shield', 'graze', 'bump',
  ];
  const nodes = (play: typeof playSfx, name: SfxName): number => {
    const ctx = fakeCtx();
    play(ctx, ctx.createGain(), name, 1);
    return ctx.created.Oscillator ?? 0;
  };

  it.each(ALL)('%s plays without throwing', (name) => {
    for (const level of [0, 1, 3, Number.NaN]) expect(() => playSfx(fakeCtx(), fakeCtx().createGain(), name, level)).not.toThrow();
  });

  it('re-voices the comic ones (boing hit, stamp fail, elevator ding door) and keeps the rest', () => {
    for (const n of ['hit', 'fail', 'door'] as const) {
      const a = fakeCtx();
      const b = fakeCtx();
      playSfx(a, a.createGain(), n, 1);
      v8Sfx(b, b.createGain(), n, 1);
      expect(JSON.stringify(a.created), n).not.toBe(JSON.stringify(b.created));
    }
    expect(nodes(playSfx, 'perfect')).toBe(nodes(v8Sfx, 'perfect'));
  });
});

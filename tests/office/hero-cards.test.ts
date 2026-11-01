// @vitest-environment jsdom
// v2.2 four heroes UI (spec §3): picker cards with role, blurb, five star bars and catchphrase; a tap selects
// (the card grows, its catchphrase shows), the confirm button hires; the character room shows the same
// details; the result card shows the hire's portrait. Missing key art keeps the vector avatar.
import { describe, expect, it, vi } from 'vitest';
import { defaultSave } from '../../src/core/storage';
import type { ResultInfo, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';
import { buildPicker } from '../../src/ui/picker';
import { buildShop } from '../../src/ui/shop';
import { buildResult } from '../../src/ui/result';
import { CHARACTERS } from '../../src/office/core/characters';

function ctx(): Ctx {
  const noop = (): void => undefined;
  const cb = new Proxy({}, { get: () => noop }) as UiCallbacks;
  return { cb, tap: (fn) => fn, reducedMotion: () => true };
}

const pips = (row: Element): number => row.querySelectorAll('.hero-stars__pip.is-on').length;

describe('office picker', () => {
  it('shows the four hires with role, blurb, five star bars and catchphrase', () => {
    const el = buildPicker(ctx(), defaultSave(), vi.fn());
    const cards = Array.from(el.querySelectorAll('.picker__pick'));
    expect(cards).toHaveLength(4);
    cards.forEach((card, i) => {
      const c = CHARACTERS[i];
      expect(card.textContent).toContain(c.name);
      expect(card.querySelector('.hero-card__role')?.textContent).toBe(c.role);
      expect(card.querySelector('.hero-card__blurb')?.textContent).toBe(c.blurb);
      expect(card.querySelector('.hero-card__quote')?.textContent).toContain(c.catchphrase);
      const rows = Array.from(card.querySelectorAll('.hero-stars__row'));
      expect(rows.map(pips)).toEqual([c.stars.jump, c.stars.agility, c.stars.hearts, c.stars.focus, c.stars.luck]);
      expect(rows.every((r) => r.querySelectorAll('.hero-stars__pip').length === 5)).toBe(true);
      expect(card.querySelector('img')?.getAttribute('src')).toBe(`./art/op-${c.id}.webp`);
    });
  });

  it('selects on tap and hires on confirm', () => {
    const onPick = vi.fn();
    const el = buildPicker(ctx(), defaultSave(), onPick);
    const cards = Array.from(el.querySelectorAll<HTMLButtonElement>('.picker__pick'));
    expect(cards[0].classList.contains('is-selected')).toBe(true);
    cards[3].click();
    expect(onPick).not.toHaveBeenCalled();
    expect(cards[3].classList.contains('is-selected')).toBe(true);
    expect(cards[0].classList.contains('is-selected')).toBe(false);
    expect(cards[3].getAttribute('aria-pressed')).toBe('true');
    const confirm = el.querySelector<HTMLButtonElement>('.picker__confirm');
    expect(confirm?.textContent).toContain('유행운');
    confirm?.click();
    expect(onPick).toHaveBeenCalledWith('robot');
  });

  it('starts on the saved hire and works without key art', () => {
    const el = buildPicker(ctx(), { ...defaultSave(), skin: 'bunny' }, vi.fn());
    expect(el.querySelector('.picker__pick.is-selected')?.textContent).toContain('고도약');
    el.querySelectorAll('img').forEach((img) => img.dispatchEvent(new Event('error')));
    expect(el.querySelectorAll('.picker__pick .avatar, .picker__pick svg').length).toBeGreaterThanOrEqual(4);
  });
});

describe('character room and result', () => {
  it('the room shows the same details for all four', () => {
    const el = buildShop(ctx(), defaultSave(), vi.fn());
    expect(el.querySelectorAll('.skin .hero-stars')).toHaveLength(4);
    expect(el.querySelectorAll('.skin .hero-card__role')).toHaveLength(4);
  });

  it('the result card shows the hire', () => {
    const r: ResultInfo = {
      mode: 'stage', stageId: 'w1-s10', title: 't', cleared: true, stars: 2, score: 100, best: 0, newRecord: true, perfects: 1,
      goods: 0, misses: 0, maxCombo: 1, coinsEarned: 0, hasNext: true, skin: 'robot',
    };
    const hero = buildResult(ctx(), r).querySelector('.report__hero');
    expect(hero?.textContent).toContain('유행운');
    expect(hero?.querySelector('img')?.getAttribute('src')).toBe('./art/op-robot.webp');
  });
});

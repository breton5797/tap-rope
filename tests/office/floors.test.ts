// @vitest-environment jsdom
// Office stage map (part 2 spec §3): 1부 = the building (stages 1–5 top to bottom), 2부 = the way home
// (stages 6–10, ./art/map-bg-2.webp) behind a second tab, locked as a teaser until stage 5 is cleared.
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { defaultSave } from '../../src/core/storage';
import type { SaveData, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';
import { buildStageSelect } from '../../src/ui/stages';
import { initialPart, partOf, partOpen } from '../../src/office/ui/stages';

Element.prototype.scrollIntoView ??= function scrollIntoView(): void {};

const ctx = (): Ctx => ({ cb: new Proxy({}, { get: () => () => undefined }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true });

/** a save with stages 1..n cleared (1 star each) */
const cleared = (n: number): SaveData => {
  const s = defaultSave();
  return { ...s, stars: Object.fromEntries(STAGES.slice(0, n).map((st) => [st.id, 1])) };
};

const tops = (sheet: Element): number[] =>
  Array.from(sheet.querySelectorAll<HTMLElement>('.floors__node')).map((n) => Number(/calc\(([\d.]+)%/.exec(n.style.top)?.[1]));

const sheet = (el: HTMLElement, part: 1 | 2): HTMLElement => el.querySelector(`.floors[data-part="${part}"]`) as HTMLElement;

describe('office stage map', () => {
  it('splits the ten stages over two maps, each top to bottom over its art', () => {
    const el = buildStageSelect(ctx(), defaultSave(), () => undefined);
    expect(el.querySelectorAll('.floors__node')).toHaveLength(STAGES.length);
    for (const [part, src] of [[1, './art/map-bg.webp'], [2, './art/map-bg-2.webp']] as const) {
      const ys = tops(sheet(el, part));
      expect(ys).toHaveLength(5);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
      expect(ys[0]).toBeLessThan(25);
      expect(ys[4]).toBeGreaterThan(75);
      expect(sheet(el, part).querySelector('.floors__img')?.getAttribute('src')).toBe(src);
    }
    expect(el.querySelector('.chaps')).toBeNull();
    expect(el.textContent).toContain('층별 안내도');
  });

  it('totals 30 stars', () => {
    const el = buildStageSelect(ctx(), cleared(3), () => undefined);
    expect(el.querySelector('.chip--star')?.textContent).toBe('3/30');
  });

  it('a fresh save opens on 1부 with 2부 locked as a teaser', () => {
    const el = buildStageSelect(ctx(), defaultSave(), () => undefined);
    expect(sheet(el, 1).hidden).toBe(false);
    expect(sheet(el, 2).hidden).toBe(true);
    const tab2 = el.querySelector<HTMLElement>('.floors__tab[data-part="2"]') as HTMLElement;
    expect(tab2.classList.contains('is-locked')).toBe(true);
    expect(tab2.getAttribute('aria-label')).toContain('잠김');
    expect(sheet(el, 2).classList.contains('is-teaser')).toBe(true);
    // the teaser is still browsable
    tab2.click();
    expect(sheet(el, 2).hidden).toBe(false);
    expect(sheet(el, 1).hidden).toBe(true);
    expect(tab2.getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('.topbar__title')?.textContent).toBe('퇴근길 지도');
  });

  it('titles each map: 층별 안내도 for the building, 퇴근길 지도 for the way home', () => {
    const el = buildStageSelect(ctx(), cleared(5), () => undefined);
    expect(el.querySelector('.topbar__title')?.textContent).toBe('퇴근길 지도');
    expect(el.getAttribute('aria-label')).toBe('퇴근길 지도');
    el.querySelector<HTMLElement>('.floors__tab[data-part="1"]')?.click();
    expect(el.querySelector('.topbar__title')?.textContent).toBe('층별 안내도');
    expect(el.getAttribute('aria-label')).toBe('층별 안내도');
  });

  it('opens on 2부 once stage 5 is cleared, unlocked', () => {
    const el = buildStageSelect(ctx(), cleared(5), () => undefined);
    expect(sheet(el, 2).hidden).toBe(false);
    expect(sheet(el, 2).classList.contains('is-teaser')).toBe(false);
    expect(el.querySelector('.floors__tab[data-part="2"]')?.classList.contains('is-locked')).toBe(false);
  });

  it('labels nodes with the office stage tag', () => {
    const el = buildStageSelect(ctx(), defaultSave(), () => undefined);
    expect(el.querySelector('.node__disc')?.getAttribute('aria-label')).toMatch(/^퇴근길 1단계 /);
  });
});

describe('map parts', () => {
  it('stages 1–5 are 1부, 6–10 are 2부', () => {
    expect(STAGES.map((_, i) => partOf(i))).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
  });

  it('2부 opens with stage 5 cleared or for a tester', () => {
    expect(partOpen(cleared(4), 2)).toBe(false);
    expect(partOpen(cleared(5), 2)).toBe(true);
    expect(partOpen(defaultSave(), 2, true)).toBe(true);
    expect(partOpen(defaultSave(), 1)).toBe(true);
  });

  it('shows the part of the next stage; everything cleared shows 2부', () => {
    expect(initialPart(defaultSave())).toBe(1);
    expect(initialPart(cleared(4))).toBe(1);
    expect(initialPart(cleared(7))).toBe(2);
    expect(initialPart(cleared(10))).toBe(2);
  });
});

describe('map scroll', () => {
  it('scrolls the next stage into view on its map, also after switching tabs back to it', async () => {
    const seen: string[] = [];
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element): void {
      seen.push(this.querySelector('.node__disc')?.getAttribute('aria-label') ?? '');
    };
    try {
      const el = buildStageSelect(ctx(), cleared(9), () => undefined);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      expect(seen.at(-1)).toMatch(/^퇴근길 10단계 /);
      seen.length = 0;
      el.querySelector<HTMLElement>('.floors__tab[data-part="1"]')?.click();
      el.querySelector<HTMLElement>('.floors__tab[data-part="2"]')?.click();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatch(/^퇴근길 10단계 /);
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
  });
});

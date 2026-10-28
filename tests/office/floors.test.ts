// @vitest-environment jsdom
// Office floor map: one node per stage, stage 1 on the top floor down to stage 5 in the lobby.
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { defaultSave } from '../../src/core/storage';
import type { UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';
import { buildStageSelect } from '../../src/ui/stages';

Element.prototype.scrollIntoView ??= function scrollIntoView(): void {};

const ctx = (): Ctx => ({ cb: new Proxy({}, { get: () => () => undefined }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true });

describe('office floor map', () => {
  it('places the five stages top to bottom over the building art, no chapter tabs', () => {
    const el = buildStageSelect(ctx(), defaultSave(), () => undefined);
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('.floors__node'));
    expect(nodes).toHaveLength(STAGES.length);
    const ys = nodes.map((n) => Number(/calc\(([\d.]+)%/.exec(n.style.top)?.[1]));
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys[0]).toBeLessThan(25);
    expect(ys[4]).toBeGreaterThan(75);
    expect(el.querySelector('.floors__img')?.getAttribute('src')).toBe('./art/map-bg.webp');
    expect(el.querySelector('.chaps')).toBeNull();
    expect(el.textContent).toContain('층별 안내도');
  });

  it('labels nodes with the office stage tag', () => {
    const el = buildStageSelect(ctx(), defaultSave(), () => undefined);
    expect(el.querySelector('.node__disc')?.getAttribute('aria-label')).toMatch(/^퇴근길 1단계 /);
  });
});

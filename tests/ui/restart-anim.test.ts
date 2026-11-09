// @vitest-environment jsdom
// perf r4: the boss-bar hit flash and the heart refill restarted their CSS animation with a forced reflow
// (offsetWidth) every hit — a full layout mid-frame. restartAnimation alternates two classes whose keyframes are
// twins (a new animation-name restarts it) — no layout read, no style flush.
import { describe, expect, it } from 'vitest';
import { restartAnimation } from '../../src/ui/dom';

describe('restartAnimation', () => {
  it('alternates cls and its -b twin, never reading layout', () => {
    const el = document.createElement('div');
    let layoutReads = 0;
    Object.defineProperty(el, 'offsetWidth', { get: () => { layoutReads++; return 0; } });
    restartAnimation(el, 'is-hit');
    expect([...el.classList]).toEqual(['is-hit']);
    restartAnimation(el, 'is-hit');
    expect([...el.classList]).toEqual(['is-hit-b']);
    restartAnimation(el, 'is-hit');
    expect([...el.classList]).toEqual(['is-hit']);
    expect(layoutReads).toBe(0);
  });

  it('the twin classes have twin keyframes in the stylesheets', async () => {
    const { readFileSync } = await import('node:fs');
    const v7 = readFileSync('src/styles/v7.css', 'utf8');
    expect(v7).toMatch(/\.boss\.is-hit-b \.boss__fill\s*\{\s*animation: boss-hit-b/);
    expect(v7).toMatch(/\.boss\.is-hit-b\s*\{\s*animation: boss-shake-b/);
    expect(v7).toMatch(/@keyframes boss-hit-b/);
    const office = readFileSync('src/office/styles/office.css', 'utf8');
    expect(office).toMatch(/\.heart\.is-refilled-b\s*\{\s*animation: heart-refill-b/);
  });
});

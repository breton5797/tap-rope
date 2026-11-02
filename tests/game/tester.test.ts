// @vitest-environment jsdom
// Office tester mode seams (login spec §1, §4), v8 default off: an invincible session keeps every hit's FX
// event but never loses a heart or fails; the HUD gets a TEST badge; the result card says the run is not
// recorded; the stage map can show every stage open.
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { defaultSave } from '../../src/core/storage';
import { createSession, MAX_HEARTS, step, type Session } from '../../src/game/session';
import { toHud } from '../../src/game/snapshot';
import type { ResultInfo, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';
import { buildResult } from '../../src/ui/result';
import { createHud } from '../../src/ui/hud';
import { stageNode } from '../../src/ui/stage-node';

const DT = 1 / 60;

function idle(s0: Session, seconds: number): { s: Session; hits: number } {
  let s = s0;
  let hits = 0;
  for (let t = 0; t < seconds && s.status === 'playing'; t += DT) {
    const out = step(s, DT);
    hits += out.events.filter((e) => e.type === 'hit').length;
    s = out.session;
  }
  return { s, hits };
}

function ctx(): Ctx {
  const noop = (): void => undefined;
  return { cb: new Proxy({}, { get: () => noop }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true };
}

describe('invincible session (tester)', () => {
  it('is off by default', () => {
    expect(createSession('stage', STAGES[0]).invincible).toBe(false);
    expect(toHud(createSession('stage', STAGES[0]))).not.toHaveProperty('tester');
  });

  it('standing still: hits still happen (FX), hearts never drop, the stage is cleared', () => {
    const { s, hits } = idle(createSession('stage', STAGES[0], { invincible: true }), 200);
    expect(hits).toBeGreaterThan(MAX_HEARTS);
    expect(s.hearts).toBe(MAX_HEARTS);
    expect(s.status).toBe('cleared');
  });

  it('shows the TEST badge on the HUD', () => {
    const tester = toHud(createSession('stage', STAGES[0], { invincible: true }));
    expect(tester.tester).toBe(true);
    const hud = createHud(ctx());
    const badge = (): HTMLElement | null => hud.el.querySelector('.hud__test');
    hud.update(toHud(createSession('stage', STAGES[0])));
    expect(badge()?.hidden).toBe(true);
    hud.update(tester);
    expect(badge()?.hidden).toBe(false);
    expect(badge()?.textContent).toBe('TEST');
  });
});

describe('tester result and map', () => {
  const base: ResultInfo = {
    mode: 'stage', stageId: STAGES[0].id, title: 't', cleared: true, stars: 0, score: 10, best: 0, newRecord: false,
    perfects: 0, goods: 0, misses: 0, maxCombo: 0, coinsEarned: 0, hasNext: true,
  };

  it('v8 has no tester copy, so nothing is marked', () => {
    expect(buildResult(ctx(), { ...base, testRun: true }).querySelector('.report__test')).toBeNull();
  });

  it('a stage node can be forced open (every stage on the tester map)', () => {
    const save = defaultSave();
    const last = STAGES[STAGES.length - 1];
    expect(stageNode(ctx(), save, last, false, new Set()).querySelector('.node__disc.is-locked')).not.toBeNull();
    expect(stageNode(ctx(), save, last, false, new Set(), true).querySelector('.node__disc.is-locked')).toBeNull();
  });
});

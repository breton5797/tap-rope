import { describe, expect, it } from 'vitest';
import { BOSS_ATTACKS, finisherStarts, INTRO_LINE_AGE, phaseLineDue } from '../../src/game/boss-lines';
import type { BossView } from '../../src/types';

const view = (o: Partial<BossView>): BossView => ({ id: 'gunship', phase: 0, hp: 1, state: 'fight', stateAge: 0, attack: null, ...o });

describe('phaseLineDue', () => {
  it('announces phase 1 once the intro reveal has played', () => {
    expect(phaseLineDue(-1, view({ state: 'intro', stateAge: 0.2 }))).toBeNull();
    expect(phaseLineDue(-1, view({ state: 'intro', stateAge: INTRO_LINE_AGE }))?.kicker).toBe('PHASE 1');
    expect(phaseLineDue(-1, view({ state: 'fight' }))?.text).toBe(BOSS_ATTACKS.gunship[0]);
  });

  it('announces each later phase once, with its attack name', () => {
    const line = phaseLineDue(0, view({ phase: 1, state: 'stagger' }));
    expect(line).toEqual({ phase: 1, kicker: 'PHASE 2', text: '기관포 연사' });
    expect(phaseLineDue(1, view({ phase: 1 }))).toBeNull();
  });

  it('is silent off boss stages and after the defeat', () => {
    expect(phaseLineDue(-1, null)).toBeNull();
    expect(phaseLineDue(1, view({ phase: 2, state: 'defeated' }))).toBeNull();
  });

  it('every boss names three phases', () => {
    for (const names of Object.values(BOSS_ATTACKS)) {
      expect(names).toHaveLength(3);
      for (const n of names) expect(n.length).toBeGreaterThan(0);
    }
  });
});

describe('finisherStarts', () => {
  it('fires on the frame the last hazard takes the HP to 0', () => {
    expect(finisherStarts(view({ hp: 0.04 }), view({ hp: 0 }))).toBe(true);
    expect(finisherStarts(view({ hp: 0 }), view({ hp: 0 }))).toBe(false);
    expect(finisherStarts(null, view({ hp: 0 }))).toBe(false);
    expect(finisherStarts(view({ hp: 0.5 }), view({ hp: 0.4 }))).toBe(false);
  });
});

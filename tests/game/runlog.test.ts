import { describe, expect, it } from 'vitest';
import type { BossView } from '../../src/types';
import { createSession } from '../../src/game/session';
import { bossCues } from '../../src/game/boss-cues';
import { createRunLog } from '../../src/game/runlog';
import { SIM_VERSION } from '../../src/game/replay';

const view = (over: Partial<BossView>): BossView => ({
  id: 'warden', phase: 0, hp: 1, state: 'fight', stateAge: 0.5, attack: null, ...over,
});

describe('run log', () => {
  it('records only effective inputs with their session time and builds a replay record', () => {
    const s = { ...createSession('endless', null, { seed: 9 }), time: 1.25 };
    const log = createRunLog('endless', 9, '2026-10-27');
    log.input(s, 'tap');
    log.input(s, 'down');
    log.input(s, 'up'); // a right-thumb swipe up does nothing in the session: not recorded
    log.input(s, 'slideKey');
    log.input({ ...s, time: 2 }, { lane: -1 });
    log.input({ ...s, time: 2 }, { lane: 1 });
    log.fever();
    log.fever();
    const end = { ...s, time: 30, score: { ...s.score, score: 777, maxCombo: 12 } };
    const rec = log.record(end);
    expect(rec).toEqual({
      sim: SIM_VERSION, mode: 'endless', seed: 9, date: '2026-10-27', endTime: 30, clientScore: 777,
      inputs: [[1.25, 'T'], [1.25, 'D'], [1.25, 'S'], [2, 'U'], [2, 'N']],
    });
    const sum = log.summary(end, null);
    expect(sum.fevers).toBe(2);
    expect(sum.seconds).toBe(30);
    expect(sum.maxCombo).toBe(12);
    expect(sum.mode).toBe('endless');
  });

  it('campaign runs make a summary but no replay record', () => {
    const log = createRunLog('stage', 0, '2026-10-27');
    expect(log.record(createSession('endless', null, { seed: 1 }))).toBeNull();
  });
});

describe('boss cues', () => {
  it('fires intro, charge (once per attack), stagger and down on state changes', () => {
    expect(bossCues(null, view({ state: 'intro', stateAge: 0 }))).toEqual(['boss-intro']);
    expect(bossCues(view({}), view({ attack: { kind: 'beam', timeUntil: 1.5, lanes: null } }))).toEqual(['boss-charge']);
    const attacking = view({ attack: { kind: 'beam', timeUntil: 1.0, lanes: null } });
    expect(bossCues(attacking, view({ attack: { kind: 'beam', timeUntil: 0.9, lanes: null } }))).toEqual([]);
    // a new attack right after the previous one passed (timeUntil jumps up) charges again
    expect(bossCues(view({ attack: { kind: 'beam', timeUntil: 0.01, lanes: null } }),
      view({ attack: { kind: 'floor', timeUntil: 1.4, lanes: null } }))).toEqual(['boss-charge']);
    expect(bossCues(view({}), view({ state: 'stagger', phase: 1 }))).toEqual(['boss-stagger']);
    expect(bossCues(view({}), view({ state: 'defeated' }))).toEqual(['boss-down']);
    expect(bossCues(view({ state: 'defeated' }), view({ state: 'defeated' }))).toEqual([]);
    expect(bossCues(null, null)).toEqual([]);
  });
});

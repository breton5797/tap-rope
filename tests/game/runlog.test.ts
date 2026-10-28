import { describe, expect, it } from 'vitest';
import type { Beat, BossView, LaneId } from '../../src/types';
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
    expect(sum.greats).toBe(0);
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

describe('run log: what ended a failed run (v8 fail tip)', () => {
  const base = createSession('endless', null, { seed: 3 });
  const beat = (obstacles: Beat['obstacles'], extra: Partial<Beat> = {}): Beat => ({
    id: 1, time: 2, obstacles, requiredLevel: 0, needsSlide: false, pulse: false, blockedLanes: [], section: 0, ...extra,
  });
  const failedOn = (b: Beat, lane: LaneId = 1) => createRunLog('stage', 0, 'd').summary(
    { ...base, status: 'failed', beats: [b], cursor: 1, player: { ...base.player, lane } }, 'w1-s1').hitBy;

  it('maps the killing beat to the move that would have dodged it', () => {
    expect(failedOn(beat([{ kind: 'floor', level: 1 }]))).toBe('jump');
    expect(failedOn(beat([{ kind: 'floor', level: 1 }], { pulse: true }))).toBe('pulse');
    expect(failedOn(beat([{ kind: 'beam', level: 2 }]))).toBe('double');
    expect(failedOn(beat([{ kind: 'beam', level: 3 }]))).toBe('triple');
    expect(failedOn(beat([{ kind: 'beam', level: 1, from: 'back' }]))).toBe('rear');
    expect(failedOn(beat([{ kind: 'high', level: 1 }]))).toBe('high');
    expect(failedOn(beat([{ kind: 'ceiling', level: 1 }]))).toBe('slide');
    expect(failedOn(beat([{ kind: 'floor', level: 1 }, { kind: 'drone', level: 1 }]))).toBe('gate');
    expect(failedOn(beat([{ kind: 'drone', level: 1 }]))).toBe('drone');
    expect(failedOn(beat([{ kind: 'guard', level: 1, lanes: [1] }]))).toBe('lane');
    expect(failedOn(beat([{ kind: 'drop', level: 1, lanes: [1, 2] }]))).toBe('drop');
    expect(failedOn(beat([{ kind: 'chaser', level: 1, lanes: [0] }, { kind: 'floor', level: 1 }]), 0)).toBe('chaser');
    // standing outside the lane hazard: the full-width laser was the problem
    expect(failedOn(beat([{ kind: 'guard', level: 1, lanes: [0] }, { kind: 'floor', level: 1 }]), 1)).toBe('jump');
  });

  it('null for cleared / unfinished runs', () => {
    const log = createRunLog('stage', 0, 'd');
    expect(log.summary({ ...base, status: 'cleared' }, 'w1-s1').hitBy).toBeNull();
    expect(log.summary({ ...base, status: 'playing' }, 'w1-s1').hitBy).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { Beat } from '../../src/types';
import { STAGES } from '../../src/core/content';
import { endlessStage } from '../../src/core/levels';
import {
  createSession, MAX_HEARTS, sessionProgress, sessionStars, step, tap, type Session,
} from '../../src/game/session';
import { botShouldTap } from '../../src/game/bot';

const DT = 1 / 60;

function runBot(s0: Session, maxSeconds: number): Session {
  let s = s0;
  for (let t = 0; t < maxSeconds && s.status === 'playing'; t += DT) {
    if (botShouldTap(s)) s = tap(s).session;
    s = step(s, DT).session;
  }
  return s;
}

function runIdle(s0: Session, seconds: number): { s: Session; hits: number } {
  let s = s0;
  let hits = 0;
  for (let t = 0; t < seconds && s.status === 'playing'; t += DT) {
    const out = step(s, DT);
    hits += out.events.filter((e) => e.type === 'hit').length;
    s = out.session;
  }
  return { s, hits };
}

const ropeBeat = (id: number, time: number, level: 1 | 2 | 3): Beat => ({
  id, time, obstacles: [{ kind: 'rope', level }], requiredLevel: level, doubleDutch: false,
});

describe('bot clears every stage (all generated content is beatable)', () => {
  for (const stage of STAGES) {
    it(`${stage.id} ${stage.name}`, () => {
      const end = runBot(createSession('stage', stage), 400);
      expect(end.status).toBe('cleared');
      expect(end.hitsTaken).toBe(0);
      expect(sessionStars(end)).toBeGreaterThanOrEqual(2);
      expect(sessionProgress(end)).toBe(1);
    });
  }

  it('daily challenge for several dates', () => {
    for (const date of ['2026-10-23', '2026-12-31', '2027-02-28']) {
      const end = runBot(createSession('daily', null, { date }), 400);
      expect(end.status).toBe('cleared');
      expect(end.hitsTaken).toBe(0);
    }
  });

  it('endless keeps generating and stays beatable for 3 minutes', () => {
    const end = runBot(createSession('endless', null, { seed: 7 }), 180);
    expect(end.status).toBe('playing');
    expect(end.hitsTaken).toBe(0);
    expect(end.endlessChunk).toBeGreaterThan(3);
    const ids = end.beats.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

const onHalfBeatGrid = (time: number, bpm: number): boolean => {
  const k = time / (30 / bpm);
  return Math.abs(k - Math.round(k)) < 1e-6;
};

describe('music sync', () => {
  it('every stage beat sits on the music half-beat grid anchored at t=0', () => {
    for (const stage of STAGES) {
      const s = createSession('stage', stage);
      expect(s.bpm).toBe(stage.bpm);
      for (const b of s.beats) expect(onHalfBeatGrid(b.time, stage.bpm)).toBe(true);
    }
  });

  it('endless follows each chunk bpm/world and stays on that chunk grid', () => {
    const end = runBot(createSession('endless', null, { seed: 11 }), 150);
    expect(end.endlessChunk).toBeGreaterThan(3);
    // tempo switches wait until the newly generated chunk is about to play
    const active = endlessStage(end.endlessChunk - end.tempoQueue.length, 11);
    expect(end.bpm).toBe(active.bpm);
    expect(end.world).toBe(active.world);
    for (const c of end.tempoQueue) expect(c.at).toBeGreaterThan(end.time);
    const newest = endlessStage(end.endlessChunk, 11);
    for (const b of end.beats.slice(-newest.hazardBeats)) expect(onHalfBeatGrid(b.time, newest.bpm)).toBe(true);
  });
});

describe('session rules', () => {
  it('standing still loses all hearts and fails the stage', () => {
    const { s, hits } = runIdle(createSession('stage', STAGES[0]), 120);
    expect(s.status).toBe('failed');
    expect(s.hearts).toBe(0);
    expect(hits).toBe(MAX_HEARTS);
    expect(sessionStars(s)).toBe(0);
  });

  it('a shield absorbs one hit without losing a heart', () => {
    const base = createSession('stage', STAGES[0]);
    const s0: Session = { ...base, beats: [ropeBeat(0, 0.5, 1), ropeBeat(1, 3, 1)], shield: true, hazardTotal: 2 };
    const out = runIdle(s0, 1);
    expect(out.s.hearts).toBe(MAX_HEARTS);
    expect(out.s.shield).toBe(false);
    expect(out.hits).toBe(1);
  });

  it('invulnerability ignores a second hit right after the first', () => {
    const base = createSession('stage', STAGES[0]);
    const s0: Session = { ...base, beats: [ropeBeat(0, 0.5, 1), ropeBeat(1, 0.9, 1)], hazardTotal: 2 };
    const out = runIdle(s0, 1.2);
    expect(out.s.hearts).toBe(MAX_HEARTS - 1);
  });

  it('a 1단 jump does not clear a 2단 rope; a boosted jump does', () => {
    const base = createSession('stage', STAGES[0]);
    const s0: Session = { ...base, beats: [ropeBeat(0, 0.5, 2)], hazardTotal: 1 };
    let single = step(s0, 0.3).session;
    single = tap(single).session;
    expect(runIdle(single, 1).s.hearts).toBe(MAX_HEARTS - 1);

    let dbl = step(s0, 0.3).session;
    dbl = tap(dbl).session;
    dbl = step(dbl, 0.08).session;
    dbl = tap(dbl).session;
    expect(dbl.player.level).toBe(2);
    expect(runIdle(dbl, 1).s.hearts).toBe(MAX_HEARTS);
  });

  it('slow-mo pickup scales stage time', () => {
    const base = createSession('stage', STAGES[0]);
    const s = step({ ...base, slowTime: 2 }, 0.1).session;
    expect(s.time).toBeCloseTo(0.07, 5);
  });

  it('tap after the run ends is ignored', () => {
    const { s } = runIdle(createSession('stage', STAGES[0]), 120);
    expect(tap(s).events).toHaveLength(0);
    expect(step(s, 0.1).session).toBe(s);
  });
});

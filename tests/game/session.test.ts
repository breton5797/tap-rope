import { describe, expect, it } from 'vitest';
import type { Beat, MoveId, Obstacle, Swipe } from '../../src/types';
import { STAGES } from '../../src/core/content';
import { endlessStage } from '../../src/core/levels';
import {
  createSession, MAX_HEARTS, sessionProgress, sessionStars, step, swipe, tap, type GameEvent, type Session,
} from '../../src/game/session';
import { botAction, type BotAction } from '../../src/game/bot';

const DT = 1 / 60;

interface BotRun { readonly s: Session; readonly performed: ReadonlySet<string> }

/**
 * Plays like a finger: tap, then the optional swipe `swipeDelay` seconds later (real swipes are
 * recognized 60–150 ms after the touch). Records which move actions really happened.
 */
function playBot(s0: Session, maxSeconds: number, swipeDelay = 0): BotRun {
  let s = s0;
  const performed = new Set<string>();
  let pending: { dir: Swipe; at: number } | null = null;
  const note = (events: readonly GameEvent[]): void => {
    for (const e of events) {
      if (e.type === 'swipe' && e.action !== 'none') performed.add(e.action);
      if (e.type === 'tap' && e.action === 'boost') performed.add(`level${e.level}`);
    }
  };
  const doSwipe = (dir: Swipe): void => {
    const swiped = swipe(s, dir);
    note(swiped.events);
    s = swiped.session;
  };
  for (let t = 0; t < maxSeconds && s.status === 'playing'; t += DT) {
    if (pending && t >= pending.at) {
      doSwipe(pending.dir);
      pending = null;
    }
    const a: BotAction | null = pending ? null : botAction(s);
    if (a) {
      const tapped = tap(s);
      note(tapped.events);
      s = tapped.session;
      if (a.swipe && swipeDelay <= 0) doSwipe(a.swipe);
      else if (a.swipe) pending = { dir: a.swipe, at: t + swipeDelay };
    }
    const stepped = step(s, DT);
    note(stepped.events);
    s = stepped.session;
  }
  return { s, performed };
}

const runBot = (s0: Session, maxSeconds: number): Session => playBot(s0, maxSeconds).s;

/** step() caps a single call at 0.1s, so walk to a target time in frame-sized steps */
function advance(s0: Session, seconds: number): Session {
  let s = s0;
  for (let t = 0; t < seconds - 1e-9; t += DT) s = step(s, Math.min(DT, seconds - t)).session;
  return s;
}

/** the physical action that proves a listed move was really used */
const MOVE_PROOF: Partial<Record<MoveId, string>> = {
  tumble: 'tumble', side: 'side', cross: 'cross', back: 'reverse', double: 'level2', triple: 'level3',
};

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

const ropeBeat = (id: number, time: number, level: 1 | 2 | 3, extra: Partial<Obstacle> = {}): Beat => ({
  id, time, obstacles: [{ kind: 'rope', level, ...extra }], requiredLevel: level, doubleDutch: false,
});

const soloStage = STAGES.find((st) => st.ropeMode === 'solo') ?? STAGES[0];
const longStage = STAGES.find((st) => st.ropeMode === 'long') ?? STAGES[0];

describe('bot clears every stage (all generated content is beatable)', () => {
  for (const stage of STAGES) {
    it(`${stage.id} ${stage.name} (${stage.ropeMode})`, () => {
      const { s: end, performed } = playBot(createSession('stage', stage), 400);
      for (const move of stage.moves) {
        const proof = MOVE_PROOF[move];
        if (proof) expect(performed, `${stage.id} should require ${move}`).toContain(proof);
      }
      expect(end.status).toBe('cleared');
      expect(end.hitsTaken).toBe(0);
      expect(sessionStars(end)).toBeGreaterThanOrEqual(2);
      expect(sessionProgress(end)).toBe(1);
    });
  }

  it('every stage stays beatable when swipes land 0.1s after their tap (real finger latency)', () => {
    for (const stage of STAGES) {
      const { s: end } = playBot(createSession('stage', stage), 400, 0.1);
      expect(end.status, stage.id).toBe('cleared');
      expect(end.hitsTaken, stage.id).toBe(0);
    }
  });

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
    let single = advance(s0, 0.3);
    single = tap(single).session;
    expect(runIdle(single, 1).s.hearts).toBe(MAX_HEARTS - 1);

    let dbl = advance(s0, 0.3);
    dbl = tap(dbl).session;
    dbl = advance(dbl, 0.08);
    dbl = tap(dbl).session;
    expect(dbl.player.level).toBe(2);
    expect(runIdle(dbl, 1).s.hearts).toBe(MAX_HEARTS);
  });

  it('swipe up right after a ground tap turns the jump into a tumble that clears a ring', () => {
    const base = createSession('stage', longStage);
    const ring: Beat = { id: 0, time: 0.6, obstacles: [{ kind: 'ring', level: 1 }], requiredLevel: 0, doubleDutch: false };
    const s0: Session = { ...base, beats: [ring], hazardTotal: 1 };
    let s = advance(s0, 0.35);
    s = tap(s).session;
    const out = swipe(s, 'up');
    expect(out.events).toEqual([{ type: 'swipe', action: 'tumble' }]);
    expect(runIdle(out.session, 1).s.hearts).toBe(MAX_HEARTS);
    // a plain jump does not clear the ring
    expect(runIdle(tap(advance(s0, 0.35)).session, 1).s.hearts).toBe(MAX_HEARTS - 1);
  });

  it('a side hop moves out of a ball lane; staying put is a hit', () => {
    const base = createSession('stage', longStage);
    const ball: Beat = { id: 0, time: 0.6, obstacles: [{ kind: 'ball', level: 1, lane: 0 }], requiredLevel: 0, doubleDutch: false };
    const s0: Session = { ...base, beats: [ball], hazardTotal: 1 };
    const hopped = swipe(tap(advance(s0, 0.4)).session, 'right').session;
    expect(hopped.player.lane).toBe(1);
    expect(runIdle(hopped, 1).s.hearts).toBe(MAX_HEARTS);
    expect(runIdle(tap(advance(s0, 0.4)).session, 1).s.hearts).toBe(MAX_HEARTS - 1);
  });

  it('solo: a cross rope needs an air swipe, a back rope needs 뒤로넘기', () => {
    const base = createSession('stage', soloStage);
    const crossS: Session = { ...base, beats: [ropeBeat(0, 0.6, 1, { cross: true })], hazardTotal: 1 };
    let c = tap(advance(crossS, 0.4)).session;
    c = advance(c, 0.06);
    c = swipe(tap(c).session, 'left').session;
    expect(c.player.cross).toBe(true);
    expect(runIdle(c, 1).s.hearts).toBe(MAX_HEARTS);

    const backS: Session = { ...base, beats: [ropeBeat(0, 0.6, 1, { back: true })], hazardTotal: 1 };
    const forward = tap(advance(backS, 0.4)).session;
    expect(runIdle(forward, 1).s.hearts).toBe(MAX_HEARTS - 1);
    const reversed = swipe(tap(advance(backS, 0.4)).session, 'down').session;
    expect(reversed.player.backward).toBe(true);
    expect(runIdle(reversed, 1).s.hearts).toBe(MAX_HEARTS);
  });

  it('뒤로넘기 resets when an endless chunk switches rope mode', () => {
    const base = createSession('endless', null, { seed: 5 });
    const s0: Session = {
      ...base,
      ropeMode: 'solo',
      player: { ...base.player, backward: true },
      tempoQueue: [{ at: 0.05, bpm: base.bpm, world: base.world, variant: base.variant, ropeMode: 'long' }],
    };
    const s = advance(s0, 0.1);
    expect(s.ropeMode).toBe('long');
    expect(s.player.backward).toBe(false);
  });

  it('a swipe made during a buffered tap is applied to the auto-jump on landing', () => {
    const base = createSession('stage', longStage);
    const s0: Session = {
      ...base,
      beats: [],
      hazardTotal: 0,
      player: { ...base.player, grounded: false, height: 4, vy: -300, level: 1, airTime: 0.4, buffer: 0.1, pendingSwipe: 'right' },
    };
    const out = step(s0, 0.05);
    expect(out.session.player.lane).toBe(1);
    expect(out.session.player.pendingSwipe).toBeNull();
    expect(out.events).toContainEqual({ type: 'swipe', action: 'side' });
  });

  it('slow-mo pickup scales stage time', () => {
    const base = createSession('stage', STAGES[0]);
    const s = step({ ...base, slowTime: 2 }, 0.1).session;
    expect(s.time).toBeCloseTo(0.07, 5);
  });

  it('tap after the run ends is ignored', () => {
    const { s } = runIdle(createSession('stage', STAGES[0]), 120);
    expect(tap(s).events).toHaveLength(0);
    expect(advance(s, 0.1)).toBe(s);
  });
});

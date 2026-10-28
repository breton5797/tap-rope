import { describe, expect, it } from 'vitest';
import type { Beat, LaneDir, LaneId, MoveId, Obstacle, Swipe } from '../../src/types';
import { LANE_HAZARD_KINDS, WARN_LEAD } from '../../src/types';
import { STAGES } from '../../src/core/content';
import { endlessStage } from '../../src/core/levels';
import { beatShape, gapAfter } from '../../src/core/spacing';
import {
  createSession, lane, MAX_HEARTS, sessionProgress, sessionStars, slide, step, swipe, tap,
  type GameEvent, type Session,
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
      if (e.type === 'move' && e.action !== 'none') performed.add(e.action);
      if (e.type === 'tap' && e.action === 'boost') performed.add(`level${e.level}`);
      if (e.type === 'lane' && e.action === 'lane') performed.add('lane');
    }
  };
  const doLane = (dir: LaneDir): void => {
    const moved = lane(s, dir);
    note(moved.events);
    s = moved.session;
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
    if (a?.lane) {
      doLane(a.lane); // left thumb: no tap
    } else if (a) {
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
  slide: 'slide', high: 'slide', double: 'level2', triple: 'level3',
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

const beatOf = (id: number, time: number, obstacles: Obstacle[]): Beat => {
  const jumps = obstacles.filter((o) => o.kind === 'floor' || o.kind === 'beam').map((o) => o.level);
  const requiredLevel = (jumps.length ? Math.max(...jumps) : 0) as Beat['requiredLevel'];
  const needsSlide = obstacles.some((o) => o.kind === 'high' || o.kind === 'ceiling');
  const blockedLanes = [...new Set(obstacles.filter((o) => LANE_HAZARD_KINDS.includes(o.kind)).flatMap((o) => o.lanes ?? []))]
    .sort() as LaneId[];
  return { id, time, obstacles, requiredLevel, needsSlide, pulse: false, blockedLanes, section: 0 };
};
const guardBeat = (id: number, time: number, lanes: LaneId[]): Beat => beatOf(id, time, [{ kind: 'guard', level: 1, lanes }]);
const floorBeat = (id: number, time: number): Beat => beatOf(id, time, [{ kind: 'floor', level: 1 }]);
const beamBeat = (id: number, time: number, level: 1 | 2 | 3): Beat =>
  beatOf(id, time, [{ kind: 'beam', level, from: 'front' }]);
const ceilingBeat = (id: number, time: number): Beat => beatOf(id, time, [{ kind: 'ceiling', level: 1 }]);

/** a session holding just the given beats */
const withBeats = (beats: Beat[]): Session => ({
  ...createSession('stage', STAGES[0]), beats, hazardTotal: beats.length, doors: [], tempoQueue: [],
});

describe('bot clears every stage (all generated content is beatable)', () => {
  for (const stage of STAGES) {
    it(`${stage.id} ${stage.name}`, () => {
      const { s: end, performed } = playBot(createSession('stage', stage), 400);
      for (const move of stage.moves) {
        const proof = MOVE_PROOF[move];
        if (proof) expect(performed, `${stage.id} should require ${move}`).toContain(proof);
      }
      expect(end.status).toBe('cleared');
      expect(end.hitsTaken).toBe(0);
      // v8: the autoplay (attract demo, e2e) still plays every beat PERFECT under the tiered judging
      expect({ greats: end.score.greats, goods: end.score.goods }).toEqual({ greats: 0, goods: 0 });
      expect(sessionStars(end)).toBe(3);
      expect(sessionProgress(end)).toBe(1);
    });
  }

  it('stages with lane hazards make the bot really change lanes', () => {
    const laneStages = STAGES.filter((st) => st.moves.some((m) => m === 'lane' || m === 'drop' || m === 'chaser'));
    expect(laneStages.length).toBeGreaterThan(50);
    const moved = laneStages.filter((st) => playBot(createSession('stage', st), 400).performed.has('lane'));
    expect(moved.length).toBe(laneStages.length);
  });

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

  it('v8 late endless (past chunk 15: up to 160 bpm, mirror / dense chunks) stays beatable, all PERFECT', () => {
    const end = runBot(createSession('endless', null, { seed: 2024 }), 720);
    expect(end.status).toBe('playing');
    expect(end.endlessChunk).toBeGreaterThan(30);
    expect(end.bpm).toBeGreaterThanOrEqual(155);
    expect(end.hitsTaken).toBe(0);
    expect(end.score.greats + end.score.goods + end.score.misses).toBe(0);
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
    const active = endlessStage(end.endlessChunk - end.tempoQueue.length, 11);
    expect(end.bpm).toBe(active.bpm);
    expect(end.world).toBe(active.world);
    expect(end.variant).toBe(active.variant);
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
    const s0: Session = { ...withBeats([floorBeat(0, 0.5), floorBeat(1, 3)]), shield: true };
    const out = runIdle(s0, 1);
    expect(out.s.hearts).toBe(MAX_HEARTS);
    expect(out.s.shield).toBe(false);
    expect(out.hits).toBe(1);
  });

  it('invulnerability ignores a second hit right after the first', () => {
    const out = runIdle(withBeats([floorBeat(0, 0.5), floorBeat(1, 0.9)]), 1.2);
    expect(out.s.hearts).toBe(MAX_HEARTS - 1);
  });

  it('a single jump does not clear a 2-beam stack; a boosted jump does', () => {
    const s0 = withBeats([beamBeat(0, 0.5, 2)]);
    const single = tap(advance(s0, 0.3)).session;
    expect(runIdle(single, 1).s.hearts).toBe(MAX_HEARTS - 1);
    let dbl = tap(advance(s0, 0.3)).session;
    dbl = tap(advance(dbl, 0.08)).session;
    expect(dbl.player.level).toBe(2);
    expect(runIdle(dbl, 1).s.hearts).toBe(MAX_HEARTS);
  });

  it('tap + ↓ turns the fresh jump into a slide that clears a ceiling laser; standing is a hit', () => {
    const s0 = withBeats([ceilingBeat(0, 0.6)]);
    const tapped = tap(advance(s0, 0.35)).session;
    const out = swipe(tapped, 'down');
    expect(out.events).toEqual([{ type: 'move', action: 'slide' }]);
    expect(out.session.player.sliding).toBe(true);
    expect(out.session.player.grounded).toBe(true);
    expect(runIdle(out.session, 1).s.hearts).toBe(MAX_HEARTS);
    expect(runIdle(advance(s0, 0.35), 1).s.hearts).toBe(MAX_HEARTS - 1);
  });

  it('sliding into a floor laser is a hit (it must be jumped)', () => {
    const slid = slide(advance(withBeats([floorBeat(0, 0.6)]), 0.4)).session;
    expect(slid.player.sliding).toBe(true);
    expect(runIdle(slid, 1).s.hearts).toBe(MAX_HEARTS - 1);
  });

  it('an airborne ↓ dives and slides on landing in time for a ceiling laser', () => {
    let s = tap(advance(withBeats([ceilingBeat(0, 0.75)]), 0.3)).session;
    s = advance(s, 0.12); // mid-air: the slide key dives, and the slide starts on landing
    const dived = slide(s);
    expect(dived.events).toEqual([{ type: 'move', action: 'dive' }]);
    expect(dived.session.player.pendingSlide).toBe(true);
    expect(runIdle(dived.session, 1).s.hearts).toBe(MAX_HEARTS);
  });

  it('a tap during a slide cancels it into a jump', () => {
    const slid = slide(advance(withBeats([floorBeat(0, 3)]), 0.1)).session;
    const jumped = tap(slid).session;
    expect(jumped.player.sliding).toBe(false);
    expect(jumped.player.grounded).toBe(false);
  });

  it('a drone punishes a 2-level jump; a laser gate (floor + drone) needs exactly one jump', () => {
    const drone = withBeats([beatOf(0, 0.6, [{ kind: 'drone', level: 1 }])]);
    let high = tap(advance(drone, 0.4)).session;
    high = tap(advance(high, 0.05)).session;
    expect(runIdle(high, 1).s.hearts).toBe(MAX_HEARTS - 1);
    expect(runIdle(drone, 1).s.hearts).toBe(MAX_HEARTS);

    const gate = withBeats([beatOf(0, 0.6, [{ kind: 'floor', level: 1 }, { kind: 'drone', level: 1 }])]);
    expect(runIdle(tap(advance(gate, 0.4)).session, 1).s.hearts).toBe(MAX_HEARTS);
    expect(runIdle(gate, 1).s.hearts).toBe(MAX_HEARTS - 1);
  });

  it('pressing ↓ again while sliding restarts the slide (back-to-back slide beats)', () => {
    let s = slide(advance(withBeats([ceilingBeat(0, 0.3), ceilingBeat(1, 0.9)]), 0.1)).session;
    s = advance(s, 0.45); // first slide nearly over
    const again = slide(s);
    expect(again.events).toEqual([{ type: 'move', action: 'slide' }]);
    expect(again.session.player.slideTime).toBeCloseTo(again.session.cfg.slideTime, 6);
    expect(runIdle(again.session, 1).s.hearts).toBe(MAX_HEARTS);
  });

  it('a tap while sliding keeps the slide when a slide laser is about to arrive', () => {
    let s = slide(advance(withBeats([ceilingBeat(0, 0.5)]), 0.2)).session;
    s = advance(s, 0.2); // 0.1s before the ceiling laser
    const tapped = tap(s);
    expect(tapped.events).toEqual([{ type: 'tap', action: 'none', level: 0, keptSlide: true }]);
    expect(tapped.session.player.sliding).toBe(true);
    expect(runIdle(tapped.session, 0.5).s.hearts).toBe(MAX_HEARTS);
    // with no slide laser close, the same tap cancels the slide into a jump
    const free = tap(slide(advance(withBeats([floorBeat(0, 3)]), 0.2)).session);
    expect(free.session.player.sliding).toBe(false);
  });

  it('endless chunk joins respect the spacing after the previous chunk\'s last beat', () => {
    const base = createSession('endless', null, { seed: 3 });
    const s0: Session = { ...base, beats: [beamBeat(0, 1, 3)], time: 0.5, cursor: 0 };
    const s = step(s0, DT).session;
    expect(s.beats.length).toBeGreaterThan(1);
    expect(s.beats[1].time - 1).toBeGreaterThanOrEqual(gapAfter(beatShape(s0.beats[0]), s0.cfg) - 1e-9);
  });

  it('slow-mo pickup scales stage time', () => {
    const base = createSession('stage', STAGES[0]);
    const s = step({ ...base, slowTime: 2 }, 0.1).session;
    expect(s.time + s.lag).toBeCloseTo(0.07, 5); // v7: time stops on a boundary, the rest carries over
  });

  it('lane(): moves one lane per swipe, bumps at the edges, works in the air', () => {
    const s0 = withBeats([floorBeat(0, 3)]);
    expect(s0.player.lane).toBe(1);
    const up = lane(s0, -1);
    expect(up.events).toEqual([{ type: 'lane', action: 'lane', lane: 0 }]);
    expect(lane(up.session, -1).events).toEqual([{ type: 'lane', action: 'none', lane: 0 }]);
    const air = lane(tap(s0).session, 1);
    expect(air.session.player.lane).toBe(2);
    expect(air.session.player.grounded).toBe(false);
  });

  it('a guard in your lane is a hit; jumping does not help; another lane is safe', () => {
    const s0 = withBeats([guardBeat(0, 0.6, [1, 2])]);
    expect(runIdle(s0, 1).s.hearts).toBe(MAX_HEARTS - 1);
    expect(runIdle(tap(advance(s0, 0.4)).session, 1).s.hearts).toBe(MAX_HEARTS - 1);
    expect(runIdle(lane(advance(s0, 0.3), -1).session, 1).s.hearts).toBe(MAX_HEARTS);
  });

  it('a sudden attack fires one "!" alert WARN_LEAD before it arrives', () => {
    const s0 = withBeats([beatOf(0, 2, [{ kind: 'drop', level: 1, lanes: [1] }]), floorBeat(1, 4)]);
    const alerts: number[] = [];
    let s = s0;
    for (let t = 0; t < 2.5; t += DT) {
      const out = step(s, DT);
      for (const e of out.events) if (e.type === 'alert') alerts.push(out.session.time);
      s = out.session;
    }
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toBeGreaterThanOrEqual(2 - WARN_LEAD - 1e-9);
    expect(alerts[0]).toBeLessThan(2 - WARN_LEAD + 2 * DT);
  });

  it('section doors: the scene switches at each door time and the door opens 1s before', () => {
    const stage = STAGES.find((st) => st.kind === 'boss')!;
    const s0 = createSession('stage', stage);
    expect(s0.doors).toHaveLength(stage.sections - 1);
    const d = s0.doors[0];
    let s = s0;
    let opened = -1;
    while (s.time < d.time + 0.1 && s.status === 'playing') {
      const out = step({ ...s, invulnTime: 99, hearts: 3 }, DT);
      if (out.events.some((e) => e.type === 'door')) opened = out.session.time;
      s = out.session;
    }
    expect(opened).toBeGreaterThanOrEqual(d.time - 1 - 1e-9);
    expect(opened).toBeLessThan(d.time - 1 + 2 * DT);
    expect({ world: s.world, variant: s.variant }).toEqual(d.to);
    expect(s.section).toBe(1);
  });

  it('tap, swipe and slide after the run ends are ignored', () => {
    const { s } = runIdle(createSession('stage', STAGES[0]), 120);
    expect(tap(s).events).toHaveLength(0);
    expect(swipe(s, 'down').events).toHaveLength(0);
    expect(slide(s).events).toHaveLength(0);
    expect(lane(s, 1).events).toHaveLength(0);
    expect(advance(s, 0.1)).toBe(s);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { AudioApi, Beat, EffectsApi, JudgeResult, Obstacle } from '../../src/types';
import { SCROLL_SPEED } from '../../src/types';
import { CHAPTERS, STAGES } from '../../src/core/content';
import { createSession, type GameEvent, type Session } from '../../src/game/session';
import { hintForBeat, introducedMoves, upcomingHint } from '../../src/game/hints';
import { playFeedback } from '../../src/game/feedback';
import { hasEscort, toHud, toSnapshot } from '../../src/game/snapshot';

const beat = (time: number, obstacles: Obstacle[]): Beat => {
  const jumps = obstacles.filter((o) => o.kind === 'floor' || o.kind === 'beam').map((o) => o.level);
  return {
    id: 0, time, obstacles,
    requiredLevel: (jumps.length ? Math.max(...jumps) : 0) as Beat['requiredLevel'],
    needsSlide: obstacles.some((o) => o.kind === 'high' || o.kind === 'ceiling'),
    pulse: false,
    blockedLanes: [...new Set(obstacles.flatMap((o) => (o.kind === 'guard' || o.kind === 'drop' || o.kind === 'chaser' ? o.lanes ?? [] : [])))].sort(),
    section: 0,
  };
};

function mocks() {
  const fx: EffectsApi = { burst: vi.fn(), popup: vi.fn(), shake: vi.fn(), flash: vi.fn(), update: vi.fn() };
  const audio: AudioApi = {
    unlock: vi.fn(), setEnabled: vi.fn(), startMusic: vi.fn(), stopMusic: vi.fn(), setFever: vi.fn(), sfx: vi.fn(),
  };
  const haptics = { vibrate: vi.fn<(p: number | number[]) => void>(), setEnabled: vi.fn<(on: boolean) => void>() };
  return { fx, audio, haptics };
}

const judged = (grade: JudgeResult['grade'], reason: JudgeResult['reason'] = null): GameEvent => ({
  type: 'judge', shielded: false, result: { beatId: 0, grade, hit: grade === 'miss', reason, collected: [] },
});

const opts = { realTime: 12, reducedMotion: true, running: true };

describe('hints', () => {
  it('maps beats to move cards (plain floor jumps are taught at the start, not here)', () => {
    expect(hintForBeat(beat(1, [{ kind: 'drone', level: 1 }]))).toBe('drone');
    expect(hintForBeat(beat(1, [{ kind: 'beam', level: 3, from: 'front' }]))).toBe('triple');
    expect(hintForBeat(beat(1, [{ kind: 'beam', level: 2, from: 'front' }]))).toBe('double');
    expect(hintForBeat(beat(1, [{ kind: 'ceiling', level: 1 }]))).toBe('slide');
    expect(hintForBeat(beat(1, [{ kind: 'high', level: 1, from: 'front' }]))).toBe('high');
    expect(hintForBeat(beat(1, [{ kind: 'floor', level: 1 }, { kind: 'drone', level: 1 }]))).toBe('gate');
    expect(hintForBeat(beat(1, [{ kind: 'floor', level: 1 }]))).toBeNull();
  });

  it('finds the next unseen hint inside the lookahead only', () => {
    const base = createSession('stage', STAGES[0]);
    const s: Session = {
      ...base,
      beats: [
        beat(1, [{ kind: 'beam', level: 2, from: 'front' }]),
        beat(1.5, [{ kind: 'drone', level: 1 }]),
        beat(9, [{ kind: 'beam', level: 3, from: 'front' }]),
      ],
    };
    const any = new Set(['double', 'drone'] as const);
    expect(upcomingHint(s, new Set(), any)).toBe('double');
    expect(upcomingHint(s, new Set(['double'] as const), any)).toBe('drone');
    expect(upcomingHint(s, new Set(['double', 'drone'] as const), any)).toBeNull();
  });
});

describe('intro-only hints', () => {
  it('a stage only teaches the moves it introduces (GDD-v4 §5 schedule)', () => {
    const stage = (n: number) => STAGES[n - 1];
    expect(introducedMoves(stage(1))).toContain('jump');
    expect(introducedMoves(stage(4))).toEqual(['double']);
    expect(introducedMoves(stage(6))).toEqual(['slide']);
    expect(introducedMoves(stage(8))).toEqual(['drone']);
    expect(introducedMoves(stage(100))).toEqual([]);
    const all = new Set(STAGES.flatMap((st) => introducedMoves(st)));
    expect(all.size).toBe(new Set(STAGES.flatMap((st) => st.moves)).size);
  });

  it('upcomingHint ignores moves outside the allowed set', () => {
    const base = createSession('stage', STAGES[0]);
    const s: Session = { ...base, beats: [beat(1, [{ kind: 'beam', level: 3, from: 'front' }])] };
    expect(upcomingHint(s, new Set(), new Set(['triple'] as const))).toBe('triple');
    expect(upcomingHint(s, new Set(), new Set())).toBeNull();
  });
});

describe('feedback', () => {
  it('quiet mode only emits dust', () => {
    const d = mocks();
    playFeedback(d, [{ type: 'land' }, judged('perfect'), { type: 'fever' }], true);
    expect(d.fx.burst).toHaveBeenCalledWith('dust');
    expect(d.fx.popup).not.toHaveBeenCalled();
    expect(d.audio.sfx).not.toHaveBeenCalled();
  });

  it('plays grade popups and miss reasons', () => {
    const d = mocks();
    playFeedback(d, [
      judged('perfect'), judged('good'), judged('miss', 'drone'), judged('miss', 'level'), judged('none'),
      judged('miss', 'standing'), judged('miss', 'slide'),
    ]);
    expect(d.fx.popup).toHaveBeenNthCalledWith(1, 'PERFECT!', 'perfect');
    expect(d.fx.popup).toHaveBeenNthCalledWith(2, 'GOOD', 'good');
    expect(d.fx.popup).toHaveBeenNthCalledWith(3, '드론에 들켰다! 낮게!', 'miss');
    expect(d.fx.popup).toHaveBeenNthCalledWith(4, '더 높이!', 'miss');
    expect(d.fx.popup).toHaveBeenNthCalledWith(5, '슬라이딩! ↓', 'miss');
    expect(d.fx.popup).toHaveBeenNthCalledWith(6, '점프해야 해요!', 'miss');
    expect(d.fx.popup).toHaveBeenCalledTimes(6);
  });

  it('hits zap, shake and vibrate; shielded hits do not shake', () => {
    const d = mocks();
    playFeedback(d, [{ type: 'hit', shielded: true, hearts: 3 }]);
    expect(d.fx.shake).not.toHaveBeenCalled();
    playFeedback(d, [{ type: 'hit', shielded: false, hearts: 2 }]);
    expect(d.fx.shake).toHaveBeenCalledOnce();
    expect(d.audio.sfx).toHaveBeenCalledWith('zap');
    expect(d.haptics.vibrate).toHaveBeenLastCalledWith([40, 30, 70]);
  });

  it('a tap held back to keep a slide gives a light haptic cue and nothing else', () => {
    const d = mocks();
    playFeedback(d, [{ type: 'tap', action: 'none', level: 0, keptSlide: true }]);
    expect(d.haptics.vibrate).toHaveBeenCalledWith(6);
    expect(d.audio.sfx).not.toHaveBeenCalled();
  });

  it('v5 cues: lane whoosh, "!" alert, door hiss; a lane miss says which way', () => {
    const d = mocks();
    playFeedback(d, [
      { type: 'lane', action: 'lane', lane: 0 }, { type: 'lane', action: 'none', lane: 0 },
      { type: 'alert', lanes: [1] }, { type: 'door', transition: 'turn' }, judged('miss', 'lane'),
    ]);
    expect(d.audio.sfx).toHaveBeenCalledWith('lane');
    expect(d.audio.sfx).toHaveBeenCalledWith('alert');
    expect(d.audio.sfx).toHaveBeenCalledWith('door');
    expect(vi.mocked(d.audio.sfx).mock.calls.filter((c) => c[0] === 'lane')).toHaveLength(1);
    expect(d.fx.popup).toHaveBeenCalledWith('레인을 바꿔! ↑↓', 'miss');
    expect(d.fx.shake).toHaveBeenCalledWith(0.12); // the edge-lane bump
  });

  it('taps, moves, pickups, fever, combo and end events', () => {
    const d = mocks();
    playFeedback(d, [
      { type: 'tap', action: 'jump', level: 1 }, { type: 'tap', action: 'boost', level: 2 },
      { type: 'tap', action: 'buffered', level: 0 },
      { type: 'pickup', kind: 'coin' }, { type: 'pickup', kind: 'shield' },
      { type: 'move', action: 'slide' }, { type: 'move', action: 'dive' }, { type: 'move', action: 'none' },
      { type: 'fever' }, { type: 'combo', combo: 20 }, { type: 'end', cleared: true }, { type: 'end', cleared: false },
    ]);
    expect(d.audio.sfx).toHaveBeenCalledWith('jump', 1);
    expect(d.audio.sfx).toHaveBeenCalledWith('boost', 2);
    expect(d.audio.sfx).toHaveBeenCalledWith('coin');
    expect(d.audio.sfx).toHaveBeenCalledWith('slide');
    expect(d.fx.popup).toHaveBeenCalledWith('실드 장착!', 'info');
    expect(d.audio.setFever).toHaveBeenCalledWith(true);
    expect(d.fx.popup).toHaveBeenCalledWith('20 COMBO!', 'combo');
    expect(d.audio.sfx).toHaveBeenCalledWith('clear');
    expect(d.audio.sfx).toHaveBeenCalledWith('fail');
  });
});

describe('snapshot / hud', () => {
  it('maps a fresh session', () => {
    const s = createSession('stage', STAGES[0]);
    const snap = toSnapshot(s, 'cat', opts);
    expect(snap.skin).toBe('cat');
    expect(snap.reducedMotion).toBe(true);
    expect(snap.running).toBe(true);
    expect(snap.world).toBe(CHAPTERS[0].theme);
    expect(snap.scroll).toBe(0);
    expect(snap.escort).toBe(false);
    const hud = toHud(s);
    expect(hud.hearts).toBe(3);
    expect(hud.title).toBe(`1-1 · ${STAGES[0].name}`);
    expect(hud.progress).toBe(0);
    expect(hud.sliding).toBe(false);
    expect(hud.section).toBe(0);
    expect(hud.sections).toBe(STAGES[0].sections);
    expect(snap.player.lane).toBe(1);
  });

  it('shows doors near the agent and the section count advances past them', () => {
    const stage = STAGES.find((st) => st.sections === 3)!;
    const s = createSession('stage', stage);
    const d = s.doors[0];
    const near = toSnapshot({ ...s, time: d.time - 2 }, 'kid', opts);
    expect(near.doors).toHaveLength(1);
    expect(near.doors[0].timeUntil).toBeCloseTo(2, 6);
    expect(near.doors[0].to).toEqual(d.to);
    expect(toSnapshot({ ...s, time: d.time - 5 }, 'kid', opts).doors).toHaveLength(0);
    expect(toHud({ ...s, section: 1 }).section).toBe(1);
    expect(toHud(createSession('endless', null, { seed: 3 })).sections).toBe(1);
  });

  it('scroll follows stage time; escort only in part 2 (escape) zones', () => {
    const s = { ...createSession('stage', STAGES[0]), time: 2 };
    expect(toSnapshot(s, 'kid', opts).scroll).toBe(2 * SCROLL_SPEED);
    for (const stage of STAGES) {
      expect(hasEscort(createSession('stage', stage)), stage.id).toBe(CHAPTERS[stage.chapter].part === 2);
    }
    expect(hasEscort(createSession('endless', null, { seed: 3 }))).toBe(false);
  });

  it('titles endless and daily modes and shows full gauge in fever', () => {
    const e = createSession('endless', null, { seed: 3 });
    expect(toHud(e).title).toBe('무한 탈출');
    expect(toHud(e).progress).toBe(0);
    const d = createSession('daily', null, { date: '2026-10-23' });
    expect(toHud(d).title).toBe('오늘의 작전');
    const fever: Session = { ...d, score: { ...d.score, feverTime: 3, feverGauge: 0 } };
    expect(toHud(fever).feverGauge).toBe(1);
    expect(toSnapshot(fever, 'kid', opts).fever).toBe(true);
  });
});

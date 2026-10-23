import { describe, expect, it, vi } from 'vitest';
import type { AudioApi, Beat, EffectsApi, JudgeResult } from '../../src/types';
import { STAGES } from '../../src/core/content';
import { createSession, type GameEvent, type Session } from '../../src/game/session';
import { hintForBeat, introducedMoves, upcomingHint } from '../../src/game/hints';
import { playFeedback } from '../../src/game/feedback';
import { toHud, toSnapshot } from '../../src/game/snapshot';

const beat = (time: number, obstacles: Beat['obstacles'], requiredLevel: Beat['requiredLevel']): Beat => ({
  id: 0, time, obstacles, requiredLevel, doubleDutch: false,
});

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

describe('hints', () => {
  it('maps beats to move cards', () => {
    expect(hintForBeat(beat(1, [{ kind: 'bird', level: 1 }], 0))).toBe('bird');
    expect(hintForBeat(beat(1, [{ kind: 'rope', level: 3 }], 3))).toBe('triple');
    expect(hintForBeat(beat(1, [{ kind: 'hurdle', level: 2 }], 2))).toBe('double');
    expect(hintForBeat(beat(1, [{ kind: 'ring', level: 1 }], 0))).toBe('tumble');
    expect(hintForBeat(beat(1, [{ kind: 'ball', level: 1, lane: 1 }], 0))).toBe('side');
    expect(hintForBeat(beat(1, [{ kind: 'rope', level: 1, cross: true }], 1))).toBe('cross');
    expect(hintForBeat(beat(1, [{ kind: 'rope', level: 1, back: true }], 1))).toBe('back');
    expect(hintForBeat(beat(1, [{ kind: 'rope', level: 1 }], 1))).toBeNull();
  });

  it('finds the next unseen hint inside the lookahead only', () => {
    const base = createSession('stage', STAGES[0]);
    const s: Session = { ...base, beats: [beat(1, [{ kind: 'rope', level: 2 }], 2), beat(1.5, [{ kind: 'bird', level: 1 }], 0), beat(9, [{ kind: 'rope', level: 3 }], 3)] };
    const any = new Set(['double', 'bird'] as const);
    expect(upcomingHint(s, new Set(), any)).toBe('double');
    expect(upcomingHint(s, new Set(['double'] as const), any)).toBe('bird');
    expect(upcomingHint(s, new Set(['double', 'bird'] as const), any)).toBeNull();
  });
});

describe('intro-only hints', () => {
  it('a stage only teaches the moves it introduces', () => {
    const stage = (n: number) => STAGES[n - 1];
    expect(introducedMoves(stage(1))).toContain('jump');
    expect(introducedMoves(stage(4))).toEqual(['double']);
    expect(introducedMoves(stage(11))).toContain('tumble');
    expect(introducedMoves(stage(100))).toEqual([]);
    const all = new Set(STAGES.flatMap((st) => introducedMoves(st)));
    expect(all.size).toBe(new Set(STAGES.flatMap((st) => st.moves)).size);
  });

  it('upcomingHint ignores moves outside the allowed set', () => {
    const base = createSession('stage', STAGES[0]);
    const s: Session = { ...base, beats: [beat(1, [{ kind: 'rope', level: 3 }], 3)] };
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
    playFeedback(d, [judged('perfect'), judged('good'), judged('miss', 'bird'), judged('miss', 'level'), judged('none'), judged('miss', 'ball')]);
    expect(d.fx.popup).toHaveBeenNthCalledWith(1, 'PERFECT!', 'perfect');
    expect(d.fx.popup).toHaveBeenNthCalledWith(2, 'GOOD', 'good');
    expect(d.fx.popup).toHaveBeenNthCalledWith(3, '너무 높아요!', 'miss');
    expect(d.fx.popup).toHaveBeenNthCalledWith(4, '더 높이!', 'miss');
    expect(d.fx.popup).toHaveBeenNthCalledWith(5, '공을 피해요!', 'miss');
    expect(d.fx.popup).toHaveBeenCalledTimes(5);
  });

  it('hits shake + vibrate, shielded hits do not shake', () => {
    const d = mocks();
    playFeedback(d, [{ type: 'hit', shielded: true, hearts: 3 }]);
    expect(d.fx.shake).not.toHaveBeenCalled();
    playFeedback(d, [{ type: 'hit', shielded: false, hearts: 2 }]);
    expect(d.fx.shake).toHaveBeenCalledOnce();
    expect(d.haptics.vibrate).toHaveBeenLastCalledWith([40, 30, 70]);
  });

  it('taps, pickups, fever, combo and end events', () => {
    const d = mocks();
    playFeedback(d, [
      { type: 'tap', action: 'jump', level: 1 }, { type: 'tap', action: 'boost', level: 2 },
      { type: 'tap', action: 'buffered', level: 0 },
      { type: 'pickup', kind: 'coin' }, { type: 'pickup', kind: 'shield' },
      { type: 'swipe', action: 'tumble' }, { type: 'swipe', action: 'reverse' }, { type: 'swipe', action: 'none' },
      { type: 'fever' }, { type: 'combo', combo: 20 }, { type: 'end', cleared: true }, { type: 'end', cleared: false },
    ]);
    expect(d.audio.sfx).toHaveBeenCalledWith('jump', 1);
    expect(d.audio.sfx).toHaveBeenCalledWith('boost', 2);
    expect(d.audio.sfx).toHaveBeenCalledWith('coin');
    expect(d.audio.sfx).toHaveBeenCalledWith('tumble');
    expect(d.audio.sfx).toHaveBeenCalledWith('reverse');
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
    const snap = toSnapshot(s, 'cat', 12, true);
    expect(snap.skin).toBe('cat');
    expect(snap.reducedMotion).toBe(true);
    expect(snap.world).toBe(0);
    const hud = toHud(s);
    expect(hud.hearts).toBe(3);
    expect(hud.title).toBe(`1-1 · ${STAGES[0].name}`);
    expect(hud.progress).toBe(0);
  });

  it('titles endless and daily modes and shows full gauge in fever', () => {
    const e = createSession('endless', null, { seed: 3 });
    expect(toHud(e).title).toBe('엔드리스');
    expect(toHud(e).progress).toBe(0);
    const d = createSession('daily', null, { date: '2026-10-23' });
    expect(toHud(d).title).toBe('오늘의 도전');
    const fever: Session = { ...d, score: { ...d.score, feverTime: 3, feverGauge: 0 } };
    expect(toHud(fever).feverGauge).toBe(1);
    expect(toSnapshot(fever, 'kid', 0, false).fever).toBe(true);
  });
});

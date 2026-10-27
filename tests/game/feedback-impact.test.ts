import { describe, expect, it, vi } from 'vitest';
import type { AudioApi, Beat, EffectsApi, JudgeResult, Obstacle } from '../../src/types';
import { playFeedback, type FeedbackView, type TimeApi } from '../../src/game/feedback';
import type { GameEvent } from '../../src/game/session';

const beat = (id: number, obstacles: Obstacle[], requiredLevel: Beat['requiredLevel'] = 0): Beat => ({
  id, time: id, obstacles, requiredLevel, needsSlide: false, pulse: false, blockedLanes: [], section: 0,
});

function setup(beats: Beat[] = [], boss = false) {
  const fx: EffectsApi = { burst: vi.fn(), popup: vi.fn(), shake: vi.fn(), flash: vi.fn(), impact: vi.fn(), update: vi.fn() };
  const audio: AudioApi = {
    unlock: vi.fn(), setEnabled: vi.fn(), startMusic: vi.fn(), stopMusic: vi.fn(), setFever: vi.fn(), sfx: vi.fn(),
  };
  const haptics = { vibrate: vi.fn<(p: number | number[]) => void>(), setEnabled: vi.fn<(on: boolean) => void>() };
  const time: TimeApi = { hitStop: vi.fn(), slowMo: vi.fn() };
  const view: { -readonly [K in keyof FeedbackView]: FeedbackView[K] } = {
    beats, time: 10, stage: { kind: boss ? 'boss' : 'normal' }, player: { lane: 1, laneFrom: 1 },
  };
  return { fx, audio, haptics, time, view, deps: { fx, audio, haptics, time, view: () => view } };
}

const judged = (beatId: number, grade: JudgeResult['grade']): GameEvent =>
  ({ type: 'judge', result: { beatId, grade, hit: false, reason: null, collected: [] }, shielded: false });

describe('feedback → impacts (v7.1)', () => {
  it('jump, boost and the landing carry the jump level', () => {
    const s = setup();
    playFeedback(s.deps, [
      { type: 'tap', action: 'jump', level: 1 },
      { type: 'tap', action: 'boost', level: 2 },
      { type: 'land' },
    ]);
    expect(s.fx.impact).toHaveBeenNthCalledWith(1, 'jump', { level: 1 });
    expect(s.fx.impact).toHaveBeenNthCalledWith(2, 'boost', { level: 2 });
    expect(s.fx.impact).toHaveBeenNthCalledWith(3, 'land', { level: 2 });
    expect(s.audio.sfx).toHaveBeenCalledWith('land', 2);
    // the next landing without a jump in between is a plain one
    playFeedback(s.deps, [{ type: 'land' }]);
    expect(s.fx.impact).toHaveBeenLastCalledWith('land', { level: 1 });
  });

  it('slides cue the rig', () => {
    const s = setup();
    playFeedback(s.deps, [{ type: 'move', action: 'slide' }]);
    expect(s.fx.impact).toHaveBeenCalledWith('slide', {});
  });

  it('lane moves lean the way they go and pan the whoosh; the edge lane bumps', () => {
    const s = setup();
    s.view.player = { lane: 2, laneFrom: 1 };
    playFeedback(s.deps, [{ type: 'lane', action: 'lane', lane: 2 }]);
    expect(s.fx.impact).toHaveBeenCalledWith('lane', { dir: 1 });
    expect(s.audio.sfx).toHaveBeenCalledWith('lane', 1, 0.6);
    s.view.player = { lane: 0, laneFrom: 0 };
    playFeedback(s.deps, [{ type: 'lane', action: 'none', lane: 0 }]);
    expect(s.fx.impact).toHaveBeenLastCalledWith('bump', { dir: -1 });
    expect(s.audio.sfx).toHaveBeenLastCalledWith('bump', 1, -0.6);
  });

  it('a perfect pass grazes the obstacle where it was; a good one just passes', () => {
    const s = setup([beat(0, [{ kind: 'beam', level: 2 }], 2), beat(1, [{ kind: 'ceiling', level: 1 }]), beat(2, [{ kind: 'guard', level: 1, lanes: [0] }])]);
    playFeedback(s.deps, [judged(0, 'perfect'), judged(1, 'good'), judged(2, 'perfect')]);
    expect(s.fx.impact).toHaveBeenNthCalledWith(1, 'graze', { zone: 'low', level: 2 });
    expect(s.fx.impact).toHaveBeenNthCalledWith(2, 'pass', { zone: 'high', level: 0 });
    expect(s.fx.impact).toHaveBeenNthCalledWith(3, 'graze', { zone: 'side', level: 0 });
    expect(s.audio.sfx).toHaveBeenCalledWith('graze', 2);
  });

  it('pickups and unknown beats pass no zone', () => {
    const s = setup([beat(0, [{ kind: 'coin', level: 1 }])]);
    playFeedback(s.deps, [judged(0, 'good'), judged(9, 'perfect')]);
    expect(s.fx.impact).not.toHaveBeenCalled();
  });

  it('a real hit stops time briefly; a shielded one shatters the shield instead', () => {
    const s = setup();
    playFeedback(s.deps, [{ type: 'hit', shielded: false, hearts: 2 }]);
    expect(s.fx.impact).toHaveBeenCalledWith('hit', {});
    expect(s.time.hitStop).toHaveBeenCalledWith(0.07);
    playFeedback(s.deps, [{ type: 'hit', shielded: true, hearts: 2 }]);
    expect(s.fx.impact).toHaveBeenLastCalledWith('shield', {});
    expect(s.audio.sfx).toHaveBeenLastCalledWith('shield');
    expect(s.time.hitStop).toHaveBeenCalledOnce();
  });

  it('slow motion on a perfect triple jump, at most once per cooldown', () => {
    const s = setup([beat(0, [{ kind: 'beam', level: 3 }], 3), beat(1, [{ kind: 'beam', level: 3 }], 3)]);
    playFeedback(s.deps, [judged(0, 'perfect')]);
    expect(s.time.slowMo).toHaveBeenCalledWith(0.2, 0.55);
    s.view.time = 11;
    playFeedback(s.deps, [judged(1, 'perfect')]);
    expect(s.time.slowMo).toHaveBeenCalledOnce();
    s.view.time = 14;
    playFeedback(s.deps, [judged(1, 'perfect')]);
    expect(s.time.slowMo).toHaveBeenCalledTimes(2);
  });

  it('slow motion on a perfect dodge of a boss lane or overhead attack, not on a plain jump', () => {
    const s = setup([beat(0, [{ kind: 'floor', level: 1 }], 1), beat(1, [{ kind: 'drop', level: 1, lanes: [1] }])], true);
    playFeedback(s.deps, [judged(0, 'perfect')]);
    expect(s.time.slowMo).not.toHaveBeenCalled();
    playFeedback(s.deps, [judged(1, 'perfect')]);
    expect(s.time.slowMo).toHaveBeenCalledOnce();
  });

  it('attract mode shows the motion impacts without sound', () => {
    const s = setup();
    playFeedback(s.deps, [{ type: 'tap', action: 'jump', level: 1 }, { type: 'land' }, { type: 'move', action: 'slide' }], true);
    expect(s.fx.impact).toHaveBeenCalledWith('jump', { level: 1 });
    expect(s.fx.impact).toHaveBeenCalledWith('land', { level: 1 });
    expect(s.fx.impact).toHaveBeenCalledWith('slide', {});
    expect(s.fx.burst).toHaveBeenCalledWith('dust');
    expect(s.audio.sfx).not.toHaveBeenCalled();
  });
});

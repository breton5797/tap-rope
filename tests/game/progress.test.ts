import { describe, expect, it, vi } from 'vitest';
import type { AudioApi, OnlineApi, ResultInfo, RunRecord, RunSummary, SaveData, Ui } from '../../src/types';
import { defaultSave } from '../../src/core/storage';
import { createProgress } from '../../src/game/progress';

const flush = () => new Promise((r) => setTimeout(r, 0));

function harness(online: Partial<OnlineApi>, showing = true, initial: SaveData = defaultSave()) {
  let save: SaveData = initial;
  let screen = 'leaderboard';
  let resultShowing = showing;
  const ui = {
    toastAchievement: vi.fn(), showResult: vi.fn(), showLeaderboard: vi.fn(), showNickname: vi.fn(),
  } as unknown as Ui;
  const audio = { sfx: vi.fn() } as unknown as AudioApi;
  const api: OnlineApi = {
    ready: true, init: vi.fn(async () => {}), nickname: () => 'K', setNickname: vi.fn(async () => null),
    submitRun: vi.fn(async () => ({ score: 900, rank: 7 })),
    leaderboard: vi.fn(async () => ({ top: [], mine: null })), syncAchievements: vi.fn(async () => {}),
    ...online,
  };
  const p = createProgress({
    ui, audio, online: api, getSave: () => save, persist: (s) => { save = s; }, resultShowing: () => resultShowing,
    screenName: () => screen,
  });
  return {
    p, ui, audio, api, save: () => save,
    setScreen: (s: string) => { screen = s; }, setShowing: (v: boolean) => { resultShowing = v; },
  };
}

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  mode: 'daily', stageId: null, cleared: true, hitsTaken: 0, perfects: 30, goods: 0, misses: 0,
  maxCombo: 60, fevers: 1, seconds: 70, score: 900, date: '2026-10-27', ...over,
});
const record: RunRecord = { sim: 'le-v7.1', mode: 'daily', seed: 0, date: '2026-10-27', inputs: [], endTime: 70, clientScore: 900 };
const info = { mode: 'daily', score: 900 } as unknown as ResultInfo;
const lastResult = (ui: Ui) => vi.mocked(ui.showResult).mock.lastCall?.[0];

describe('progress', () => {
  it('a daily clear extends the streak, unlocks achievements as card badges (no banner), pays ₵ and goes pending → ranked', async () => {
    const h = harness({});
    const shown = h.p.afterRun(summary(), record, info);
    expect(shown.online).toEqual({ state: 'pending' });
    expect(h.save().dailyStreak).toEqual({ last: '2026-10-27', count: 1 });
    expect(shown.meta?.unlocked).toEqual(expect.arrayContaining(['daily-1', 'chain-50']));
    expect(shown.meta?.streak).toEqual({ count: 1, extended: true });
    expect(shown.meta?.rewards.map((r) => r.kind)).toEqual(['achievement', 'achievement', 'streak']);
    expect(h.save().coins).toBe(shown.meta!.rewards.reduce((n, r) => n + r.coins, 0));
    expect(h.ui.toastAchievement).not.toHaveBeenCalled();
    expect(h.audio.sfx).toHaveBeenCalledWith('achieve');
    expect(h.api.syncAchievements).toHaveBeenCalled();
    await flush();
    expect(lastResult(h.ui)).toEqual({ ...shown, online: { state: 'ranked', rank: 7 } });
  });

  it('a second daily clear on the same day does not extend or pay the streak again', () => {
    const h = harness({});
    h.p.afterRun(summary(), record, info);
    const again = h.p.afterRun(summary(), record, info);
    expect(again.meta?.streak).toEqual({ count: 1, extended: false });
    expect(again.meta?.rewards).toEqual([]);
  });

  it('first clear of a stage: +10, new stars, the first-mission bonus; `before` comes from the caller', () => {
    const before = defaultSave();
    const h = harness({}, true, { ...before, stars: { 'w1-s1': 2 } });
    const out = h.p.afterRun(summary({ mode: 'stage', stageId: 'w1-s1', maxCombo: 3, goods: 2 }), null, info, before);
    expect(out.meta?.rewards.map((r) => [r.kind, r.coins])).toEqual([['first-clear', 10], ['star', 10], ['first-mission', 60]]);
    expect(h.save().coins).toBe(80);
    expect(h.api.submitRun).not.toHaveBeenCalled();
    expect(out.online).toBeUndefined();
  });

  it('a failed run carries what hit the player', () => {
    const h = harness({});
    const out = h.p.afterRun(summary({ mode: 'stage', stageId: 'w1-s1', cleared: false, hitBy: 'slide', maxCombo: 1 }), null, info);
    expect(out.meta?.hitBy).toBe('slide');
  });

  it('offline → offline state; refused → rejected; left the result screen → no update', async () => {
    const off = harness({ submitRun: vi.fn(async () => null) });
    off.p.afterRun(summary(), record, info);
    await flush();
    expect(lastResult(off.ui)?.online).toEqual({ state: 'offline' });
    const bad = harness({ submitRun: vi.fn(async () => { throw new Error('replay mismatch'); }) });
    bad.p.afterRun(summary(), record, info);
    await flush();
    expect(lastResult(bad.ui)?.online).toEqual({ state: 'rejected' });
    const gone = harness({}, false);
    gone.p.afterRun(summary(), record, info);
    await flush();
    expect(gone.ui.showResult).not.toHaveBeenCalled();
  });

  it('a late answer for an older run is ignored once a newer run finished', async () => {
    let resolveFirst: (v: { score: number; rank: number }) => void = () => {};
    const submitRun = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockImplementation(async () => null);
    const h = harness({ submitRun });
    h.p.afterRun(summary(), record, info);
    h.p.afterRun(summary({ score: 10 }), record, { ...info, score: 10 } as ResultInfo);
    await flush();
    resolveFirst({ score: 900, rank: 1 });
    await flush();
    expect(vi.mocked(h.ui.showResult).mock.calls.map((c) => c[0].online?.state)).toEqual(['offline']);
  });

  it('ranked below #1: shows the points to the next rank when that row is loaded', async () => {
    const top = [
      { rank: 6, nickname: 'A', score: 1000, me: false },
      { rank: 7, nickname: 'K', score: 900, me: true },
    ];
    const h = harness({ leaderboard: vi.fn(async () => ({ top, mine: top[1] })) });
    h.p.afterRun(summary(), record, info);
    await flush();
    await flush();
    expect(h.api.leaderboard).toHaveBeenCalledWith('daily:2026-10-27');
    expect(lastResult(h.ui)?.online).toEqual({ state: 'ranked', rank: 7, gap: 101 });
  });

  it('challenge link: an endless run on the challenger seed reports their score', () => {
    const h = harness({});
    h.p.setChallenge({ seed: 42, vs: 5000 });
    const endless: RunRecord = { ...record, mode: 'endless', seed: 42 };
    const out = h.p.afterRun(summary({ mode: 'endless' }), endless, info);
    expect(out.meta).toMatchObject({ seed: 42, vs: 5000 });
    const other = h.p.afterRun(summary({ mode: 'endless' }), { ...endless, seed: 7 }, info);
    expect(other.meta).toMatchObject({ seed: 7, vs: null });
  });

  it('recheck shows banners (outside the result screen)', () => {
    const h = harness({}, true, { ...defaultSave(), ownedSkins: ['kid', 'cat', 'bunny', 'ninja', 'robot', 'astro'] });
    h.p.recheck();
    expect(h.ui.toastAchievement).toHaveBeenCalledWith(expect.objectContaining({ id: 'all-operators' }));
  });

  it('leaderboard: loading → data; a missing call sign is asked once AFTER the board loaded; failures show offline without asking', async () => {
    const noNick = harness({ nickname: () => null });
    noNick.p.openLeaderboard('endless');
    expect(noNick.ui.showLeaderboard).toHaveBeenCalledWith('endless', 'loading');
    expect(noNick.ui.showNickname).not.toHaveBeenCalled();
    await flush();
    expect(noNick.ui.showLeaderboard).toHaveBeenLastCalledWith('endless', { top: [], mine: null });
    expect(noNick.ui.showNickname).toHaveBeenCalledTimes(1);
    noNick.p.openLeaderboard('endless-week');
    await flush();
    expect(noNick.ui.showNickname).toHaveBeenCalledTimes(1);

    const down = harness({ nickname: () => null, leaderboard: vi.fn(async () => { throw new Error('net'); }) });
    down.p.openLeaderboard('endless-week');
    await flush();
    expect(down.ui.showLeaderboard).toHaveBeenLastCalledWith('endless-week', 'offline');
    expect(down.ui.showNickname).not.toHaveBeenCalled();
  });

  it('leaderboard: a late answer is dropped after a tab switch or leaving the screen', async () => {
    let resolve: (v: { top: []; mine: null }) => void = () => {};
    const leaderboard = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { resolve = r; }))
      .mockImplementation(async () => ({ top: [], mine: null }));
    const h = harness({ leaderboard });
    h.p.openLeaderboard('endless');
    h.p.openLeaderboard('endless-week');
    await flush();
    resolve({ top: [], mine: null });
    await flush();
    expect(vi.mocked(h.ui.showLeaderboard).mock.calls.map((c) => [c[0], typeof c[1] === 'string' ? c[1] : 'data']))
      .toEqual([['endless', 'loading'], ['endless-week', 'loading'], ['endless-week', 'data']]);
    const left = harness({});
    left.p.openLeaderboard('endless');
    left.setScreen('title');
    await flush();
    expect(left.ui.showLeaderboard).toHaveBeenCalledTimes(1);
  });
});

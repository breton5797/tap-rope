import { describe, expect, it, vi } from 'vitest';
import type { AudioApi, OnlineApi, ResultInfo, RunRecord, RunSummary, SaveData, Ui } from '../../src/types';
import { defaultSave } from '../../src/core/storage';
import { createProgress } from '../../src/game/progress';

const flush = () => new Promise((r) => setTimeout(r, 0));

function harness(online: Partial<OnlineApi>, showing = true) {
  let save: SaveData = defaultSave();
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
    ui, audio, online: api, getSave: () => save, persist: (s) => { save = s; }, resultShowing: () => showing,
  });
  return { p, ui, audio, api, save: () => save };
}

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  mode: 'daily', stageId: null, cleared: true, hitsTaken: 0, perfects: 30, goods: 0, misses: 0,
  maxCombo: 60, fevers: 1, seconds: 70, score: 900, date: '2026-10-27', ...over,
});
const record: RunRecord = { sim: 'le-v7.1', mode: 'daily', seed: 0, date: '2026-10-27', inputs: [], endTime: 70, clientScore: 900 };
const info = { mode: 'daily', score: 900 } as unknown as ResultInfo;

describe('progress', () => {
  it('a daily clear updates the streak, unlocks achievements with banners, and goes pending → ranked', async () => {
    const h = harness({});
    const shown = h.p.afterRun(summary(), record, info);
    expect(shown.online).toEqual({ state: 'pending' });
    expect(h.save().dailyStreak).toEqual({ last: '2026-10-27', count: 1 });
    expect(Object.keys(h.save().achievements)).toEqual(expect.arrayContaining(['daily-1', 'chain-50']));
    expect(h.ui.toastAchievement).toHaveBeenCalled();
    expect(h.audio.sfx).toHaveBeenCalledWith('achieve');
    expect(h.api.syncAchievements).toHaveBeenCalled();
    await flush();
    expect(h.ui.showResult).toHaveBeenLastCalledWith({ ...info, online: { state: 'ranked', rank: 7 } });
  });

  it('offline → offline state; refused → rejected; left the result screen → no update', async () => {
    const off = harness({ submitRun: vi.fn(async () => null) });
    off.p.afterRun(summary(), record, info);
    await flush();
    expect(off.ui.showResult).toHaveBeenLastCalledWith({ ...info, online: { state: 'offline' } });
    const bad = harness({ submitRun: vi.fn(async () => { throw new Error('replay mismatch'); }) });
    bad.p.afterRun(summary(), record, info);
    await flush();
    expect(bad.ui.showResult).toHaveBeenLastCalledWith({ ...info, online: { state: 'rejected' } });
    const gone = harness({}, false);
    gone.p.afterRun(summary(), record, info);
    await flush();
    expect(gone.ui.showResult).not.toHaveBeenCalled();
  });

  it('campaign runs are not submitted and keep their info', () => {
    const h = harness({});
    const out = h.p.afterRun(summary({ mode: 'stage', stageId: 'w1-s1' }), null, info);
    expect(out).toBe(info);
    expect(h.api.submitRun).not.toHaveBeenCalled();
  });

  it('leaderboard: nickname first when missing, then loading → data; failures show offline', async () => {
    const noNick = harness({ nickname: () => null });
    noNick.p.openLeaderboard('endless');
    expect(noNick.ui.showNickname).toHaveBeenCalled();
    expect(noNick.ui.showLeaderboard).not.toHaveBeenCalled();
    const h = harness({});
    h.p.openLeaderboard('endless');
    expect(h.ui.showLeaderboard).toHaveBeenCalledWith('endless', 'loading');
    await flush();
    expect(h.ui.showLeaderboard).toHaveBeenLastCalledWith('endless', { top: [], mine: null });
    const down = harness({ leaderboard: vi.fn(async () => { throw new Error('net'); }) });
    down.p.openLeaderboard('endless-week');
    await flush();
    expect(down.ui.showLeaderboard).toHaveBeenLastCalledWith('endless-week', 'offline');
  });
});

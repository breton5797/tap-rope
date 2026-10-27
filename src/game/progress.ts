/**
 * v7 meta layer (GDD-v7 §3–4): achievements after runs / purchases / cutscenes (local first, synced),
 * leaderboard submission of endless & daily runs (server re-simulates them), leaderboard and nickname
 * screens. Side effects only through the injected ui/audio/online and the save accessors.
 */
import type { AudioApi, Board, OnlineApi, ResultInfo, RunRecord, RunSummary, SaveData, Ui } from '../types';
import { ACHIEVEMENTS, evaluateAchievements, updateDailyStreak } from '../core/achievements';
import { recordAchievements } from '../core/storage';

export interface ProgressDeps {
  readonly ui: Ui;
  readonly audio: AudioApi;
  readonly online: OnlineApi;
  readonly getSave: () => SaveData;
  readonly persist: (next: SaveData) => void;
  /** true while the result screen for this run is still showing */
  readonly resultShowing: () => boolean;
}

export interface Progress {
  /** after recordResult: streak + achievements; returns the result info to show (with online state) */
  afterRun(summary: RunSummary, record: RunRecord | null, info: ResultInfo): ResultInfo;
  /** re-check progress achievements (after a purchase, a cutscene, …) */
  recheck(): void;
  openLeaderboard(board: Board): void;
  openNickname(then?: () => void): void;
}

export function createProgress(d: ProgressDeps): Progress {
  const unlock = (summary: RunSummary | null): void => {
    const ids = evaluateAchievements(d.getSave(), summary);
    if (ids.length === 0) return;
    d.persist(recordAchievements(d.getSave(), ids, Date.now()));
    for (const id of ids) {
      const meta = ACHIEVEMENTS.find((a) => a.id === id);
      if (meta) d.ui.toastAchievement(meta);
    }
    d.audio.sfx('achieve');
    void d.online.syncAchievements(d.getSave().achievements);
  };

  const submit = (record: RunRecord, info: ResultInfo): void => {
    d.online
      .submitRun(record)
      .then((res) => {
        if (!d.resultShowing()) return;
        const online: ResultInfo['online'] = res === null ? { state: 'offline' } : { state: 'ranked', rank: res.rank };
        d.ui.showResult({ ...info, online });
      })
      .catch(() => {
        if (d.resultShowing()) d.ui.showResult({ ...info, online: { state: 'rejected' } });
      });
  };

  const openLeaderboard = (board: Board): void => {
    d.ui.showLeaderboard(board, 'loading');
    d.online
      .leaderboard(board)
      .then((data) => d.ui.showLeaderboard(board, data))
      .catch(() => d.ui.showLeaderboard(board, 'offline'));
  };

  const openNickname = (then?: () => void): void => {
    d.ui.showNickname(d.online.nickname(), async (name) => {
      const err = await d.online.setNickname(name);
      if (err === null) then?.();
      return err;
    });
  };

  return {
    afterRun(summary, record, info) {
      if (summary.mode === 'daily' && summary.cleared) d.persist(updateDailyStreak(d.getSave(), summary.date));
      unlock(summary);
      if (!record) return info;
      const pending: ResultInfo = { ...info, online: { state: 'pending' } };
      submit(record, pending);
      return pending;
    },
    recheck() {
      unlock(null);
    },
    openLeaderboard(board) {
      // first visit: pick a call sign so the row has a name
      if (d.online.nickname() === null) openNickname(() => openLeaderboard(board));
      else openLeaderboard(board);
    },
    openNickname,
  };
}

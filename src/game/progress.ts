/**
 * v7/v8 meta layer (GDD-v7 §3–4, GDD-v8 A5/A6): after a run — daily streak, achievements (shown as badges
 * on the result card), ₵ rewards (core/economy, paid outside the session), leaderboard submission of
 * endless & daily runs (server re-simulates them) and the "next rank" gap; leaderboard and nickname
 * screens. Server answers that arrive after the player moved on are dropped (run / board tokens).
 * Side effects only through the injected ui/audio/online and the save accessors.
 */
import type { AchievementId, AudioApi, Board, OnlineApi, ResultInfo, ResultMeta, RunRecord, RunSummary, SaveData, Ui } from '../types';
import { ACHIEVEMENTS, evaluateAchievements, updateDailyStreak } from '../core/achievements';
import { applyRewards, frameOf, runRewards } from '../core/economy';
import { recordAchievements, requestPersistentStorage } from '../core/storage';

export interface Challenge {
  readonly seed: number;
  readonly vs: number | null;
}

export interface ProgressDeps {
  readonly ui: Ui;
  readonly audio: AudioApi;
  readonly online: OnlineApi;
  readonly getSave: () => SaveData;
  readonly persist: (next: SaveData) => void;
  /** true while the result screen for this run is still showing */
  readonly resultShowing: () => boolean;
  /** name of the mounted menu screen (default: the UI's data-screen attribute) */
  readonly screenName?: () => string | undefined;
}

export interface Progress {
  /**
   * after recordResult: streak, achievements and ₵ rewards; returns the result info to show (meta +
   * online state). `before` = the save before recordResult (first clears / new stars).
   */
  afterRun(summary: RunSummary, record: RunRecord | null, info: ResultInfo, before?: SaveData): ResultInfo;
  /** re-check progress achievements (after a purchase, a cutscene, …) */
  recheck(): void;
  openLeaderboard(board: Board): void;
  openNickname(then?: () => void): void;
  /** v8: challenge link (?endless=<seed>&vs=<score>) — endless results on that seed show the duel */
  setChallenge(c: Challenge | null): void;
}

function domScreen(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.querySelector<HTMLElement>('.layer--screen')?.dataset.screen;
}

const boardOf = (record: RunRecord): Board => (record.mode === 'daily' ? `daily:${record.date}` : 'endless');

export function createProgress(d: ProgressDeps): Progress {
  const screenName = d.screenName ?? domScreen;
  let runSeq = 0;
  let boardSeq = 0;
  let challenge: Challenge | null = null;
  let askedNickname = false;

  /** unlocks and stores achievements; banners only outside the result screen (the card shows badges) */
  const unlock = (summary: RunSummary | null, banners: boolean): AchievementId[] => {
    const ids = evaluateAchievements(d.getSave(), summary);
    if (ids.length === 0) return ids;
    d.persist(recordAchievements(d.getSave(), ids, Date.now()));
    if (banners) {
      for (const id of ids) {
        const meta = ACHIEVEMENTS.find((a) => a.id === id);
        if (meta) d.ui.toastAchievement(meta);
      }
    }
    d.audio.sfx('achieve');
    void d.online.syncAchievements(d.getSave().achievements);
    return ids;
  };

  /** points to the next rank up, when that row is on the loaded board */
  const fetchGap = async (board: Board, rank: number, score: number): Promise<number | undefined> => {
    if (rank <= 1) return undefined;
    try {
      const data = await d.online.leaderboard(board);
      const above = data.top.find((r) => r.rank === rank - 1);
      return above ? Math.max(1, above.score - score + 1) : undefined;
    } catch {
      return undefined;
    }
  };

  const submit = (seq: number, record: RunRecord, info: ResultInfo): void => {
    const current = (): boolean => seq === runSeq && d.resultShowing();
    d.online
      .submitRun(record)
      .then(async (res) => {
        if (!current()) return;
        if (res === null) {
          d.ui.showResult({ ...info, online: { state: 'offline' } });
          return;
        }
        d.ui.showResult({ ...info, online: { state: 'ranked', rank: res.rank } });
        const gap = await fetchGap(boardOf(record), res.rank, res.score);
        if (gap !== undefined && current()) d.ui.showResult({ ...info, online: { state: 'ranked', rank: res.rank, gap } });
      })
      .catch(() => {
        if (current()) d.ui.showResult({ ...info, online: { state: 'rejected' } });
      });
  };

  const openNickname = (then?: () => void): void => {
    d.ui.showNickname(d.online.nickname(), async (name) => {
      const err = await d.online.setNickname(name);
      if (err === null) then?.();
      return err;
    });
  };

  const openLeaderboard = (board: Board): void => {
    const seq = ++boardSeq;
    const current = (): boolean => seq === boardSeq && screenName() === 'leaderboard';
    d.ui.showLeaderboard(board, 'loading');
    d.online
      .leaderboard(board)
      .then((data) => {
        if (!current()) return;
        d.ui.showLeaderboard(board, data);
        // the board first; a call sign is asked once, only when the server answered (registers lazily)
        if (d.online.nickname() === null && !askedNickname) {
          askedNickname = true;
          openNickname(() => {
            if (screenName() === 'leaderboard') openLeaderboard(board);
          });
        }
      })
      .catch(() => {
        if (current()) d.ui.showLeaderboard(board, 'offline');
      });
  };

  return {
    afterRun(summary, record, info, before = d.getSave()) {
      const seq = ++runSeq;
      let streak: ResultMeta['streak'] = null;
      if (summary.mode === 'daily' && summary.cleared) {
        const prev = d.getSave().dailyStreak;
        d.persist(updateDailyStreak(d.getSave(), summary.date));
        const next = d.getSave().dailyStreak;
        streak = { count: next.count, extended: next.last !== prev.last };
      }
      const unlocked = unlock(summary, false);
      const rewards = runRewards(before, d.getSave(), unlocked, streak);
      d.persist(applyRewards(d.getSave(), rewards));
      if (summary.cleared) requestPersistentStorage();
      const endlessSeed = record?.mode === 'endless' ? record.seed : null;
      const meta: ResultMeta = {
        rewards, streak, unlocked, hitBy: summary.hitBy ?? null, seed: endlessSeed,
        vs: challenge && endlessSeed === challenge.seed ? challenge.vs : null,
        board: record ? boardOf(record) : null, hits: summary.hitsTaken, frame: frameOf(d.getSave())?.color ?? null,
      };
      const withMeta: ResultInfo = { ...info, meta };
      if (!record) return withMeta;
      const pending: ResultInfo = { ...withMeta, online: { state: 'pending' } };
      submit(seq, record, pending);
      return pending;
    },
    recheck() {
      unlock(null, true);
    },
    openLeaderboard,
    openNickname,
    setChallenge(c) {
      challenge = c;
    },
  };
}

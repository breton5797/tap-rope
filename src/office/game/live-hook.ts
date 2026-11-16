/**
 * Office live events in the app (swaps src/game/live-hook.ts): the 오늘의 미션 button plays today's daily stage
 * (core/live dailyPlan for the player's tier), the boss of the day is announced before the countdown, every
 * real run's events count toward the weekly goal, and its end goes through core/live applyRun — the points
 * are added to the main save and the rewards are put on the result card. A daily run is not campaign progress.
 */
import type { LiveHook, LiveRunEnd, LiveRunSummary } from '../../game/live-hook';
import type { GameEvent, Session } from '../../game/session';
import type { SaveData, StageDef } from '../../types';
import {
  applyRun, dailyPlan, dailyUnlocked, loadLive, parseDailyId, progressTier, saveLive, themeOf, todayKey,
  weekOf, weekdayOf, type DateKey, type LiveRunCounts,
} from '../core/live';
import { setLiveLook } from '../render/live-look';
import { equippedSprite, lookOf, rewardPoints } from '../ui/live/model';
import { startCounts, trackCounts } from './live/counts';


let counts: LiveRunCounts = startCounts();
/** the local date the run started on (a daily played across midnight still counts for its own day) */
let runDate: DateKey = todayKey(new Date());

const today = (): DateKey => todayKey(new Date());

export const liveHook: LiveHook = {
  dailyStage(save: SaveData): StageDef | null {
    const tier = progressTier(save.stars);
    return dailyUnlocked(tier) ? dailyPlan(today(), tier).stage : null;
  },

  offCampaign: (stageId: string) => parseDailyId(stageId) !== null,

  briefing(stage: StageDef) {
    const d = parseDailyId(stage.id);
    if (!d) return null;
    const plan = dailyPlan(d.date, d.tier);
    return { kicker: `오늘의 칼퇴 미션 · ${themeOf(weekOf(d.date)).name}`, text: `오늘의 상사: ${plan.boss.name}` };
  },

  retry(stage: StageDef, _save: SaveData): StageDef | null {
    const d = parseDailyId(stage.id);
    if (!d) return stage;
    // a daily is today's or nothing: after midnight 한 번 더 would replay a course that no longer counts
    return d.date === today() ? stage : null;
  },

  start(_session: Session) {
    counts = startCounts();
    runDate = today();
    try {
      setLiveLook(lookOf(loadLive(), runDate));
    } catch (e) {
      console.error('live events: look unavailable', e);
    }
  },

  track(session: Session, events: readonly GameEvent[]) {
    if (events.length > 0) counts = trackCounts(counts, session, events);
  },

  finish(save: SaveData, run: LiveRunSummary): LiveRunEnd {
    const before = loadLive();
    const out = applyRun(before, run, counts, runDate, progressTier(save.stars));
    // a live save that can't be written pays nothing: its ledger would be lost and the reward paid again
    if (out.live !== before && !saveLive(out.live)) return { coins: 0, decorate: (r) => r };
    const coins = rewardPoints(out.rewards);
    const show = out.daily || out.rewards.length > 0;
    const stamps = out.live.card && out.live.card.week === weekOf(runDate) ? out.live.card.stamps : [false, false, false, false, false, false, false];
    return {
      coins,
      decorate: (r) => (show
        ? {
          ...r,
          coinsEarned: r.coinsEarned + coins,
          live: { daily: out.daily, rewards: out.rewards, stamps, today: weekdayOf(runDate), stampDesign: equippedSprite(out.live, 'stamp') },
        }
        : r),
    };
  },
};

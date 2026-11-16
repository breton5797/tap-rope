/**
 * Live events seam (office build: src/office/game/live-hook.ts — the daily mission, weekly card / goal and the
 * equipped cosmetics). v8 has none: every hook is a no-op, so the v8 app runs exactly as before.
 */
import type { ResultInfo, SaveData, StageDef } from '../types';
import type { GameEvent, Session } from './session';

export interface LiveRunSummary {
  readonly stageId: string | null;
  readonly cleared: boolean;
  readonly score: number;
}

export interface LiveRunEnd {
  /** 칼퇴 포인트 the run's live rewards pay (added to the save by the app) */
  readonly coins: number;
  /** the result card with the live rewards on it */
  readonly decorate: (r: ResultInfo) => ResultInfo;
}

export interface LiveHook {
  /** the stage the daily button plays (office: today's mission); null = the v8 daily mode */
  dailyStage(save: SaveData): StageDef | null;
  /** a stage outside the campaign (office: the daily): no stars, best, mission stamps or cutscenes */
  offCampaign(stageId: string): boolean;
  /** the line shown before the countdown instead of the chapter briefing; null = the usual briefing */
  briefing(stage: StageDef): { readonly kicker: string; readonly text: string } | null;
  /** the stage 한 번 더 replays; null = its day is over (office: a past daily) — back to the title instead */
  retry(stage: StageDef, save: SaveData): StageDef | null;
  /** a run starts (any mode) */
  start(session: Session): void;
  /** one step's events */
  track(session: Session, events: readonly GameEvent[]): void;
  /** a real run (never autoplay / tester) ended */
  finish(save: SaveData, run: LiveRunSummary): LiveRunEnd;
}

export const liveHook: LiveHook = {
  dailyStage: () => null,
  offCampaign: () => false,
  briefing: () => null,
  retry: (stage) => stage,
  start: () => undefined,
  track: () => undefined,
  finish: () => ({ coins: 0, decorate: (r) => r }),
};

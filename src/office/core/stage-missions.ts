/**
 * The mission script of any office stage id: the campaign's STAGE_MISSIONS, or a daily mission's (live events,
 * live/daily.ts). Everything that looks up missions by stage id goes through here so the daily stage works
 * like a campaign stage.
 */
import { STAGE_MISSIONS, type MissionSpec } from './missions';
import { dailyMissions } from './live/daily';

export function missionsOf(stageId: string): readonly [MissionSpec, MissionSpec, MissionSpec] | undefined {
  return STAGE_MISSIONS[stageId] ?? dailyMissions(stageId);
}

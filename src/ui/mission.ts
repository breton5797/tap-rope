/**
 * Mission DOM seam (office v2). v8 shows no missions: these render nothing. The office build swaps in
 * src/office/ui/mission.ts (HUD chip, mission card, stamps, result row, map dots).
 */
import type { MissionView, ResultInfo, StageDef } from '../types';

/** HUD: the running mission (undefined = clear) */
export function renderMission(_layer: HTMLElement, _view: MissionView | undefined, _stage: StageDef | null, _reduced: boolean): void {}

/** result card: the run's stamps and grade */
export function missionResult(_r: ResultInfo): HTMLElement | null {
  return null;
}

/** stage map: a stage's best stamps */
export function stampDots(_stageId: string): HTMLElement | null {
  return null;
}

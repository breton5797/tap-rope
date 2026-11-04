// The superior on screen (part 2 spec §1): looked up by stage and section, never by sprite slot — the rematch
// slots (박과장 7, 윤이사 9, 최팀장 / 한전무 10) reuse a part-1 slot but speak their part-2 lines.
import { superiorAt, type OfficeBoss } from '../core/boss';

/** the superior of section `phase` on the run's stage (`stageIndex` is 0-based), else null */
export function superiorOnStage(stageIndex: number, phase: number): OfficeBoss | null {
  return superiorAt(stageIndex + 1, phase);
}

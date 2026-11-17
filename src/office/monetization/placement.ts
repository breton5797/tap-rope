/** which rewarded bonus a result card may offer (monetization spec §1); pure */
import type { ResultInfo } from '../../types';
import type { Placement } from './policy';

export function bonusPlacement(r: ResultInfo): Placement | null {
  if (!r.cleared || r.testRun || r.autoplay) return null;
  if (r.live?.daily) return r.live.rewards.some((x) => x.why === 'daily') ? 'daily' : null;
  return r.mode === 'stage' && r.stageId ? 'stage' : null;
}

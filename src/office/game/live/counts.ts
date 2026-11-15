/**
 * Run hook (office live events): what a run adds to the weekly goal, folded from the session's events for
 * core/live applyRun. App wiring (render worker): `startCounts()` at the run start, `trackCounts` with every
 * step's events, then `applyRun(live, summary, counts, today, tier)` at the end.
 * - coffee: 아이스 아메리카노 pickups ('slow') + mission items of a part collecting 커피 쿠폰
 * - docs: mission items of a part collecting 서류
 * - perfects: PERFECT judgements · jumps: taps that jumped (jump / boost)
 * - dodge-dinner: hazards passed while 윤이사 is the superior of that section
 * - part2-clears: a cleared campaign stage of part 2 (6–10)
 */
import type { Beat } from '../../../types';
import { HAZARD_KINDS } from '../../../types';
import type { GameEvent, Session } from '../../../game/session';
import { bossForSection } from '../../core/boss';
import { CHAPTERS, stageById } from '../../core/content';
import { missionsOf } from '../../core/stage-missions';
import type { GoalMetric, LiveRunCounts } from '../../core/live/types';

export const ZERO_COUNTS: LiveRunCounts = { coffee: 0, 'dodge-dinner': 0, docs: 0, perfects: 0, jumps: 0, 'part2-clears': 0 };

type RunView = Pick<Session, 'stage' | 'beats'>;

export function startCounts(): LiveRunCounts {
  return ZERO_COUNTS;
}

const isHazard = (b: Beat): boolean => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const beatOf = (s: RunView, id: number): Beat | undefined => (s.beats[id]?.id === id ? s.beats[id] : s.beats.find((b) => b.id === id));

/** the metric points one event is worth */
function scoreEvent(s: RunView, e: GameEvent): Partial<Record<GoalMetric, number>> {
  switch (e.type) {
    case 'tap': return e.action === 'jump' || e.action === 'boost' ? { jumps: 1 } : {};
    case 'pickup': return e.kind === 'slow' ? { coffee: 1 } : {};
    case 'end': {
      const part2 = stageById(s.stage.id) !== undefined && CHAPTERS[s.stage.chapter]?.part === 2;
      return e.cleared && part2 ? { 'part2-clears': 1 } : {};
    }
    case 'judge': {
      const out: Partial<Record<GoalMetric, number>> = e.result.grade === 'perfect' ? { perfects: 1 } : {};
      const beat = beatOf(s, e.result.beatId);
      if (!beat) return out;
      const items = e.result.items ?? 0;
      const item = missionsOf(s.stage.id)?.[beat.part ?? beat.section]?.collectible;
      if (items > 0 && item === 'coupon') out.coffee = items;
      if (items > 0 && item === 'docs') out.docs = items;
      const passed = isHazard(beat) && (!e.result.hit || e.shielded);
      if (passed && bossForSection(s.stage, beat.section)?.id === 'apc') out['dodge-dinner'] = 1;
      return out;
    }
    default: return {};
  }
}

/** folds one step's events in (session = the state after the step) */
export function trackCounts(counts: LiveRunCounts, s: RunView, events: readonly GameEvent[]): LiveRunCounts {
  return events.reduce<LiveRunCounts>((acc, e) => {
    const add = scoreEvent(s, e);
    const keys = Object.keys(add) as GoalMetric[];
    return keys.length === 0 ? acc : keys.reduce((a, k) => ({ ...a, [k]: a[k] + (add[k] ?? 0) }), acc);
  }, counts);
}

/**
 * Office goals (칼퇴근 대작전), swapped in for src/core/goals.ts: the title's "다음 목표" line only ever points at
 * the five office stages and the office achievements — never at daily / endless / the shop (all off here).
 * Streak, ★3 rule and date helpers are the v8 ones.
 */
import type { AchievementId, SaveData } from '../../types';
import { ACHIEVEMENTS } from './achievements';
import { CUTSCENES } from '../../core/cutscenes';
import { STAGES } from '../../core/content';
import { ACH_REWARD, FIRST_MISSION_COINS } from '../../core/economy';
import type { Goal } from '../../core/goals';

export * from '../../core/goals';

const cleared = (save: SaveData, id: string): boolean => (save.stars[id] ?? 0) >= 1;
const ZONE_STAGE: Partial<Record<AchievementId, number>> = { 'zone-1': 0, 'zone-3': 2, 'zone-5': 4 };

/** progress toward a cumulative office achievement, null for one-run feats */
export function achievementProgress(id: AchievementId, save: SaveData): { readonly cur: number; readonly max: number } | null {
  const upTo = ZONE_STAGE[id];
  if (upTo !== undefined) {
    const stages = STAGES.slice(0, upTo + 1);
    return { cur: stages.filter((s) => cleared(save, s.id)).length, max: stages.length };
  }
  if (id === 'all-stars-zone') return { cur: STAGES.filter((s) => (save.stars[s.id] ?? 0) >= 3).length, max: STAGES.length };
  if (id === 'archivist') return { cur: save.seenCutscenes.length, max: CUTSCENES.length };
  return null;
}

/** The one most useful next objective for the title strip (`_today` kept for the v8 signature). */
export function nextGoal(save: SaveData, _today: string): Goal {
  if (!STAGES.some((s) => cleared(save, s.id))) {
    return { kind: 'first', text: `첫 퇴근: 1단계 클리어 → 보너스 ₵${FIRST_MISSION_COINS}` };
  }
  const i = STAGES.findIndex((s) => !cleared(save, s.id));
  if (i >= 0) return { kind: i === STAGES.length - 1 ? 'boss' : 'stage', text: `다음 목표: ${i + 1}단계 ${STAGES[i].name} 통과` };
  const closest = ACHIEVEMENTS
    .filter((a) => save.achievements[a.id] === undefined)
    .map((a) => ({ a, p: achievementProgress(a.id, save) }))
    .filter((x): x is { a: typeof x.a; p: { cur: number; max: number } } => x.p !== null && x.p.cur < x.p.max)
    .sort((x, y) => y.p.cur / y.p.max - x.p.cur / x.p.max)[0];
  if (closest) return { kind: 'achievement', text: `업적 ${closest.a.name} ${closest.p.cur}/${closest.p.max} · ₵${ACH_REWARD[closest.a.id]}` };
  return { kind: 'achievement', text: '18:00 칼퇴 완료! 별 3개로 우수 사원에 도전' };
}

/**
 * Office achievements (칼퇴근 대작전), swapped in for src/core/achievements.ts: the v8 ids that make sense for a
 * five-stage, offline run with two free characters, renamed in the office voice. No endless / daily / roster
 * trophies (those modes and purchases are off). Same exports and the same pure evaluation as v8.
 */
import type { AchievementId, AchievementMeta, RunSummary, SaveData } from '../../types';
import { STAGES } from '../../core/content';
import { CUTSCENES } from '../../core/cutscenes';

export { updateDailyStreak } from '../../core/achievements';

export const ACHIEVEMENTS: readonly AchievementMeta[] = [
  { id: 'first-clear', name: '첫 퇴근', desc: '단계 하나를 클리어한다.' },
  { id: 'zone-1', name: '김대리 따돌림', desc: '1단계 12층 기획팀 사무실을 클리어한다.' },
  { id: 'zone-3', name: '회의 불참', desc: '3단계 회의실 층을 클리어한다.' },
  { id: 'zone-5', name: '18:00 칼퇴', desc: '5단계 1층 로비를 지나 정시에 퇴근한다.' },
  { id: 'flawless-boss', name: '무사고 퇴근', desc: '한 대도 안 맞고 단계를 클리어한다.' },
  { id: 'perfect-stage', name: '완벽한 칼퇴', desc: 'MISS와 GOOD 없이 단계를 클리어한다.' },
  { id: 'chain-50', name: '50 콤보', desc: '한 판에 50 연속을 달성한다.' },
  { id: 'chain-100', name: '100 콤보', desc: '한 판에 100 연속을 달성한다.' },
  { id: 'overdrive-3', name: '칼퇴 모드 3연발', desc: '한 판에 칼퇴 모드를 3회 발동한다.' },
  { id: 'all-stars-zone', name: '우수 사원', desc: '모든 단계에서 별 3개를 받는다.' },
  { id: 'archivist', name: '사내 소식통', desc: '컷신을 모두 본다.' },
];

type Check = (save: SaveData, run: RunSummary | null) => boolean;

const stageWin = (run: RunSummary | null): run is RunSummary => run?.mode === 'stage' && run.cleared;
const clearedStage = (save: SaveData, run: RunSummary | null, id: string) =>
  (save.stars[id] ?? 0) >= 1 || (stageWin(run) && run.stageId === id);

const CHECKS: Partial<Record<AchievementId, Check>> = {
  'first-clear': (save, run) => STAGES.some((s) => (save.stars[s.id] ?? 0) >= 1) || stageWin(run),
  'zone-1': (save, run) => clearedStage(save, run, 'w1-s10'),
  'zone-3': (save, run) => clearedStage(save, run, 'w3-s10'),
  'zone-5': (save, run) => clearedStage(save, run, 'w5-s10'),
  'flawless-boss': (_save, run) => stageWin(run) && run.hitsTaken === 0,
  'perfect-stage': (_save, run) => stageWin(run) && run.misses === 0 && run.goods === 0,
  'chain-50': (_save, run) => (run?.maxCombo ?? 0) >= 50,
  'chain-100': (_save, run) => (run?.maxCombo ?? 0) >= 100,
  'overdrive-3': (_save, run) => (run?.fevers ?? 0) >= 3,
  'all-stars-zone': (save) => STAGES.every((s) => (save.stars[s.id] ?? 0) >= 3),
  archivist: (save) => CUTSCENES.every((c) => save.seenCutscenes.includes(c.id)),
};

/** ids newly unlocked by this save (+ the run just finished, if any), in ACHIEVEMENTS order */
export function evaluateAchievements(save: SaveData, run: RunSummary | null): AchievementId[] {
  return ACHIEVEMENTS.map((a) => a.id).filter((id) => save.achievements[id] === undefined && (CHECKS[id]?.(save, run) ?? false));
}

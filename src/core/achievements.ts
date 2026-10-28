/**
 * Achievements (GDD v7 §3.1), local first. evaluateAchievements(save, run) is pure and returns only the
 * ids not yet in save.achievements whose condition now holds. Progress conditions read the save (pass it
 * AFTER recording the run: stars, skins, seen cutscenes, daily streak); run feats read the RunSummary.
 * updateDailyStreak counts consecutive calendar days with a daily-operation clear.
 */
import type { AchievementId, AchievementMeta, RunSummary, SaveData } from '../types';
import { SKINS, STAGES } from './content';
import { CUTSCENES } from './cutscenes';

export const ACHIEVEMENTS: readonly AchievementMeta[] = [
  { id: 'first-clear', name: '첫 임무', desc: '단계 하나를 클리어한다.' },
  { id: 'zone-1', name: '구역 1 돌파', desc: '1-10 보스 단계를 클리어한다.' },
  { id: 'zone-3', name: '구역 3 돌파', desc: '3-10 보스 단계를 클리어한다.' },
  { id: 'zone-5', name: '구역 5 돌파', desc: '5-10 보스 단계를 클리어한다.' },
  { id: 'zone-7', name: '구역 7 돌파', desc: '7-10 보스 단계를 클리어한다.' },
  { id: 'zone-10', name: '구역 10 돌파', desc: '10-10 보스 단계를 클리어한다.' },
  { id: 'rescue', name: '포로 구출', desc: '감옥 블록에서 포로를 구출한다.' },
  { id: 'escape', name: '탈출 성공', desc: '헬기로 기지를 이탈한다.' },
  { id: 'flawless-boss', name: '무결점 제압', desc: '보스 단계를 피격 없이 클리어한다.' },
  { id: 'perfect-stage', name: '완벽한 침투', desc: 'MISS와 GOOD 없이 단계를 클리어한다.' },
  { id: 'chain-50', name: '50 체인', desc: '한 판에 50 연속을 달성한다.' },
  { id: 'chain-100', name: '100 체인', desc: '한 판에 100 연속을 달성한다.' },
  { id: 'overdrive-3', name: '과부하', desc: '한 판에 오버드라이브를 3회 발동한다.' },
  { id: 'all-stars-zone', name: '구역 완전 제압', desc: '한 구역 10단계 모두 별 3개.' },
  { id: 'stars-150', name: '베테랑', desc: '별을 합계 150개 모은다.' },
  { id: 'endless-60', name: '생존 1분', desc: '무한 침투에서 60초 생존한다.' },
  { id: 'endless-180', name: '생존 3분', desc: '무한 침투에서 180초 생존한다.' },
  { id: 'daily-1', name: '일일 작전', desc: '일일 작전을 클리어한다.' },
  { id: 'daily-7', name: '7일 연속', desc: '일일 작전을 7일 연속 클리어한다.' },
  { id: 'all-operators', name: '전 요원 확보', desc: '요원 6명을 모두 확보한다.' },
  { id: 'archivist', name: '기록 보관', desc: '컷신 13편을 모두 시청한다.' },
];

type Check = (save: SaveData, run: RunSummary | null) => boolean;

const clearedStage = (save: SaveData, run: RunSummary | null, id: string) =>
  (save.stars[id] ?? 0) >= 1 || (run?.mode === 'stage' && run.cleared && run.stageId === id);
const stageWin = (run: RunSummary | null): run is RunSummary => run?.mode === 'stage' && run.cleared;
const starTotal = (save: SaveData) => STAGES.reduce((n, s) => n + (save.stars[s.id] ?? 0), 0);
const fullZone = (save: SaveData) =>
  Array.from({ length: 10 }, (_, c) => STAGES.filter((s) => s.chapter === c)).some((zone) =>
    zone.length > 0 && zone.every((s) => (save.stars[s.id] ?? 0) >= 3));
const survived = (run: RunSummary | null, sec: number) => run?.mode === 'endless' && run.seconds >= sec;

const CHECKS: Readonly<Record<AchievementId, Check>> = {
  'first-clear': (save, run) => STAGES.some((s) => (save.stars[s.id] ?? 0) >= 1) || stageWin(run),
  'zone-1': (save, run) => clearedStage(save, run, 'w1-s10'),
  'zone-3': (save, run) => clearedStage(save, run, 'w3-s10'),
  'zone-5': (save, run) => clearedStage(save, run, 'w5-s10'),
  'zone-7': (save, run) => clearedStage(save, run, 'w7-s10'),
  'zone-10': (save, run) => clearedStage(save, run, 'w10-s10'),
  rescue: (save, run) => clearedStage(save, run, 'w5-s10'),
  escape: (save, run) => clearedStage(save, run, 'w10-s10'),
  'flawless-boss': (_save, run) => stageWin(run) && run.hitsTaken === 0
    && STAGES.some((s) => s.id === run.stageId && s.kind === 'boss'),
  'perfect-stage': (_save, run) => stageWin(run) && run.misses === 0 && run.goods === 0,
  'chain-50': (_save, run) => (run?.maxCombo ?? 0) >= 50,
  'chain-100': (_save, run) => (run?.maxCombo ?? 0) >= 100,
  'overdrive-3': (_save, run) => (run?.fevers ?? 0) >= 3,
  'all-stars-zone': (save) => fullZone(save),
  'stars-150': (save) => starTotal(save) >= 150,
  'endless-60': (_save, run) => survived(run, 60),
  'endless-180': (_save, run) => survived(run, 180),
  'daily-1': (save, run) => save.dailyStreak.count >= 1 || (run?.mode === 'daily' && run.cleared),
  'daily-7': (save) => save.dailyStreak.count >= 7,
  'all-operators': (save) => SKINS.every((s) => save.ownedSkins.includes(s.id)),
  archivist: (save) => CUTSCENES.every((c) => save.seenCutscenes.includes(c.id)),
  'stamps-15': () => false, // office v2 only (mission stamps); not in the v8 list
};

/** ids newly unlocked by this save (+ the run just finished, if any), in ACHIEVEMENTS order */
export function evaluateAchievements(save: SaveData, run: RunSummary | null): AchievementId[] {
  return ACHIEVEMENTS.map((a) => a.id).filter((id) => save.achievements[id] === undefined && CHECKS[id](save, run));
}

const DAY_MS = 86400000;

/** ms at UTC midnight of a valid YYYY-MM-DD calendar date, else null */
function dayMs(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ms).toISOString().slice(0, 10) === date ? ms : null;
}

/** records a daily-operation clear on `date`: +1 on the next calendar day, 1 after a gap; same/older day = no-op */
export function updateDailyStreak(save: SaveData, date: string): SaveData {
  const today = dayMs(date);
  const last = save.dailyStreak.last === null ? null : dayMs(save.dailyStreak.last);
  if (today === null || (last !== null && today <= last)) return save;
  const count = last !== null && today - last === DAY_MS ? save.dailyStreak.count + 1 : 1;
  return { ...save, dailyStreak: { last: date, count } };
}

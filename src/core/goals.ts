/**
 * v8 goal visibility (GDD-v8 A5): the live daily streak, cumulative achievement progress, the ★3 rule
 * and the single "다음 목표" line on the title. Pure; dates are local YYYY-MM-DD strings.
 */
import type { AchievementId, ResultInfo, SaveData } from '../types';
import { ACHIEVEMENTS } from './achievements';
import { CHAPTERS, SKINS, STAGES } from './content';
import { CUTSCENES } from './cutscenes';
import { ACH_REWARD, FIRST_MISSION_COINS, streakReward } from './economy';

const DAY_MS = 86400000;
const dayMs = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));

/** today's local calendar date (the daily operation's date) */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface StreakStatus {
  /** the streak as it stands today (0 once a day was missed) */
  readonly count: number;
  readonly doneToday: boolean;
  /** cleared yesterday, not yet today: the streak breaks at midnight */
  readonly atRisk: boolean;
}

export function streakStatus(save: SaveData, today: string): StreakStatus {
  const { last, count } = save.dailyStreak;
  if (last === null || count <= 0) return { count: 0, doneToday: false, atRisk: false };
  const gap = Math.round((dayMs(today) - dayMs(last)) / DAY_MS);
  if (gap <= 0) return { count, doneToday: true, atRisk: false };
  if (gap === 1) return { count, doneToday: false, atRisk: true };
  return { count: 0, doneToday: false, atRisk: false };
}

/** "w3-s4" → "3-4" */
export const stageLabel = (id: string): string => id.replace(/^w(\d+)-s(\d+)$/, '$1-$2');

const starTotal = (save: SaveData): number => STAGES.reduce((n, s) => n + (save.stars[s.id] ?? 0), 0);
const cleared = (save: SaveData, id: string): boolean => (save.stars[id] ?? 0) >= 1;
const ZONE_BOSS: Partial<Record<AchievementId, number>> = { 'zone-1': 0, 'zone-3': 2, 'zone-5': 4, rescue: 4, 'zone-7': 6, 'zone-10': 9, escape: 9 };

/** progress toward a cumulative achievement, null for one-run feats */
export function achievementProgress(id: AchievementId, save: SaveData): { readonly cur: number; readonly max: number } | null {
  const zone = ZONE_BOSS[id];
  if (zone !== undefined) {
    const upTo = STAGES.filter((s) => s.chapter <= zone);
    return { cur: upTo.filter((s) => cleared(save, s.id)).length, max: upTo.length };
  }
  switch (id) {
    case 'stars-150': return { cur: Math.min(150, starTotal(save)), max: 150 };
    case 'all-operators': return { cur: SKINS.filter((s) => save.ownedSkins.includes(s.id)).length, max: SKINS.length };
    case 'archivist': return { cur: save.seenCutscenes.length, max: CUTSCENES.length };
    case 'daily-7': return { cur: Math.min(7, save.dailyStreak.count), max: 7 };
    case 'all-stars-zone': {
      const best = Math.max(0, ...CHAPTERS.map((c) => STAGES.filter((s) => s.chapter === c.id && (save.stars[s.id] ?? 0) >= 3).length));
      return { cur: best, max: 10 };
    }
    default: return null;
  }
}

/** ★3 = no hits and PERFECT ≥ 60% of judged beats (scoring.computeStars) */
export function starRule(r: Pick<ResultInfo, 'perfects' | 'greats' | 'goods' | 'misses'>): { readonly pct: number; readonly met: boolean } {
  const total = r.perfects + (r.greats ?? 0) + r.goods + r.misses;
  const ratio = total > 0 ? r.perfects / total : 1;
  return { pct: Math.round(ratio * 100), met: ratio >= 0.6 };
}

export interface Goal {
  readonly kind: 'first' | 'daily' | 'shop' | 'boss' | 'stage' | 'achievement';
  readonly text: string;
}

/** The one most useful next objective for the title strip. */
export function nextGoal(save: SaveData, today: string): Goal {
  if (!STAGES.some((s) => cleared(save, s.id))) {
    return { kind: 'first', text: `첫 임무: 1-1 클리어 → 보상 ₵${FIRST_MISSION_COINS}` };
  }
  const streak = streakStatus(save, today);
  if (streak.atRisk) {
    return { kind: 'daily', text: `일일 작전으로 연속 ${streak.count}일 이어가기 · ₵${streakReward(streak.count + 1)}` };
  }
  const skin = SKINS.find((s) => !save.ownedSkins.includes(s.id) && save.coins >= s.price);
  if (skin) return { kind: 'shop', text: `장비실: ${skin.name} 확보 가능` };
  const next = STAGES.find((s) => !cleared(save, s.id));
  if (next) {
    const boss = STAGES.find((s) => s.chapter === next.chapter && s.kind === 'boss');
    if (next.kind === 'boss') return { kind: 'boss', text: `다음 목표: ${stageLabel(next.id)} 거점 보스 격파 · ₵30` };
    return { kind: 'stage', text: `다음 작전: ${stageLabel(next.id)} ${next.name}${boss ? ` → ${stageLabel(boss.id)} 보스` : ''}` };
  }
  const closest = ACHIEVEMENTS
    .filter((a) => save.achievements[a.id] === undefined)
    .map((a) => ({ a, p: achievementProgress(a.id, save) }))
    .filter((x): x is { a: typeof x.a; p: { cur: number; max: number } } => x.p !== null && x.p.cur < x.p.max)
    .sort((x, y) => y.p.cur / y.p.max - x.p.cur / x.p.max)[0];
  if (closest) {
    return { kind: 'achievement', text: `업적 ${closest.a.name} ${closest.p.cur}/${closest.p.max} · ₵${ACH_REWARD[closest.a.id]}` };
  }
  if (!streak.doneToday) return { kind: 'daily', text: `오늘의 일일 작전 · ₵${streakReward(streak.count + 1)}` };
  return { kind: 'achievement', text: '무한 침투에서 최고 기록에 도전' };
}

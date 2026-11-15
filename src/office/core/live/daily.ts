/**
 * 오늘의 칼퇴 미션 (spec §1): one short three-mission stage per (date, tier).
 * - Fair: only the moves taught up to the player's tier stage; a superior the player has met; tuned per tier
 *   (the tier stage's difficulty + DAILY_D_OFFSET[tier − 1], applied in content.ts missionPartStage, and
 *   DAILY_HAZARDS[tier − 1]) so the casual bot clears 85–92 % (docs/balance/live-economy.md).
 * - Deterministic: everything comes from hashString of the date (and the tier), never from the clock or input.
 * - Theme (themes.ts): pickup share (≤ ×THEME_PICKUP_MAX), the collect item, the superior of most days, a focus
 *   move the player already knows. Never more hazards or a faster tempo.
 * The stage is played as an office stage (mode 'stage'); its id (daily-id.ts) is recognised by content, boss,
 * cutscenes, levels and the mission tracker (stage-missions.ts missionsOf).
 */
import type { MoveId, StageDef } from '../../../types';
import { designCustomStage } from '../../../core/campaign';
import { hashString } from '../../../core/rng';
import { CHAPTERS, DAILY_D_OFFSET, STAGES, stageDifficulty } from '../content';
import { OFFICE_BOSSES, type OfficeBoss } from '../boss';
import type { CollectibleId, MissionSpec } from '../missions';
import type { DailyPlan, DateKey, ProgressTier, ThemeId } from './types';
import { isDateKey, weekOf } from './dates';
import { makeDailyId, readDailyId } from './daily-id';
import { themeOf } from './themes';

export { DAILY_D_OFFSET };
/** BALANCE knobs: per tier (index = tier − 1) hazards per mission (dodge / collect / finale); the collect target,
 * the first-clear points (docs/balance/live-economy.md) */
export const DAILY_HAZARDS: readonly (readonly [number, number, number])[] = [
  [25, 8, 27], [22, 8, 24], [22, 8, 24], [21, 8, 23], [21, 8, 23], [21, 8, 23], [21, 8, 23], [20, 8, 22], [20, 8, 22], [20, 8, 22],
];
/** the hazard counts of a tier's daily */
export const dailyHazards = (tier: ProgressTier): readonly [number, number, number] =>
  DAILY_HAZARDS[Math.min(DAILY_HAZARDS.length, Math.max(1, tier)) - 1];
export const DAILY_COLLECT_TARGET = 5;
export const DAILY_POINTS = 85;
/** a theme may at most double the pickup rate */
export const THEME_PICKUP_MAX = 2;
/** days of a week the theme's favourite superior shows up (when the player has met them) */
const THEME_BOSS_DAYS = 4;

const DODGE = { density: 1, pickupRate: 0.25 } as const;
const COLLECT = { density: 0.6, pickupRate: 1 } as const;
const FINALE = { density: 1, pickupRate: 0.15 } as const;
const COLLECT_MOVES: readonly MoveId[] = ['jump', 'double', 'lane', 'slide', 'drop'];
const ITEMS: readonly CollectibleId[] = ['coupon', 'docs', 'cookie', 'badge', 'envelope'];
const ITEM_NAMES: Readonly<Record<CollectibleId, string>> = {
  coupon: '커피 쿠폰', docs: '서류', cookie: '간식', badge: '출입 사원증', envelope: '금일봉',
};

/** the daily stage id of (date, tier): the superior row is part of it (daily-id.ts) */
export function dailyId(date: DateKey, tier: ProgressTier): string {
  return makeDailyId(date, tier, OFFICE_BOSSES.indexOf(bossOfDay(date, tier)));
}

/** the (date, tier) of a daily stage id, else null */
export function parseDailyId(id: string): { readonly date: DateKey; readonly tier: ProgressTier } | null {
  const d = readDailyId(id);
  return d && isDateKey(d.date) ? { date: d.date, tier: d.tier } : null;
}

/** the player's tier: the highest office stage cleared (save.stars ≥ 1), 0 = none */
export function progressTier(stars: Readonly<Record<string, number>>): ProgressTier {
  const top = STAGES.reduce((n, s, i) => ((stars[s.id] ?? 0) >= 1 ? i + 1 : n), 0);
  return top as ProgressTier;
}

/** the daily opens once stage 1 is cleared */
export function dailyUnlocked(tier: ProgressTier): boolean {
  return tier >= 1;
}

const draw = (date: DateKey, salt: string): number => hashString(`officeescape:live:${date}:${salt}`);

/** one row per superior the player has met: that person's latest appearance up to the tier (rematch lines) */
function metSuperiors(tier: ProgressTier): OfficeBoss[] {
  const latest = new Map<string, OfficeBoss>();
  for (const b of OFFICE_BOSSES) if (b.stage <= tier) latest.set(b.name, b);
  return [...latest.values()];
}

function bossOfDay(date: DateKey, tier: ProgressTier): OfficeBoss {
  const met = metSuperiors(tier);
  const fav = themeOf(weekOf(date)).emphasis.boss;
  const favRow = fav === undefined ? undefined : met.find((b) => b.slot === fav);
  if (favRow && draw(date, 'fav') % 7 < THEME_BOSS_DAYS) return favRow;
  return met[draw(date, 'boss') % met.length] ?? OFFICE_BOSSES[0];
}

/** the day's look: one of the places the player has reached */
function lookOfDay(date: DateKey, tier: ProgressTier, theme: ThemeId): Pick<StageDef, 'world' | 'variant'> {
  const reached = CHAPTERS.slice(0, tier);
  const outdoors = reached.filter((c) => c.part === 2);
  const pool = theme === 'rainy-commute' && outdoors.length > 0 ? outdoors : reached;
  const c = pool[draw(date, 'look') % pool.length];
  return { world: c.theme, variant: c.variant };
}

function missionsOfDay(date: DateKey, tier: ProgressTier, boss: OfficeBoss): DailyPlan['missions'] {
  const emphasis = themeOf(weekOf(date)).emphasis;
  const unlocked = STAGES[tier - 1].moves;
  const hz = dailyHazards(tier);
  const has = (m: MoveId): boolean => unlocked.includes(m);
  const focus = (emphasis.focus ?? []).filter(has);
  const mul = Math.min(THEME_PICKUP_MAX, Math.max(1, emphasis.pickupMul ?? 1));
  const pick = (rate: number): number => Math.min(1, rate * mul);
  const item = emphasis.collectible ?? ITEMS[draw(date, 'item') % ITEMS.length];
  const dodge: MissionSpec = {
    kind: 'dodge', title: `${boss.name}의 기습`, target: hz[0], hazards: hz[0], moves: unlocked,
    ...(focus.length > 0 ? { focus } : {}), ...DODGE, pickupRate: pick(DODGE.pickupRate), line: boss.catchphrase,
  };
  const collect: MissionSpec = {
    kind: 'collect', title: `${ITEM_NAMES[item]} 모으기`, target: DAILY_COLLECT_TARGET, hazards: hz[1],
    moves: COLLECT_MOVES.filter(has), collectible: item, ...COLLECT, line: `${ITEM_NAMES[item]} 좀 챙겨 와~`,
  };
  const finale: MissionSpec = {
    kind: 'finale', title: `${boss.name} 뛰어넘기`, target: hz[2], hazards: hz[2], moves: unlocked,
    ...(focus.length > 0 ? { focus } : {}), ...FINALE, pickupRate: pick(FINALE.pickupRate), line: `${boss.tag}!`,
  };
  return [dodge, collect, finale];
}

/** the day's plan: deterministic in (date, tier); tier 0 plays as tier 1 (the caller gates on dailyUnlocked) */
export function dailyPlan(date: DateKey, tier: ProgressTier): DailyPlan {
  const t = Math.max(1, tier) as ProgressTier;
  const theme = themeOf(weekOf(date));
  const boss = bossOfDay(date, t);
  const id = makeDailyId(date, t, OFFICE_BOSSES.indexOf(boss));
  const missions = missionsOfDay(date, t, boss);
  const look = lookOfDay(date, t, theme.id);
  const stage = designCustomStage(
    {
      id, name: '오늘의 칼퇴 미션', n: t * 10, chapter: t - 1, index: 9, kind: 'boss', ...look,
      d: stageDifficulty(t - 1, true), seed: hashString(`officeescape:${id}`), campaign: true,
    },
    [...new Set(missions.flatMap((m) => m.moves))],
    missions[0].focus ?? [],
  );
  return { date, tier: t, stage, missions, boss: { slot: boss.slot, name: boss.name, stage: boss.stage }, theme: theme.id };
}

/** the missions of a daily stage id (stage-missions.ts), else undefined */
export function dailyMissions(id: string): DailyPlan['missions'] | undefined {
  const d = parseDailyId(id);
  return d ? dailyPlan(d.date, d.tier).missions : undefined;
}

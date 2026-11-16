/**
 * 오늘의 칼퇴 미션 (spec §1): one short three-mission stage per (date, tier).
 * - Fair: only the moves taught up to the player's tier stage; a superior the player has met; tuned per tier
 *   (the tier stage's difficulty + DAILY_D_OFFSET[tier − 1], applied in content.ts missionPartStage, and
 *   DAILY_HAZARDS[tier − 1]) so the casual bot clears 85–92 % (docs/balance/live-economy.md).
 * - Deterministic: everything comes from hashString of the date (and the tier), never from the clock or input.
 * - Varied (pt-casual): the superior is never the same two days in a row (block shuffles, no recursion; tier 1
 *   also meets 박과장); the opening two parts (dodge / chase / collect), the titles and the focus move change by day.
 * - Theme (themes.ts): pickup share (≤ ×THEME_PICKUP_MAX), the collect item, the superior of Mon / Wed / Fri / Sun,
 *   a focus move the player already knows. Never more hazards or a faster tempo.
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
import { addDays, daysBetween, isDateKey, weekOf, weekdayOf } from './dates';
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

const DODGE = { density: 1, pickupRate: 0.25 } as const;
const CHASE = { density: 1.15, pickupRate: 0.15 } as const;
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
const drawN = (n: number, salt: string): number => hashString(`officeescape:live:${salt}:${n}`);

/**
 * the superiors a daily can bring: one row per person the player has met (their latest appearance up to the tier,
 * rematch lines); at tier 1 also the next one (박과장), so two days in a row never bring the same person
 */
function candidates(tier: ProgressTier): OfficeBoss[] {
  const latest = new Map<string, OfficeBoss>();
  for (const b of OFFICE_BOSSES) if (b.stage <= Math.max(tier, 2)) latest.set(b.name, b);
  return [...latest.values()];
}

/** day number since 1970-01-01 (any fixed origin works: only differences matter) */
const dayNo = (date: DateKey): number => daysBetween('1970-01-01', date);

/** a deterministic shuffle of 0..m−1 for block `b` */
function shuffle(m: number, b: number, salt: string): number[] {
  const order = Array.from({ length: m }, (_, i) => i);
  return order.map((i) => ({ i, k: drawN(b * 97 + i, salt) })).sort((x, y) => x.k - y.k || x.i - y.i).map((x) => x.i);
}

/**
 * the base pick of day n among m (m ≥ 3): blocks of m days each run through a shuffle; when a block would start
 * with the person the previous block ended on, its first two swap (m ≥ 3, so the block's end is unchanged).
 * Consecutive days never repeat, and nothing depends on another day's result (no recursion).
 */
function basePick(n: number, m: number, salt: string): number {
  if (m <= 2) return ((n % m) + m) % m;
  const b = Math.floor(n / m);
  const raw = shuffle(m, b, salt);
  const prevLast = shuffle(m, b - 1, salt)[m - 1];
  const order = raw[0] === prevLast ? [raw[1], raw[0], ...raw.slice(2)] : raw;
  return order[n - b * m];
}

/** the theme favourite's days: Mon / Wed / Fri / Sun (4 of 7, never two in a row) */
const FAV_DAYS: readonly number[] = [0, 2, 4, 6];
const favOf = (date: DateKey, list: readonly OfficeBoss[]): number => {
  const fav = themeOf(weekOf(date)).emphasis.boss;
  return fav === undefined ? -1 : list.findIndex((b) => b.slot === fav);
};

function bossOfDay(date: DateKey, tier: ProgressTier): OfficeBoss {
  const list = candidates(tier);
  const m = list.length;
  const n = dayNo(date);
  const salt = `boss:t${tier}`;
  const fav = favOf(date, list);
  if (fav >= 0 && FAV_DAYS.includes(weekdayOf(date))) return list[fav];
  if (fav >= 0) {
    // between two favourite days: anyone but the favourite, by the date
    const others = list.filter((_, i) => i !== fav);
    return others[draw(date, salt) % others.length];
  }
  // a plain week; next to a favourite week's Sunday / Monday the favourite steps aside
  const pick = basePick(n, m, salt);
  const near = [favOf(addDays(date, -1), list), favOf(addDays(date, 1), list)];
  const touching = (weekdayOf(date) === 0 && near[0] >= 0) || (weekdayOf(date) === 6 && near[1] >= 0);
  const blocked = weekdayOf(date) === 0 ? near[0] : near[1];
  if (!touching || pick !== blocked) return list[pick];
  const neighbour = weekdayOf(date) === 0 ? basePick(n + 1, m, salt) : basePick(n - 1, m, salt);
  const free = list.map((_, i) => i).filter((i) => i !== blocked && i !== neighbour);
  return list[free[draw(date, salt) % free.length]];
}

/** the day's look: one of the places the player has reached */
function lookOfDay(date: DateKey, tier: ProgressTier, theme: ThemeId): Pick<StageDef, 'world' | 'variant'> {
  const reached = CHAPTERS.slice(0, tier);
  const outdoors = reached.filter((c) => c.part === 2);
  const pool = theme === 'rainy-commute' && outdoors.length > 0 ? outdoors : reached;
  const c = pool[draw(date, 'look') % pool.length];
  return { world: c.theme, variant: c.variant };
}

/** the opening two parts, by day (the finale is always last) */
const ORDERS: readonly (readonly ['dodge' | 'chase' | 'collect', 'dodge' | 'chase' | 'collect'])[] = [
  ['dodge', 'collect'], ['collect', 'dodge'], ['chase', 'collect'], ['collect', 'chase'],
];
/** moves a day may lean on (an intro-sized share) when the theme sets none; only unlocked ones are used */
const DAY_FOCUS: readonly MoveId[] = ['lane', 'slide', 'double', 'drone', 'drop', 'chaser', 'high', 'rear', 'lanejump'];
const pickOf = <T>(xs: readonly T[], r: number): T => xs[r % xs.length];

function titles(boss: OfficeBoss): Readonly<Record<'dodge' | 'chase' | 'finale', readonly string[]>> {
  return {
    dodge: [`${boss.name}의 기습`, `${boss.tag} 피하기`, `${boss.name} 따돌리기`, `${boss.tag} 세례`],
    chase: [`${boss.name} 추격전`, `"${boss.tag}" 추격`, `${boss.name}에게서 도망`],
    finale: [`${boss.name} 뛰어넘기`, `퇴근 직전 ${boss.tag}`, `마지막 관문, ${boss.name}`],
  };
}

function missionsOfDay(date: DateKey, tier: ProgressTier, boss: OfficeBoss): DailyPlan['missions'] {
  const emphasis = themeOf(weekOf(date)).emphasis;
  const unlocked = STAGES[tier - 1].moves;
  const hz = dailyHazards(tier);
  const has = (m: MoveId): boolean => unlocked.includes(m);
  const themed = (emphasis.focus ?? []).filter(has);
  const dayFocus = DAY_FOCUS.filter(has);
  const focus = themed.length > 0 ? themed : dayFocus.length > 0 ? [pickOf(dayFocus, draw(date, 'focus'))] : [];
  const withFocus = focus.length > 0 ? { focus } : {};
  const mul = Math.min(THEME_PICKUP_MAX, Math.max(1, emphasis.pickupMul ?? 1));
  const pick = (rate: number): number => Math.min(1, rate * mul);
  const item = emphasis.collectible ?? ITEMS[draw(date, 'item') % ITEMS.length];
  const t = titles(boss);
  const part = (kind: 'dodge' | 'chase' | 'collect'): MissionSpec => {
    if (kind === 'collect') {
      return {
        kind, title: ITEM_NAMES[item], target: DAILY_COLLECT_TARGET, hazards: hz[1],
        moves: COLLECT_MOVES.filter(has), collectible: item, ...COLLECT, line: `${ITEM_NAMES[item]} 좀 챙겨 와~`,
      };
    }
    const base = kind === 'dodge' ? DODGE : CHASE;
    return {
      kind, title: pickOf(t[kind], draw(date, `title:${kind}`)), target: hz[0], hazards: hz[0], moves: unlocked, ...withFocus,
      ...base, pickupRate: pick(base.pickupRate), line: boss.catchphrase,
    };
  };
  const finale: MissionSpec = {
    kind: 'finale', title: pickOf(t.finale, draw(date, 'title:finale')), target: hz[2], hazards: hz[2], moves: unlocked,
    ...withFocus, ...FINALE, pickupRate: pick(FINALE.pickupRate), line: `${boss.tag}!`,
  };
  const [a, b] = pickOf(ORDERS, draw(date, 'order'));
  return [part(a), part(b), finale];
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
    missions.find((m) => m.kind !== 'collect')?.focus ?? [],
  );
  return { date, tier: t, stage, missions, boss: { slot: boss.slot, name: boss.name, stage: boss.stage }, theme: theme.id };
}

/** one-entry cache: a run looks its daily up per judge event / view change (the plan is deterministic per id) */
let cached: { readonly id: string; readonly missions: DailyPlan['missions'] | undefined } | null = null;

/** the missions of a daily stage id (stage-missions.ts), else undefined; memoised by id */
export function dailyMissions(id: string): DailyPlan['missions'] | undefined {
  if (cached?.id === id) return cached.missions;
  const d = parseDailyId(id);
  const missions = d ? dailyPlan(d.date, d.tier).missions : undefined;
  cached = { id, missions };
  return missions;
}

// Office live events: what the live screens show, computed from the live save, the main save and today's date
// (pure; the screens only render these). Every rule comes from core/live — nothing is decided here.
import {
  CARD_POINTS, COSMETICS, addDays, goalFor, affordable, buyCosmetic, dailyPlan, dailyUnlocked, progressTier, stampCount, themeOf,
  weekOf, weekdayOf, type CardHistoryEntry, type CardMilestone, type Cosmetic, type CosmeticCategory, type DateKey,
  type LiveSave, type ProgressTier, type Reward, type ThemeId, type WeekKey,
} from '../../core/live';
import type { SaveData } from '../../../types';
import type { LiveLook } from '../../render/live-look';

const NO_STAMPS = [false, false, false, false, false, false, false] as const;

export interface GoalModel {
  readonly label: string;
  readonly value: number;
  readonly target: number;
  readonly done: boolean;
}

export interface TitleLiveModel {
  readonly today: DateKey;
  readonly unlocked: boolean;
  readonly dailyDone: boolean;
  readonly bossName: string;
  readonly themeName: string;
  readonly themeId: ThemeId;
  readonly cardCount: number;
  readonly goal: GoalModel;
  /** cosmetics the player could buy now */
  readonly newItems: number;
}

/** this week's stamps (a card from an earlier week counts as empty) */
export function weekStamps(live: LiveSave, week: WeekKey): readonly boolean[] {
  return live.card && live.card.week === week ? live.card.stamps : NO_STAMPS;
}

export function goalModel(live: LiveSave, week: WeekKey, tier: ProgressTier): GoalModel {
  const g = goalFor(week, tier);
  const p = live.goal && live.goal.week === week ? live.goal : null;
  return { label: g.label, value: Math.min(g.target, p?.value ?? 0), target: g.target, done: p?.done ?? false };
}

export function titleLiveModel(live: LiveSave, save: Pick<SaveData, 'stars' | 'coins'>, today: DateKey): TitleLiveModel {
  const tier = progressTier(save.stars);
  const week = weekOf(today);
  const unlocked = dailyUnlocked(tier);
  return {
    today,
    unlocked,
    dailyDone: live.daily[today]?.cleared ?? false,
    bossName: unlocked ? dailyPlan(today, tier).boss.name : '',
    themeName: themeOf(week).name,
    themeId: themeOf(week).id,
    cardCount: live.card && live.card.week === week ? stampCount(live.card) : 0,
    goal: goalModel(live, week, tier),
    newItems: affordable(live, save.coins, today).length,
  };
}

export interface MilestoneModel {
  readonly at: CardMilestone;
  readonly points: number;
  /** 5 stamps: this week's theme cosmetic */
  readonly cosmetic: string | null;
  /** 7 stamps: the 개근 badge */
  readonly badge: boolean;
  readonly reached: boolean;
}

export interface WeekCardModel {
  readonly week: WeekKey;
  readonly lastDay: DateKey;
  readonly stamps: readonly boolean[];
  /** today's slot (0 = Mon) */
  readonly today: number;
  readonly count: number;
  readonly milestones: readonly MilestoneModel[];
  readonly history: readonly CardHistoryEntry[];
  readonly themeName: string;
  readonly themeId: ThemeId;
  readonly goal: GoalModel;
  /** the equipped card theme's sprite key, null = plain */
  readonly cardTheme: string | null;
}

const MILESTONES: readonly CardMilestone[] = [3, 5, 7];

export function weekCardModel(live: LiveSave, today: DateKey, tier: ProgressTier): WeekCardModel {
  const week = weekOf(today);
  const theme = themeOf(week);
  const stamps = weekStamps(live, week);
  const count = stamps.filter(Boolean).length;
  const themeItem = COSMETICS.find((c) => c.id === goalFor(week, tier).cosmetic)?.name ?? null;
  return {
    week,
    lastDay: addDays(week, 6),
    stamps,
    today: weekdayOf(today),
    count,
    milestones: MILESTONES.map((at) => ({ at, points: CARD_POINTS[at], cosmetic: at === 5 ? themeItem : null, badge: at === 7, reached: count >= at })),
    history: live.history,
    themeName: theme.name,
    themeId: theme.id,
    goal: goalModel(live, week, tier),
    cardTheme: equippedSprite(live, 'cardTheme'),
  };
}

export type ItemState = 'equipped' | 'owned' | 'buy' | 'poor' | 'not-yet' | 'pass-only';

export interface MallItem {
  readonly item: Cosmetic;
  readonly state: ItemState;
}

export function equippedSprite(live: LiveSave, category: CosmeticCategory): string | null {
  const id = live.equipped[category];
  return id ? COSMETICS.find((c) => c.id === id)?.sprite ?? null : null;
}

function itemState(live: LiveSave, c: Cosmetic, coins: number, today: DateKey): ItemState {
  if (live.equipped[c.category] === c.id) return 'equipped';
  if (live.owned.includes(c.id)) return 'owned';
  if (c.exclusive) return 'pass-only';
  // the rules (theme items: from the week after their theme week) are core's; ask with unlimited points
  const r = buyCosmetic(live, c.id, Number.MAX_SAFE_INTEGER, today);
  if (!r.ok) return 'not-yet';
  return coins >= c.price ? 'buy' : 'poor';
}

/** `showExclusive`: the build can sell the 칼퇴 패스 (else pass items show only once owned) */
export function mallItems(live: LiveSave, coins: number, today: DateKey, category: CosmeticCategory, showExclusive = false): readonly MallItem[] {
  return COSMETICS.filter((c) => c.category === category && (!c.exclusive || showExclusive || live.owned.includes(c.id))).map((item) => ({ item, state: itemState(live, item, coins, today) }));
}

export function collection(live: LiveSave): { readonly owned: number; readonly total: number } {
  // pass items count only once owned: the 도감 never nudges toward a purchase (P4)
  const counted = COSMETICS.filter((c) => !c.exclusive || live.owned.includes(c.id));
  return { owned: counted.filter((c) => live.owned.includes(c.id)).length, total: counted.length };
}

/** the renderer's look: equipped trail / jump art keys and this week's theme flags */
export function lookOf(live: LiveSave, today: DateKey): LiveLook {
  const fx = themeOf(weekOf(today)).emphasis.fx;
  return { trail: equippedSprite(live, 'trail'), jump: equippedSprite(live, 'jump'), rain: fx?.rain ?? false, clock: fx?.clock ?? false };
}

/** the category's slot emptied (back to the default look) */
export function unequip(live: LiveSave, category: CosmeticCategory): LiveSave {
  if (!(category in live.equipped)) return live;
  const equipped = Object.fromEntries(Object.entries(live.equipped).filter(([k]) => k !== category));
  return { ...live, equipped };
}

/** the 칼퇴 포인트 in a reward list */
export function rewardPoints(rewards: readonly Reward[]): number {
  return rewards.reduce((n, r) => n + (r.kind === 'points' ? r.amount : 0), 0);
}

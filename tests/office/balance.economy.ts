// Live-events 칼퇴 포인트 economy model (docs/balance/live-economy.md). Pure arithmetic on the shipped constants plus
// two labelled assumptions: stray-coin pickups per run (no human data; bots pick up ~0–1) and how often a regular player
// completes the weekly goal. Income after the campaign is cleared (one-time progression rewards are listed apart).
import { CARD_POINTS, COSMETICS, DAILY_POINTS, DUPLICATE_POINTS, GOAL_POINTS } from '../../src/office/core/live';
import { MISSION_BONUS, STAGE_MISSIONS } from '../../src/office/core/missions';
import { ACH_REWARD, BOSS_CLEAR_COINS, STAR_COINS } from '../../src/core/economy';
import { ACHIEVEMENTS } from '../../src/core/achievements';
import { STAGES } from '../../src/core/content';

/** ESTIMATE: ₵ from stray coins per run for a human (bots: ~0–1) */
export const PICKUP_EST_PER_RUN = 10;

export interface PlayerModel {
  readonly label: string;
  /** daily missions cleared per week (each a card stamp) */
  readonly dailies: number;
  /** office runs per week (dailies + campaign replays) */
  readonly runs: number;
  /** ESTIMATE: share of weeks the weekly goal is completed */
  readonly goalShare: number;
}

export const REGULAR: PlayerModel = { label: '꾸준한 플레이어 (하루 1–2판)', dailies: 7, runs: 10, goalShare: 2 / 3 };
export const LIGHT: PlayerModel = { label: '가벼운 플레이어 (주 5일 1판)', dailies: 5, runs: 5, goalShare: 0 };

const themeItems = COSMETICS.filter((c) => c.theme !== undefined);
const shopItems = COSMETICS.filter((c) => c.theme === undefined && !c.exclusive); // the 칼퇴 패스 stamp is not sold for points
const sum = (xs: readonly number[]): number => xs.reduce((a, x) => a + x, 0);

/** ₵ per week once the campaign is done */
export function weeklyPoints(p: PlayerModel): number {
  const card = sum(([3, 5, 7] as const).filter((m) => p.dailies >= m).map((m) => CARD_POINTS[m]));
  // card-5 gives the theme item; a completed goal gives it again → DUPLICATE_POINTS (or the item itself without card-5)
  const goal = p.goalShare * (GOAL_POINTS + (p.dailies >= 5 ? DUPLICATE_POINTS : 0));
  return p.dailies * DAILY_POINTS + card + goal + p.runs * PICKUP_EST_PER_RUN;
}

/** free theme cosmetics per week (card-5 or the goal) */
export const freeItemsPerWeek = (p: PlayerModel): number => (p.dailies >= 5 ? 1 : p.goalShare);

export interface EconomySummary {
  readonly weekly: number;
  readonly shopTotal: number;
  readonly shopAvg: number;
  /** weeks to buy every non-theme item (theme items come free in their weeks) */
  readonly catalogWeeks: number;
  /** days per new cosmetic, bought or free */
  readonly daysPerItem: number;
}

export function summarise(p: PlayerModel): EconomySummary {
  const weekly = weeklyPoints(p);
  const shopTotal = sum(shopItems.map((c) => c.price));
  const shopAvg = shopTotal / shopItems.length;
  return { weekly, shopTotal, shopAvg, catalogWeeks: shopTotal / weekly, daysPerItem: 7 / (weekly / shopAvg + freeItemsPerWeek(p)) };
}

/** one-time ₵ from clearing the campaign with every stamp (first clears, stars, stamps, achievements) */
export function progressionPoints(): number {
  const stamps = sum(STAGES.map((s, i) => (STAGE_MISSIONS[s.id]?.length ?? 0) * MISSION_BONUS(i)));
  const ach = sum(ACHIEVEMENTS.map((a) => ACH_REWARD[a.id] ?? 0));
  return STAGES.length * BOSS_CLEAR_COINS + STAGES.length * 3 * STAR_COINS + stamps + ach;
}

export const catalogCount = { shop: shopItems.length, theme: themeItems.length };

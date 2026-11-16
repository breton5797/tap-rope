/**
 * Office live events (spec docs/superpowers/specs/2026-11-16-office-live-events-design.md): the shared CONTRACT
 * for the daily mission (오늘의 칼퇴 미션), the weekly attendance card (주간 출근 카드), the weekly theme and
 * goal (이번 주 이벤트), the cosmetics shop (사원 복지몰) and the live save. Types only; the functions live in
 * dates.ts, daily.ts, themes.ts, card.ts, cosmetics.ts, rewards.ts and save.ts (index.ts re-exports all).
 * - Pure and deterministic: every function takes the local date (DateKey) as input; nothing reads the clock
 *   except dates.ts `todayKey(now)`, which takes the Date to use.
 * - Fair (P1–P7): fixed-price exchange only, no random rewards, no streak that resets, nothing time-limited for
 *   good (a theme cosmetic is sold at its price from the week after its theme week).
 * - Office only: v8 never imports this folder.
 */
import type { BossId, MoveId, StageDef } from '../../../types';
import type { CollectibleId, MissionSpec } from '../missions';

/** a local calendar date "YYYY-MM-DD" (device clock, midnight boundary; no time zone / DST arithmetic) */
export type DateKey = string;
/** a week, named by the DateKey of its Monday (weeks run Monday → Sunday) */
export type WeekKey = string;
/** 0 = Monday … 6 = Sunday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ---------- daily mission ----------

/**
 * How far the player is in the campaign: the number of the highest cleared office stage (1..10). The daily
 * mission only uses moves taught up to that stage and is tuned for it. 0 = stage 1 not cleared (daily locked).
 */
export type ProgressTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface DailyPlan {
  readonly date: DateKey;
  readonly tier: ProgressTier;
  /** the StageDef to play (mode 'stage'); its id is DAILY_ID(date, tier), recognised by office levels / missions / boss */
  readonly stage: StageDef;
  /** the three missions of the day (one per section), the office mission system unchanged */
  readonly missions: readonly [MissionSpec, MissionSpec, MissionSpec];
  /** the superior of the day (one of the ten), speaks every section */
  readonly boss: { readonly slot: BossId; readonly name: string; readonly stage: number };
  /** the week's theme this plan was dressed for */
  readonly theme: ThemeId;
}

/** a day's own record (best score of the day; the first clear earns the day's reward once) */
export interface DailyRecord {
  readonly cleared: boolean;
  readonly best: number;
}

// ---------- weekly theme + goal ----------

export type ThemeId = 'monday-blues' | 'dodge-dinner' | 'paper-bomb' | 'speed-clockout' | 'sports-day' | 'rainy-commute';

/** what a run adds to the weekly goal (collected by src/office/game/live from the run's events) */
/** clears: any cleared office run (the rainy week's goal for a player who has not reached part 2 yet) */
export type GoalMetric = 'coffee' | 'dodge-dinner' | 'docs' | 'perfects' | 'jumps' | 'part2-clears' | 'clears';
export type LiveRunCounts = Readonly<Record<GoalMetric, number>>;

export interface WeeklyGoal {
  readonly metric: GoalMetric;
  readonly target: number;
  /** Korean, e.g. "커피 30잔 모으기" */
  readonly label: string;
  readonly points: number;
  /** the theme cosmetic given on completion */
  readonly cosmetic: CosmeticId;
}

/**
 * How a theme dresses the daily mission. Presentation and mix only, inside the fairness rules: no extra
 * hazards, no faster tempo, no new moves (every value is clamped by daily.ts).
 */
export interface ThemeEmphasis {
  /** multiplies the daily's pickup rate (≤ THEME_PICKUP_MAX) */
  readonly pickupMul?: number;
  /** the collect mission's item */
  readonly collectible?: CollectibleId;
  /** the superior of the day on most days of the week (else the date picks one) */
  readonly boss?: BossId;
  /** moves given an intro-sized share, only if the player has unlocked them */
  readonly focus?: readonly MoveId[];
  /** renderer flags (render worker): rain over part-2 backgrounds, a stronger clock */
  readonly fx?: { readonly rain?: boolean; readonly clock?: boolean };
}

export interface WeekTheme {
  readonly id: ThemeId;
  /** Korean title, e.g. "월요병 주간" */
  readonly name: string;
  readonly desc: string;
  readonly emphasis: ThemeEmphasis;
  readonly goal: WeeklyGoal;
}

export interface GoalProgress {
  readonly week: WeekKey;
  readonly value: number;
  readonly done: boolean;
}

// ---------- weekly attendance card ----------

export type CardMilestone = 3 | 5 | 7;

export interface WeekCard {
  readonly week: WeekKey;
  /** Monday … Sunday: a daily mission was cleared that day */
  readonly stamps: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
}

/** a past week in the 출근 기록부 */
export interface CardHistoryEntry {
  readonly week: WeekKey;
  readonly stamps: number;
}

// ---------- cosmetics ----------

export type CosmeticCategory = 'trail' | 'jump' | 'stamp' | 'cardTheme';
export type CosmeticId = string;

export interface Cosmetic {
  readonly id: CosmeticId;
  readonly category: CosmeticCategory;
  /** Korean display name */
  readonly name: string;
  /** 칼퇴 포인트, fixed (BALANCE tunes COSMETIC_PRICES) */
  readonly price: number;
  /** a theme item: given by that week's goal / card, sold from the week after its first theme week */
  readonly theme?: ThemeId;
  /** art: public-office/art/cosmetic/<sprite>.webp (ART) */
  readonly sprite: string;
}

export type BuyResult =
  | { readonly ok: true; readonly live: LiveSave; readonly cost: number }
  | { readonly ok: false; readonly reason: 'unknown' | 'owned' | 'poor' | 'not-yet' };

// ---------- rewards ----------

export type Reward =
  | { readonly kind: 'points'; readonly amount: number; readonly why: RewardWhy }
  | { readonly kind: 'cosmetic'; readonly id: CosmeticId; readonly why: RewardWhy }
  | { readonly kind: 'badge'; readonly week: WeekKey; readonly why: RewardWhy };
export type RewardWhy = 'daily' | 'card-3' | 'card-5' | 'card-7' | 'goal';

// ---------- save ----------

export const LIVE_SAVE_KEY = 'officeescape.live.v1';
export const LIVE_SAVE_VERSION = 1;

export interface LiveSave {
  readonly v: typeof LIVE_SAVE_VERSION;
  /** the latest date any reward was processed for: an earlier date (clock turned back) earns nothing */
  readonly maxDate: DateKey | null;
  /** recent days only (pruned to DAILY_KEEP_DAYS) */
  readonly daily: Readonly<Record<DateKey, DailyRecord>>;
  readonly card: WeekCard | null;
  /** past weeks, newest first (pruned to HISTORY_KEEP_WEEKS) */
  readonly history: readonly CardHistoryEntry[];
  readonly goal: GoalProgress | null;
  readonly owned: readonly CosmeticId[];
  readonly equipped: Readonly<Partial<Record<CosmeticCategory, CosmeticId>>>;
  /** 개근 배지: weeks with all 7 stamps */
  readonly badges: readonly WeekKey[];
  /** the first week each theme ran (a theme cosmetic is sold from the following week) */
  readonly themeSeen: Readonly<Partial<Record<ThemeId, WeekKey>>>;
  /** reward keys already paid ("daily:<date>", "card:<week>:<3|5|7>", "goal:<week>") */
  readonly ledger: readonly string[];
}

/** what a finished run did to the live save, for the result screen */
export interface LiveRunOutcome {
  readonly live: LiveSave;
  /** rewards earned by this run, in order; the caller adds the points to SaveData.coins */
  readonly rewards: readonly Reward[];
  /** the run was today's daily mission */
  readonly daily: boolean;
}

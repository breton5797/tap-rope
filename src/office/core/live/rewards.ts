/**
 * The run hook and the reward ledger (spec §1–3): a finished office run on `date` updates the day's record,
 * stamps the week card on the daily's first clear, adds to the weekly goal, and pays each reward once — the
 * ledger keys "daily:<date>", "card:<week>:<3|5|7>", "goal:<week>".
 * Clock changes (pt-flow P1): a date one day before the latest one seen (maxDate) changes nothing and earns
 * nothing (time zones, a retry past midnight). Further back is a clock reset — a clock once set forward must not
 * switch live rewards off until that date comes — so the save follows the clock: maxDate, the card, its history
 * and the goal go back to that date's week. The ledger still pays each date / week once, and it is pruned by
 * count (newest LEDGER_KEEP entries), never by date, so a stay in the future cannot make real days re-earnable.
 */
import type { CardMilestone, CosmeticId, DateKey, LiveRunCounts, LiveRunOutcome, LiveSave, ProgressTier, Reward, RewardWhy } from './types';
import type { RunSummaryLike } from './run-types';
import { daysBetween, weekOf } from './dates';
import { CARD_MILESTONES, CARD_POINTS, cardFor, stamp, stampCount } from './card';
import { DAILY_POINTS, parseDailyId } from './daily';
import { DAILY_KEEP_DAYS } from './save';
import { GOAL_POINTS, addGoalProgress, themeOf } from './themes';

/** BALANCE knob: a cosmetic reward the player already owns (the week's theme item twice) pays this instead */
export const DUPLICATE_POINTS = 100;

/** newest ledger entries kept (about 12 a week: ~8 months; ordered by when they were paid, not by date) */
const LEDGER_KEEP = 400;
/** a step back this many days or fewer is not a clock reset (it earns nothing and changes nothing) */
const STEP_BACK_DAYS = 1;

const back = (live: LiveSave, date: DateKey): number => (live.maxDate === null ? 0 : daysBetween(date, live.maxDate));
const stepBack = (live: LiveSave, date: DateKey): boolean => back(live, date) > 0 && back(live, date) <= STEP_BACK_DAYS;

/** the clock went back further than a step: drop what belongs to weeks after `date`'s (they come back with the clock) */
function resetTo(live: LiveSave, date: DateKey): LiveSave {
  if (back(live, date) <= STEP_BACK_DAYS) return live;
  const week = weekOf(date);
  return {
    ...live,
    maxDate: date,
    card: live.card && live.card.week > week ? null : live.card,
    history: live.history.filter((h) => h.week < week),
    goal: live.goal && live.goal.week > week ? null : live.goal,
  };
}

/** the save on opening the game on `date`: the card / goal move to the new week, the theme is recorded as seen */
export function rollover(live0: LiveSave, date: DateKey): LiveSave {
  if (stepBack(live0, date)) return live0;
  const live = resetTo(live0, date);
  const week = weekOf(date);
  const { card, history } = cardFor(live.card, live.history, date);
  const theme = themeOf(week).id;
  const goal = live.goal && live.goal.week === week ? live.goal : { week, value: 0, done: false };
  const themeSeen = live.themeSeen[theme] === undefined ? { ...live.themeSeen, [theme]: week } : live.themeSeen;
  return { ...live, maxDate: date, card, history, goal, themeSeen };
}

interface Pay { readonly live: LiveSave; readonly rewards: readonly Reward[] }

/** pays `rewards` once under `key` (cosmetics are added to owned; an owned one pays DUPLICATE_POINTS instead) */
function pay(acc: Pay, key: string, rewards: readonly Reward[]): Pay {
  if (acc.live.ledger.includes(key)) return acc;
  const given = rewards.map((r): Reward => {
    if (r.kind !== 'cosmetic' || !acc.live.owned.includes(r.id)) return r;
    return { kind: 'points', amount: DUPLICATE_POINTS, why: r.why };
  });
  const owned = [...acc.live.owned, ...given.flatMap((r) => (r.kind === 'cosmetic' ? [r.id] : []))];
  const badges = [...acc.live.badges, ...given.flatMap((r) => (r.kind === 'badge' ? [r.week] : []))];
  return { live: { ...acc.live, owned, badges, ledger: [...acc.live.ledger, key] }, rewards: [...acc.rewards, ...given] };
}

const themeItem = (date: DateKey, why: RewardWhy): Reward => ({ kind: 'cosmetic', id: themeOf(weekOf(date)).goal.cosmetic as CosmeticId, why });

function cardRewards(acc: Pay, date: DateKey): Pay {
  const card = acc.live.card;
  if (!card) return acc;
  const n = stampCount(card);
  return CARD_MILESTONES.filter((m) => n >= m).reduce((a, m: CardMilestone) => {
    const why = `card-${m}` as RewardWhy;
    const extra: Reward[] = m === 5 ? [themeItem(date, why)] : m === 7 ? [{ kind: 'badge', week: card.week, why }] : [];
    return pay(a, `card:${card.week}:${m}`, [{ kind: 'points', amount: CARD_POINTS[m], why }, ...extra]);
  }, acc);
}

/** keeps the newest entries by insertion (clock-independent) */
function prune(live: LiveSave): LiveSave {
  const daily = Object.fromEntries(Object.entries(live.daily).slice(-DAILY_KEEP_DAYS));
  return { ...live, daily, ledger: live.ledger.slice(-LEDGER_KEEP) };
}

/** a finished run (any office stage or the daily) on `date`: daily record + card stamp + weekly goal + rewards */
export function applyRun(live0: LiveSave, run: RunSummaryLike, counts: LiveRunCounts, date: DateKey, tier: ProgressTier): LiveRunOutcome {
  const plan = run.stageId ? parseDailyId(run.stageId) : null;
  const isDaily = plan !== null && plan.date === date;
  if (stepBack(live0, date)) return { live: live0, rewards: [], daily: isDaily };
  let acc: Pay = { live: rollover(live0, date), rewards: [] };
  if (isDaily) {
    const prev = acc.live.daily[date];
    const record = { cleared: (prev?.cleared ?? false) || run.cleared, best: Math.max(prev?.best ?? 0, run.score) };
    // re-inserted last, so the insertion-order prune keeps the days played most recently
    const { [date]: _old, ...others } = acc.live.daily;
    acc = { ...acc, live: { ...acc.live, daily: { ...others, [date]: record } } };
    if (run.cleared && !acc.live.ledger.includes(`daily:${date}`)) {
      acc = pay(acc, `daily:${date}`, [{ kind: 'points', amount: DAILY_POINTS, why: 'daily' }]);
      acc = acc.live.card ? { ...acc, live: { ...acc.live, card: stamp(acc.live.card, date) } } : acc;
      acc = cardRewards(acc, date);
    }
  }
  const week = weekOf(date);
  const goal = addGoalProgress(acc.live.goal, week, counts, tier);
  acc = { ...acc, live: { ...acc.live, goal } };
  if (goal.done) acc = pay(acc, `goal:${week}`, [{ kind: 'points', amount: GOAL_POINTS, why: 'goal' }, themeItem(date, 'goal')]);
  return { live: prune(acc.live), rewards: acc.rewards, daily: isDaily };
}

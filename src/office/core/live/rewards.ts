/**
 * The run hook and the reward ledger (spec §1–3): a finished office run on `date` updates the day's record,
 * stamps the week card on the daily's first clear, adds to the weekly goal, and pays each reward once — the
 * ledger keys "daily:<date>", "card:<week>:<3|5|7>", "goal:<week>". A date before the latest one seen
 * (maxDate: the clock turned back) changes nothing and earns nothing.
 */
import type { CardMilestone, CosmeticId, DateKey, LiveRunCounts, LiveRunOutcome, LiveSave, ProgressTier, Reward, RewardWhy } from './types';
import type { RunSummaryLike } from './run-types';
import { addDays, weekOf } from './dates';
import { CARD_MILESTONES, CARD_POINTS, cardFor, stamp, stampCount } from './card';
import { cosmeticById } from './cosmetics';
import { DAILY_POINTS, parseDailyId } from './daily';
import { DAILY_KEEP_DAYS } from './save';
import { GOAL_POINTS, addGoalProgress, themeOf } from './themes';

/** ledger entries older than this many days before maxDate are dropped (maxDate already blocks them) */
const LEDGER_KEEP_DAYS = 70;

const isBefore = (live: LiveSave, date: DateKey): boolean => live.maxDate !== null && date < live.maxDate;

/** the save on opening the game on `date`: the card / goal move to the new week, the theme is recorded as seen */
export function rollover(live: LiveSave, date: DateKey): LiveSave {
  if (isBefore(live, date)) return live;
  const week = weekOf(date);
  const { card, history } = cardFor(live.card, live.history, date);
  const theme = themeOf(week).id;
  const goal = live.goal && live.goal.week === week ? live.goal : { week, value: 0, done: false };
  const themeSeen = live.themeSeen[theme] === undefined ? { ...live.themeSeen, [theme]: week } : live.themeSeen;
  return { ...live, maxDate: date, card, history, goal, themeSeen };
}

interface Pay { readonly live: LiveSave; readonly rewards: readonly Reward[] }

/** pays `rewards` once under `key` (cosmetics are added to owned; an owned one pays its price instead) */
function pay(acc: Pay, key: string, rewards: readonly Reward[]): Pay {
  if (acc.live.ledger.includes(key)) return acc;
  const given = rewards.map((r): Reward => {
    if (r.kind !== 'cosmetic' || !acc.live.owned.includes(r.id)) return r;
    return { kind: 'points', amount: cosmeticById(r.id)?.price ?? 0, why: r.why };
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

function prune(live: LiveSave, date: DateKey): LiveSave {
  const keepDay = addDays(date, -DAILY_KEEP_DAYS);
  const keepLedger = addDays(date, -LEDGER_KEEP_DAYS);
  const daily = Object.fromEntries(Object.entries(live.daily).filter(([d]) => d > keepDay));
  const ledger = live.ledger.filter((k) => (/\d{4}-\d{2}-\d{2}/.exec(k)?.[0] ?? date) >= keepLedger);
  return { ...live, daily, ledger };
}

/** a finished run (any office stage or the daily) on `date`: daily record + card stamp + weekly goal + rewards */
export function applyRun(live0: LiveSave, run: RunSummaryLike, counts: LiveRunCounts, date: DateKey, _tier: ProgressTier): LiveRunOutcome {
  const plan = run.stageId ? parseDailyId(run.stageId) : null;
  const isDaily = plan !== null && plan.date === date;
  if (isBefore(live0, date)) return { live: live0, rewards: [], daily: isDaily };
  let acc: Pay = { live: rollover(live0, date), rewards: [] };
  if (isDaily) {
    const prev = acc.live.daily[date];
    const record = { cleared: (prev?.cleared ?? false) || run.cleared, best: Math.max(prev?.best ?? 0, run.score) };
    acc = { ...acc, live: { ...acc.live, daily: { ...acc.live.daily, [date]: record } } };
    if (run.cleared && !acc.live.ledger.includes(`daily:${date}`)) {
      acc = pay(acc, `daily:${date}`, [{ kind: 'points', amount: DAILY_POINTS, why: 'daily' }]);
      acc = acc.live.card ? { ...acc, live: { ...acc.live, card: stamp(acc.live.card, date) } } : acc;
      acc = cardRewards(acc, date);
    }
  }
  const week = weekOf(date);
  const goal = addGoalProgress(acc.live.goal, week, counts);
  acc = { ...acc, live: { ...acc.live, goal } };
  if (goal.done) acc = pay(acc, `goal:${week}`, [{ kind: 'points', amount: GOAL_POINTS, why: 'goal' }, themeItem(date, 'goal')]);
  return { live: prune(acc.live, date), rewards: acc.rewards, daily: isDaily };
}

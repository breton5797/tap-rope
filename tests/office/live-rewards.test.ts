// The live run hook and ledger: the daily's first clear pays once and stamps the week card; 3 / 5 / 7 stamps pay
// once each (5 = the week's theme cosmetic, 7 = 개근 배지); the weekly goal pays once; a missed day loses
// nothing; Monday brings a new card (the old one goes to the 출근 기록부); turning the clock back earns nothing.
import { describe, expect, it } from 'vitest';
import {
  CARD_POINTS, DAILY_POINTS, DUPLICATE_POINTS, GOAL_POINTS, addDays, goalFor, applyRun, cosmeticById, dailyPlan, emptyLive, rollover, stampCount, themeOf,
  type LiveRunCounts, type LiveSave, type Reward,
} from '../../src/office/core/live';

const ZERO: LiveRunCounts = { coffee: 0, 'dodge-dinner': 0, docs: 0, perfects: 0, jumps: 0, 'part2-clears': 0, clears: 0 };
const MON = '2026-11-16';
const daily = (date: string, cleared = true, score = 1000) => ({ stageId: dailyPlan(date, 4).stage.id, cleared, score });
const campaign = (cleared = true) => ({ stageId: 'w3-s10', cleared, score: 500 });
const points = (rs: readonly Reward[]) => rs.reduce((n, r) => n + (r.kind === 'points' ? r.amount : 0), 0);

/** clears the daily on each of `days` (offsets from MON), carrying the save */
function week(days: readonly number[], start: LiveSave = emptyLive()): { live: LiveSave; rewards: Reward[] } {
  return days.reduce<{ live: LiveSave; rewards: Reward[] }>((acc, d) => {
    const date = addDays(MON, d);
    const out = applyRun(acc.live, daily(date), ZERO, date, 4);
    return { live: out.live, rewards: [...acc.rewards, ...out.rewards] };
  }, { live: start, rewards: [] });
}

describe('daily mission rewards', () => {
  it('the first clear of the day pays DAILY_POINTS and stamps the card; replays keep the best score only', () => {
    const a = applyRun(emptyLive(), daily(MON, true, 800), ZERO, MON, 4);
    expect(a.daily).toBe(true);
    expect(a.rewards).toEqual([{ kind: 'points', amount: DAILY_POINTS, why: 'daily' }]);
    expect(a.live.card?.stamps[0]).toBe(true);
    expect(a.live.daily[MON]).toEqual({ cleared: true, best: 800 });
    const b = applyRun(a.live, daily(MON, true, 1200), ZERO, MON, 4);
    expect(b.rewards).toEqual([]);
    expect(b.live.daily[MON]).toEqual({ cleared: true, best: 1200 });
    expect(applyRun(b.live, daily(MON, true, 300), ZERO, MON, 4).live.daily[MON].best).toBe(1200);
  });

  it('a failed daily pays nothing and stamps nothing; a campaign run is not a daily', () => {
    const f = applyRun(emptyLive(), daily(MON, false, 400), ZERO, MON, 4);
    expect(f.rewards).toEqual([]);
    expect(f.live.daily[MON]).toEqual({ cleared: false, best: 400 });
    expect(stampCount(f.live.card!)).toBe(0);
    const c = applyRun(emptyLive(), campaign(), ZERO, MON, 4);
    expect(c.daily).toBe(false);
    expect(c.rewards).toEqual([]);
  });

  it('the daily of yesterday finished after midnight is not the daily of today', () => {
    const late = applyRun(emptyLive(), daily(addDays(MON, -1)), ZERO, MON, 4);
    expect(late.daily).toBe(false);
    expect(late.rewards).toEqual([]);
  });
});

describe('weekly card', () => {
  it('pays 3 / 5 / 7 once each; 5 gives the theme cosmetic of the week, 7 the 개근 배지', () => {
    const { live, rewards } = week([0, 1, 2, 3, 4, 5, 6]);
    const theme = themeOf(MON);
    expect(rewards.filter((r) => r.why === 'card-3')).toEqual([{ kind: 'points', amount: CARD_POINTS[3], why: 'card-3' }]);
    expect(rewards.filter((r) => r.why === 'card-5')).toEqual([
      { kind: 'points', amount: CARD_POINTS[5], why: 'card-5' },
      { kind: 'cosmetic', id: theme.goal.cosmetic, why: 'card-5' },
    ]);
    expect(rewards.filter((r) => r.why === 'card-7')).toEqual([
      { kind: 'points', amount: CARD_POINTS[7], why: 'card-7' },
      { kind: 'badge', week: MON, why: 'card-7' },
    ]);
    expect(points(rewards)).toBe(7 * DAILY_POINTS + CARD_POINTS[3] + CARD_POINTS[5] + CARD_POINTS[7]);
    expect(live.owned).toContain(theme.goal.cosmetic);
    expect(live.badges).toEqual([MON]);
    expect(stampCount(live.card!)).toBe(7);
  });

  it('missed days lose nothing: any three days reach the 3-stamp reward', () => {
    const { rewards, live } = week([0, 3, 6]);
    expect(rewards.some((r) => r.why === 'card-3')).toBe(true);
    expect(live.card!.stamps).toEqual([true, false, false, true, false, false, true]);
  });

  it('Monday brings a new card; the old one goes to the 출근 기록부 (newest first)', () => {
    const first = week([0, 1, 2]).live;
    const next = rollover(first, addDays(MON, 7));
    expect(next.card).toEqual({ week: addDays(MON, 7), stamps: [false, false, false, false, false, false, false] });
    expect(next.history).toEqual([{ week: MON, stamps: 3 }]);
    const later = rollover(applyRun(next, daily(addDays(MON, 8)), ZERO, addDays(MON, 8), 4).live, addDays(MON, 21));
    expect(later.history.map((h) => h.week)).toEqual([addDays(MON, 7), MON]);
    // a skipped week leaves no empty entry
    expect(later.history).toEqual([{ week: addDays(MON, 7), stamps: 1 }, { week: MON, stamps: 3 }]);
  });

  it('a theme cosmetic already owned pays a fixed DUPLICATE_POINTS instead (a nice touch, not an income)', () => {
    const theme = themeOf(MON);
    const owned = { ...emptyLive(), owned: [theme.goal.cosmetic] };
    const { rewards } = week([0, 1, 2, 3, 4], owned);
    expect(rewards.filter((r) => r.why === 'card-5')).toEqual([
      { kind: 'points', amount: CARD_POINTS[5], why: 'card-5' },
      { kind: 'points', amount: DUPLICATE_POINTS, why: 'card-5' },
    ]);
    expect(DUPLICATE_POINTS).toBeLessThan(cosmeticById(theme.goal.cosmetic)!.price);
  });
});

describe('weekly goal', () => {
  it('every office run counts; completing it pays GOAL_POINTS + the theme cosmetic once', () => {
    const goal = themeOf(MON).goal;
    const half = { ...ZERO, [goal.metric]: Math.ceil(goal.target / 2) };
    const a = applyRun(emptyLive(), campaign(false), half, MON, 4);
    expect(a.rewards).toEqual([]);
    expect(a.live.goal).toMatchObject({ week: MON, done: false });
    const b = applyRun(a.live, campaign(), half, addDays(MON, 2), 4);
    expect(b.rewards).toEqual([{ kind: 'points', amount: GOAL_POINTS, why: 'goal' }, { kind: 'cosmetic', id: goal.cosmetic, why: 'goal' }]);
    expect(applyRun(b.live, campaign(), half, addDays(MON, 3), 4).rewards).toEqual([]);
  });
});

describe('clock turned back', () => {
  it('a step back of one day (time zones, a late-night retry) earns nothing and changes nothing', () => {
    const now = week([0, 1, 2, 3]).live;
    expect(now.maxDate).toBe(addDays(MON, 3));
    const out = applyRun(now, daily(addDays(MON, 2)), { ...ZERO, coffee: 99 }, addDays(MON, 2), 4);
    expect(out.rewards).toEqual([]);
    expect(out.live).toEqual(now);
    expect(rollover(now, addDays(MON, 2))).toEqual(now);
    expect(applyRun(now, daily(addDays(MON, 4)), ZERO, addDays(MON, 4), 4).rewards.length).toBeGreaterThan(0);
  });

  it('further back is a clock reset: the save follows the clock, but no day or week pays twice', () => {
    const now = week([0, 1, 2, 3]).live;
    // days already earned stay earned
    for (const d of [0, 1]) expect(applyRun(now, daily(addDays(MON, d)), ZERO, addDays(MON, d), 4).rewards, `day ${d}`).toEqual([]);
    const back = applyRun(now, daily(addDays(MON, 1)), ZERO, addDays(MON, 1), 4).live;
    expect(back.maxDate).toBe(addDays(MON, 1));
    // a day never earned pays once (spec §0: the clock can be fiddled, each date pays once)
    const earlier = applyRun(now, daily(addDays(MON, -5)), ZERO, addDays(MON, -5), 4);
    expect(earlier.rewards.filter((r) => r.why === 'daily')).toHaveLength(1);
    expect(earlier.live.card?.week).toBe(addDays(MON, -7));
  });

  it('P1: a clock set FORWARD once does not switch live rewards off when it comes back', () => {
    const today = '2026-11-16';
    const future = '2030-01-07';
    let live = applyRun(emptyLive(), daily(today), ZERO, today, 4).live;
    live = applyRun(live, daily(future), ZERO, future, 4).live;
    expect(live.maxDate).toBe(future);
    // back to the real date: the next day's daily pays and stamps this week's card
    const back = applyRun(live, daily('2026-11-17'), ZERO, '2026-11-17', 4);
    expect(back.rewards.filter((r) => r.why === 'daily')).toEqual([{ kind: 'points', amount: DAILY_POINTS, why: 'daily' }]);
    expect(back.live.maxDate).toBe('2026-11-17');
    expect(back.live.card?.week).toBe(today);
    expect(back.live.card?.stamps[1]).toBe(true);
    expect(back.live.history.every((h) => h.week <= today)).toBe(true);
    expect(back.live.goal?.week).toBe(today);
    // the day earned before the jump does not pay again
    expect(applyRun(back.live, daily(today), ZERO, today, 4).rewards).toEqual([]);
    // forward again: the future day already paid stays paid; a new future day pays
    const again = rollover(back.live, future);
    expect(applyRun(again, daily(future), ZERO, future, 4).rewards).toEqual([]);
    expect(applyRun(again, daily('2030-01-08'), ZERO, '2030-01-08', 4).rewards.some((r) => r.why === 'daily')).toBe(true);
  });

  it('the ledger is pruned by count, not by date: a long stay in the future cannot make real days re-earnable', () => {
    let live = applyRun(emptyLive(), daily(MON), ZERO, MON, 4).live;
    for (let d = 0; d < 120; d += 1) {
      const date = addDays('2030-01-07', d);
      live = applyRun(live, daily(date), ZERO, date, 4).live;
    }
    const back = rollover(live, addDays(MON, 1));
    expect(applyRun(back, daily(MON), ZERO, MON, 4).rewards).toEqual([]);
  });

  it('the same day twice in a row pays once even across a reload (ledger)', () => {
    const a = applyRun(emptyLive(), daily(MON), ZERO, MON, 4);
    const reloaded = JSON.parse(JSON.stringify(a.live)) as LiveSave;
    expect(applyRun(reloaded, daily(MON), ZERO, MON, 4).rewards).toEqual([]);
  });
});

describe('weekly goal for every player', () => {
  it('the rainy week (2부 단계 3번) counts any clear for a player who has not reached part 2', () => {
    const rainy = Array.from({ length: 6 }, (_, i) => addDays(MON, 7 * i)).find((w) => themeOf(w).id === 'rainy-commute')!;
    expect(goalFor(rainy, 4).label).not.toContain('2부');
    expect(goalFor(rainy, 7).label).toContain('2부');
    const clear = { ...ZERO, clears: 1 };
    let low = emptyLive();
    for (let i = 0; i < 3; i += 1) low = applyRun(low, campaign(), clear, addDays(rainy, i), 4).live;
    expect(low.goal).toMatchObject({ week: rainy, done: true });
    let high = emptyLive();
    for (let i = 0; i < 3; i += 1) high = applyRun(high, campaign(), clear, addDays(rainy, i), 7).live;
    expect(high.goal).toMatchObject({ week: rainy, value: 0, done: false });
    // other weeks keep one goal for everyone
    expect(goalFor(MON, 1)).toEqual(themeOf(MON).goal);
  });
});

describe('rollover', () => {
  it('records the theme week as seen (theme items go on sale the week after)', () => {
    const live = rollover(emptyLive(), MON);
    expect(live.themeSeen[themeOf(MON).id]).toBe(MON);
    expect(rollover(rollover(live, addDays(MON, 42)), addDays(MON, 43)).themeSeen[themeOf(MON).id]).toBe(MON);
  });
});

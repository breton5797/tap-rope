// The daily mission is fair on every date: the reference bot clears it with every hire, at every tier, and a
// human-pace player can reach target + 2 items in its collect part (the campaign's clearability rules).
import { describe, expect, it } from 'vitest';
import { botAction } from '../../src/game/bot';
import { createSession, lane, step, swipe, tap, type Session } from '../../src/game/session';
import { generateStage } from '../../src/core/levels';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import { laneReach } from '../../src/core/spacing';
import { addDays, dailyPlan, type ProgressTier } from '../../src/office/core/live';
import { HAZARD_KINDS, type Beat, type LaneId } from '../../src/types';

const DT = 1 / 60;
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
/** 60 dates two days apart, each at a tier cycling 1..10 */
const CASES = Array.from({ length: 60 }, (_, i) => ({ date: addDays('2026-11-16', i * 2), tier: ((i % 10) + 1) as ProgressTier }));

function play(s0: Session): Session {
  let s = s0;
  for (let i = 0; i < 60 * 300 && s.status === 'playing'; i += 1) {
    const a = botAction(s);
    if (a?.lane) s = lane(s, a.lane).session;
    else if (a) {
      s = tap(s).session;
      if (a.swipe) s = swipe(s, a.swipe).session;
    }
    s = step(s, DT).session;
  }
  return s;
}

describe('daily mission clearability', () => {
  it.each(['kid', 'cat', 'bunny', 'robot'] as const)('%s: the bot clears the daily on 60 dates across all tiers', (skin) => {
    const failed = CASES.filter(({ date, tier }) => play(createSession('stage', dailyPlan(date, tier).stage, { skin })).status !== 'cleared');
    expect(failed).toEqual([]);
  }, 120_000);

  it('a human-pace player reaches target + 2 items in the collect part on every date', () => {
    for (const { date, tier } of CASES) {
      const p = dailyPlan(date, tier);
      const { beats } = generateStage(p.stage, DEFAULT_PHYSICS, 2);
      let can: readonly LaneId[] = [0, 1, 2];
      let at = Number.NEGATIVE_INFINITY;
      let got = 0;
      const k = p.missions.findIndex((m) => m.kind === 'collect');
      for (const b of beats.filter((x) => x.part === k)) {
        const coin = b.obstacles.find((o) => o.kind === 'coin');
        const reach = laneReach(can, b.time - at, isHazard(b) ? b.blockedLanes : []);
        at = b.time;
        if (isHazard(b)) {
          expect(reach.length, `${date} t${tier}: trapped`).toBeGreaterThan(0);
          can = reach;
        } else if (coin && reach.includes(coin.lanes![0])) {
          got += 1;
          can = [coin.lanes![0]];
        } else can = reach;
      }
      expect(got, `${date} t${tier}`).toBeGreaterThanOrEqual(p.missions[k].target + 2);
    }
  });
});

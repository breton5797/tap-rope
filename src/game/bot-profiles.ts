/**
 * Skill-profiled autoplayers for balance measurement (office part-2 spec §4). Each profile wraps the
 * reference bot (game/bot.ts, near perfect) and degrades it the way a human player degrades:
 * - timing noise: every input decision is taken on a time-shifted view of the session (shift ~ N(bias, sd),
 *   + = early), one draw per target beat, plus a smaller independent jitter per air boost;
 * - reaction delay: a sudden hazard (drop / chaser / rear beam — the ones that only show "!" WARN_LEAD ahead)
 *   is invisible to the bot until WARN_LEAD − reaction before its beat;
 * - missed input: with probability missP × move weight the bot never sees a hazard beat (no input for it);
 * - wrong action: with probability wrongP × move weight it answers the wrong move (jump ↔ slide, one boost
 *   short, hopping into a drone); both scale up when the hazard follows the previous one closely (pressure);
 * - coins: with BotOptions.seekCoin (a collect mission), it goes for a coin with probability greed, as a 1단
 *   jump in the coin's lane — timing noise and swipe errors apply as for hazards;
 * - lane-swipe error: a lane swipe goes the wrong way once per lane beat with probability laneErrP, and swipes
 *   are no faster than laneSettle apart.
 * Every random draw is a pure function of (run seed, beat id, salt), so a run is reproducible. The numbers are
 * estimates, not fitted to human play data (docs/balance/bot-profiles.md).
 */
import type { Beat, LaneDir, MoveId } from '../types';
import { WARN_LEAD } from '../types';
import { hashString, mulberry32 } from '../core/rng';
import { moveForBeat } from '../core/moves';
import { isSudden } from '../core/timeline';
import { botAction, type BotAction } from './bot';
import type { Session } from './session';

export type ProfileId = 'casual' | 'normal' | 'expert';

export interface SkillProfile {
  readonly id: ProfileId;
  readonly label: string;
  /** s, sd of the per-beat input timing offset */
  readonly timingSd: number;
  /** s, mean offset (+ = early); humans tend to tap slightly early on a visible rhythm */
  readonly timingBias: number;
  /** s, sd of the extra per-boost jitter on multi-level jumps */
  readonly boostSd: number;
  /** s, reaction time to a sudden hazard's "!" (normal, clamped at reactionMin) */
  readonly reactionMean: number;
  readonly reactionSd: number;
  readonly reactionMin: number;
  /** per hazard beat (× move weight): no input at all */
  readonly missP: number;
  /** per hazard beat (× move weight): the wrong move */
  readonly wrongP: number;
  /** per lane beat: the first swipe goes the wrong way */
  readonly laneErrP: number;
  /** s, minimum time between two lane swipes */
  readonly laneSettle: number;
  /** probability of going for a coin the run asks to collect (BotOptions.seekCoin) */
  readonly greed: number;
}

export interface BotOptions {
  /** coins the player tries to take (e.g. the coins of a collect mission); none by default, like botAction */
  readonly seekCoin?: (b: Beat) => boolean;
}

/** relative error weight per move (1 = a plain jump); estimates of how often each move trips players up */
export const MOVE_WEIGHT: Readonly<Record<MoveId, number>> = {
  jump: 1, beam: 1, slide: 1, lane: 1, double: 1.3, drone: 1.2, high: 1.3, drop: 1.5, gate: 1.5, pulse: 1.5,
  chaser: 1.6, triple: 1.8, rear: 1.8, lanejump: 2,
};

/**
 * time pressure: a hazard less than PRESSURE_GAP s after the previous one gets up to (1 + PRESSURE_GAIN)× the
 * miss / wrong probability (linear in how short the gap is) — rushed sequences are where people slip
 */
export const PRESSURE_GAP = 0.9;
export const PRESSURE_GAIN = 1;
const pressure = (gap: number): number => 1 + PRESSURE_GAIN * Math.max(0, Math.min(1, (PRESSURE_GAP - gap) / PRESSURE_GAP));

export const PROFILES: Readonly<Record<ProfileId, SkillProfile>> = {
  casual: {
    id: 'casual', label: '캐주얼', timingSd: 0.07, timingBias: 0.01, boostSd: 0.035,
    reactionMean: 0.45, reactionSd: 0.12, reactionMin: 0.25,
    missP: 0.02, wrongP: 0.015, laneErrP: 0.08, laneSettle: 0.16, greed: 0.85,
  },
  normal: {
    id: 'normal', label: '보통', timingSd: 0.045, timingBias: 0.005, boostSd: 0.022,
    reactionMean: 0.35, reactionSd: 0.08, reactionMin: 0.2,
    missP: 0.008, wrongP: 0.006, laneErrP: 0.04, laneSettle: 0.13, greed: 0.92,
  },
  expert: {
    id: 'expert', label: '숙련', timingSd: 0.02, timingBias: 0, boostSd: 0.01,
    reactionMean: 0.25, reactionSd: 0.05, reactionMin: 0.15,
    missP: 0.0015, wrongP: 0.001, laneErrP: 0.01, laneSettle: 0.1, greed: 0.97,
  },
};

export const PROFILE_IDS: readonly ProfileId[] = ['casual', 'normal', 'expert'];

export type BotFn = (s: Session) => BotAction | null;

const isPickupOnly = (b: Beat): boolean =>
  b.requiredLevel === 0 && !b.needsSlide && b.blockedLanes.length === 0 && !b.obstacles.some((o) => o.kind === 'drone');
const isLaneOnly = (b: Beat): boolean =>
  b.blockedLanes.length > 0 && b.requiredLevel === 0 && !b.needsSlide && !b.obstacles.some((o) => o.kind === 'drone');

/** the beat as a player who answered it with the wrong move sees it */
function wrongView(b: Beat): Beat | null {
  if (b.needsSlide) return { ...b, needsSlide: false, requiredLevel: 1 };
  if (b.requiredLevel >= 2) return { ...b, requiredLevel: (b.requiredLevel - 1) as Beat['requiredLevel'] };
  if (b.requiredLevel === 1) return { ...b, needsSlide: true };
  if (b.obstacles.some((o) => o.kind === 'drone')) return { ...b, requiredLevel: 2 };
  return null; // a lane-only beat: its error is the wrong-way swipe (laneErrP) or a miss
}

/** a coin the player goes for, seen as a 1단 jump in the coin's lane (the other lanes "blocked") */
function coinView(b: Beat): Beat | null {
  const c = b.obstacles.find((o) => o.kind === 'coin' && o.lanes?.length === 1);
  if (!c?.lanes) return null;
  const lane = c.lanes[0];
  return { ...b, requiredLevel: c.level, blockedLanes: ([0, 1, 2] as const).filter((l) => l !== lane) };
}

interface BeatPlan {
  /** null = never seen (missed input) */
  readonly view: Beat | null;
  /** stage time from which the bot sees the beat */
  readonly visibleFrom: number;
  readonly offset: number;
  readonly laneErr: boolean;
}

/**
 * A profile's autoplayer for one run. The returned function is called once per frame like botAction; it keeps a
 * per-run cache of the per-beat draws (each draw is a pure function of the seed and the beat, so the cache only
 * saves work) and which beats already had their wrong-way swipe.
 */
export function createSkilledBot(profile: SkillProfile, seed: number, opts: BotOptions = {}): BotFn {
  const plans = new Map<number, BeatPlan>();
  const swiped = new Set<number>();
  const draw = (id: number, salt: string): number => mulberry32(hashString(`${seed >>> 0}:${id}:${salt}`))();
  const gauss = (id: number, salt: string): number => {
    const u = Math.max(1e-12, draw(id, `${salt}a`));
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * draw(id, `${salt}b`));
  };

  const planFor = (b: Beat, gap = Infinity): BeatPlan => {
    const cached = plans.get(b.id);
    if (cached) return cached;
    const hazard = !isPickupOnly(b);
    if (!hazard) {
      const wants = opts.seekCoin?.(b) === true && draw(b.id, 'greed') < profile.greed;
      const coin = wants ? coinView(b) : null;
      const plan: BeatPlan = coin
        ? { view: coin, visibleFrom: -Infinity, offset: profile.timingBias + profile.timingSd * gauss(b.id, 'time'), laneErr: draw(b.id, 'lane') < profile.laneErrP }
        : { view: b, visibleFrom: -Infinity, offset: 0, laneErr: false };
      plans.set(b.id, plan);
      return plan;
    }
    const w = MOVE_WEIGHT[moveForBeat(b)] * pressure(gap);
    const roll = draw(b.id, 'err');
    const missed = roll < profile.missP * w;
    const wrong = !missed && roll < (profile.missP + profile.wrongP) * w;
    const sudden = b.obstacles.some(isSudden);
    const reaction = Math.max(profile.reactionMin, profile.reactionMean + profile.reactionSd * gauss(b.id, 'react'));
    const view = missed ? null : wrong ? wrongView(b) ?? (isLaneOnly(b) ? null : b) : b;
    const plan: BeatPlan = {
      view,
      visibleFrom: sudden ? b.time - WARN_LEAD + reaction : -Infinity,
      offset: profile.timingBias + profile.timingSd * gauss(b.id, 'time'),
      laneErr: b.blockedLanes.length > 0 && draw(b.id, 'lane') < profile.laneErrP,
    };
    plans.set(b.id, plan);
    return plan;
  };

  return (s: Session): BotAction | null => {
    if (s.status !== 'playing') return null;
    const ahead: Beat[] = [];
    let prev = -Infinity;
    for (let i = s.cursor - 1; i >= 0; i -= 1) {
      if (!isPickupOnly(s.beats[i])) {
        prev = s.beats[i].time;
        break;
      }
    }
    for (let i = s.cursor; i < s.beats.length && s.beats[i].time - s.time < 3; i += 1) {
      const b = s.beats[i];
      const p = planFor(b, b.time - prev);
      if (!isPickupOnly(b)) prev = b.time;
      if (p.view && s.time >= p.visibleFrom) ahead.push(p.view);
    }
    const focus = ahead.find((b) => !isPickupOnly(b));
    const plan = focus ? planFor(focus) : undefined;
    const p = s.player;
    const jitter = focus && !p.grounded && !p.sliding ? profile.boostSd * gauss(focus.id, `boost${p.level}`) : 0;
    const view: Session = { ...s, beats: ahead, cursor: 0, time: s.time + (plan?.offset ?? 0) + jitter };
    const a = botAction(view);
    if (!a?.lane) return a;
    if (p.laneAge < profile.laneSettle) return null;
    const laneBeat = ahead.find((b) => b.blockedLanes.length > 0);
    if (laneBeat && planFor(laneBeat).laneErr && !swiped.has(laneBeat.id)) {
      swiped.add(laneBeat.id);
      const wrongWay = -a.lane as LaneDir;
      const lane = p.lane + wrongWay;
      if (lane >= 0 && lane <= 2) return { swipe: null, lane: wrongWay };
    }
    return a;
  };
}

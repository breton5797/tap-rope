/**
 * Office "예측불가" layer (office spec §6, §13-2): surprise events and attack looks, both chosen once per
 * run from the run seed (P3: never from player input). Pure and deterministic in (beats, seed).
 * - Events only RE-DRESS beats the v8 generator + spacing already produced; nothing is inserted or moved:
 *   cart = a lane-hazard beat, fire-drill = a rear (from 'back') beat, highfive = a coin beat,
 *   blackout = a 1.5 s window (+ fade) inside a hazard-free gap, WARN_LEAD clear of the hazards on both sides,
 *   broadcast = copy only.
 * - Beat-anchored hazard events start their presentation WARN_LEAD before the beat (the "!" lead).
 * - attackVariant: the prop a superior uses for a hazard beat, from that superior's spec §5 attacks that
 *   fit the attack kind (2–3 looks where the table allows), else a generic prop of that kind (props.ts; the
 *   part-2 rematches pick from their stage's row when the stage is given).
 * - Part 2 (stages 6–10) is outdoors: no blackout, carts are delivery carts (no cleaning robot), and the
 *   broadcast / fire-drill banners read as the commute (eventCopy).
 */
import type { Beat, BossAttackKind, BossId } from '../../types';
import { HAZARD_KINDS, LANE_HAZARD_KINDS, WARN_LEAD } from '../../types';
import { hashString, mulberry32 } from '../../core/rng';
import { propsFor, type OfficePropId } from './props';

export type OfficeEventKind = 'cart' | 'highfive' | 'blackout' | 'fire-drill' | 'broadcast';
/** `beatIndex` indexes `beats`; `time` = when the event's presentation starts (seconds of stage time) */
export interface OfficeEvent { kind: OfficeEventKind; beatIndex: number; time: number; duration: number }

export {
  ATTACK_PROPS, OFFICE_PROPS, PART1_PROPS, PART2_PROPS, PROP_ALIASES, PROP_CALLOUTS, PROP_FALLBACK, STAGE_PROPS, failTipFor, propSprite, propsFor,
  type AttackPropId, type OfficePropId,
} from './props';

/** part 2 (stage index ≥ 5) is outdoors: the way home */
const PART2_FROM = 5;
const isPart2 = (stageIndex: number): boolean => stageIndex >= PART2_FROM;

/** one deterministic draw in [0, 1) per (seed, beat, salt) */
const draw = (seed: number, beatIndex: number, salt: number): number =>
  mulberry32((seed ^ Math.imul(beatIndex + 1, 0x9e3779b1) ^ salt) >>> 0)();

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))];

/** the prop a superior throws for this beat; `stage` (1-based) picks a part-2 rematch's own row */
export function attackVariant(slot: BossId, kind: BossAttackKind, seed: number, beatIndex: number, stage?: number): string {
  return pick(propsFor(slot, kind, stage), draw(seed, beatIndex, hashString(`${slot}/${kind}`)));
}

/** a cart event rides a delivery cart or the cleaning robot (indoors only: part 2 has the cart alone) */
export function cartProp(seed: number, beatIndex: number, stageIndex = 0): OfficePropId {
  if (isPart2(stageIndex)) return 'cart';
  return pick(['cart', 'robot'] as const, draw(seed, beatIndex, hashString('cart')));
}

export interface EventCopy { readonly broadcast: string; readonly fireDrill: string; readonly highFive: string }

const INDOOR_COPY: EventCopy = { broadcast: '사내방송: 사장님 깜짝 순시 중', fireDrill: '소방훈련! 뒤에서 와요', highFive: '하이파이브! 같이 퇴근하자!' };
const COMMUTE_COPY: EventCopy = { broadcast: '단톡방 공지: 회장님 등장!', fireDrill: '퇴근 인파! 뒤에서 와요', highFive: '하이파이브! 같이 퇴근하자!' };

/** the surprise banners of stage `stageIndex` (0-based): the office in part 1, the commute in part 2 */
export function eventCopy(stageIndex: number): EventCopy {
  return isPart2(stageIndex) ? COMMUTE_COPY : INDOOR_COPY;
}

const BLACKOUT = 1.5;
/** the blackout fades back over this long after its window (render/office surprise.ts) */
export const BLACKOUT_FADE = 0.15;
const BROADCAST = 3;
const HIGHFIVE_LEAD = 0.5;

const has = (b: Beat, test: (o: Beat['obstacles'][number]) => boolean) => b.obstacles.some(test);
const isHazard = (b: Beat) => has(b, (o) => HAZARD_KINDS.includes(o.kind));

/** every event of `kind` the beats allow (before seeding picks one) */
function candidates(kind: OfficeEventKind, beats: readonly Beat[], rng: () => number): OfficeEvent[] {
  const at = (test: (b: Beat) => boolean, lead: number, duration: number): OfficeEvent[] =>
    beats.flatMap((b, i) => (test(b) && b.time >= lead ? [{ kind, beatIndex: i, time: b.time - lead, duration }] : []));
  switch (kind) {
    case 'cart': return at((b) => has(b, (o) => LANE_HAZARD_KINDS.includes(o.kind)), WARN_LEAD, WARN_LEAD + 0.5);
    case 'fire-drill': return at((b) => has(b, (o) => o.from === 'back'), WARN_LEAD, WARN_LEAD + 0.5);
    case 'highfive': return at((b) => has(b, (o) => o.kind === 'coin'), HIGHFIVE_LEAD, HIGHFIVE_LEAD + 0.5);
    case 'broadcast': return at(() => true, 0, BROADCAST);
    case 'blackout': return blackoutCandidates(beats, rng);
  }
}

/**
 * A start inside each hazard-free gap so the whole blackout — window and fade — stays WARN_LEAD clear of
 * the hazards on both sides: the next hazard's "!" lead always plays on a lit screen.
 */
function blackoutCandidates(beats: readonly Beat[], rng: () => number): OfficeEvent[] {
  const hz = beats.map((b, i) => ({ b, i })).filter((x) => isHazard(x.b));
  return hz.slice(1).flatMap((next, k) => {
    const prev = hz[k];
    const room = next.b.time - prev.b.time - 2 * WARN_LEAD - BLACKOUT - BLACKOUT_FADE;
    if (room < 0) return [];
    return [{ kind: 'blackout' as const, beatIndex: prev.i, time: prev.b.time + WARN_LEAD + rng() * room, duration: BLACKOUT }];
  });
}

const overlaps = (a: OfficeEvent, b: OfficeEvent) =>
  a.beatIndex === b.beatIndex || (a.time < b.time + b.duration && b.time < a.time + a.duration);

function shuffled<T>(xs: readonly T[], rng: () => number): T[] {
  return xs.map((x) => ({ x, k: rng() })).sort((a, b) => a.k - b.k).map((e) => e.x);
}

const KINDS: readonly OfficeEventKind[] = ['cart', 'highfive', 'blackout', 'fire-drill', 'broadcast'];

/** stage 1 (tutorial): 1 event and no blackout; later stages: 2 events of different kinds (part 2: no blackout outdoors) */
export function planEvents(beats: readonly Beat[], seed: number, stageIndex: number): OfficeEvent[] {
  const rng = mulberry32((seed ^ Math.imul(stageIndex + 1, 0x85ebca6b)) >>> 0);
  const count = stageIndex === 0 ? 1 : 2;
  const kinds = shuffled(stageIndex === 0 || isPart2(stageIndex) ? KINDS.filter((k) => k !== 'blackout') : KINDS, rng);
  const chosen = kinds.reduce<OfficeEvent[]>((acc, kind) => {
    if (acc.length >= count) return acc;
    const fit = shuffled(candidates(kind, beats, rng), rng).find((e) => !acc.some((a) => overlaps(a, e)));
    return fit ? [...acc, fit] : acc;
  }, []);
  return [...chosen].sort((a, b) => a.time - b.time);
}

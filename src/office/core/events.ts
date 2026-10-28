/**
 * Office "예측불가" layer (office spec §6, §13-2): surprise events and attack looks, both chosen once per
 * run from the run seed (P3: never from player input). Pure and deterministic in (beats, seed).
 * - Events only RE-DRESS beats the v8 generator + spacing already produced; nothing is inserted or moved:
 *   cart = a lane-hazard beat, fire-drill = a rear (from 'back') beat, highfive = a coin beat,
 *   blackout = a 1.5 s window inside a hazard-free gap (≥ WARN_LEAD from every hazard), broadcast = copy only.
 * - Beat-anchored hazard events start their presentation WARN_LEAD before the beat (the "!" lead).
 * - attackVariant: the prop a superior uses for a hazard beat, from that superior's spec §5 attacks that
 *   fit the attack kind (2–3 looks where the table allows), else a generic prop of that kind.
 */
import type { Beat, BossAttackKind, BossId } from '../../types';
import { HAZARD_KINDS, LANE_HAZARD_KINDS, WARN_LEAD } from '../../types';
import { hashString, mulberry32 } from '../../core/rng';

export type OfficeEventKind = 'cart' | 'highfive' | 'blackout' | 'fire-drill' | 'broadcast';
/** `beatIndex` indexes `beats`; `time` = when the event's presentation starts (seconds of stage time) */
export interface OfficeEvent { kind: OfficeEventKind; beatIndex: number; time: number; duration: number }

/** every prop sprite (public-office/art/prop-<id>.webp) */
export const OFFICE_PROPS = [
  'postit', 'papers', 'coffee-tray', 'paper-plane', 'clipboard', 'paper-jam', 'door', 'whiteboard', 'pointer', 'golf',
  'latte-bubble', 'elevator', 'doc-tornado', 'necktie', 'corp-card', 'ceo-screen', 'revolving-door', 'envelope', 'cart', 'robot',
] as const;
export type OfficePropId = (typeof OFFICE_PROPS)[number];

type KindProps = Readonly<Record<BossAttackKind, readonly OfficePropId[]>>;

/** BossAttackKind: lane = guard/drop/chaser, beam = beam or high (jump or slide), ceiling = slide, floor = jump, drone = stay low */
const GENERIC: KindProps = { lane: ['cart'], floor: ['papers'], beam: ['clipboard'], ceiling: ['pointer'], drone: ['paper-plane'] };

/** spec §5 per superior (v8 slot) and attack kind */
export const ATTACK_PROPS: Readonly<Partial<Record<BossId, KindProps>>> = {
  warden: { lane: ['postit'], floor: ['papers'], beam: ['papers', 'coffee-tray'], ceiling: ['coffee-tray'], drone: ['postit', 'paper-plane'] },
  'sewer-eye': { lane: ['paper-jam'], floor: ['papers', 'clipboard'], beam: ['clipboard', 'paper-plane'], ceiling: ['paper-plane'], drone: ['paper-plane'] },
  'lab-ai': { lane: ['door'], floor: ['whiteboard'], beam: ['whiteboard', 'pointer'], ceiling: ['pointer'], drone: ['pointer'] },
  core: { lane: ['elevator'], floor: ['golf'], beam: ['golf', 'latte-bubble'], ceiling: ['latte-bubble'], drone: ['latte-bubble', 'golf'] },
  jailer: { lane: ['doc-tornado'], floor: ['papers', 'doc-tornado'], beam: ['doc-tornado', 'clipboard'], ceiling: ['doc-tornado'], drone: ['doc-tornado'] },
  apc: { lane: ['corp-card'], floor: ['necktie'], beam: ['necktie', 'corp-card'], ceiling: ['necktie'], drone: ['corp-card', 'necktie'] },
  chimera: { lane: ['revolving-door'], floor: ['envelope'], beam: ['envelope', 'ceo-screen'], ceiling: ['ceo-screen'], drone: ['envelope'] },
};

/** one deterministic draw in [0, 1) per (seed, beat, salt) */
const draw = (seed: number, beatIndex: number, salt: number): number =>
  mulberry32((seed ^ Math.imul(beatIndex + 1, 0x9e3779b1) ^ salt) >>> 0)();

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))];

export function attackVariant(slot: BossId, kind: BossAttackKind, seed: number, beatIndex: number): string {
  const props = ATTACK_PROPS[slot]?.[kind] ?? GENERIC[kind];
  return pick(props, draw(seed, beatIndex, hashString(`${slot}/${kind}`)));
}

/** a cart event rides a delivery cart or the cleaning robot */
export function cartProp(seed: number, beatIndex: number): OfficePropId {
  return pick(['cart', 'robot'] as const, draw(seed, beatIndex, hashString('cart')));
}

const BLACKOUT = 1.5;
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

/** a start inside each hazard-free gap that keeps WARN_LEAD from the hazards on both sides */
function blackoutCandidates(beats: readonly Beat[], rng: () => number): OfficeEvent[] {
  const hz = beats.map((b, i) => ({ b, i })).filter((x) => isHazard(x.b));
  return hz.slice(1).flatMap((next, k) => {
    const prev = hz[k];
    const room = next.b.time - prev.b.time - 2 * WARN_LEAD;
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

/** stage 1 (tutorial): 1 event and no blackout; later stages: 2 events of different kinds */
export function planEvents(beats: readonly Beat[], seed: number, stageIndex: number): OfficeEvent[] {
  const rng = mulberry32((seed ^ Math.imul(stageIndex + 1, 0x85ebca6b)) >>> 0);
  const count = stageIndex === 0 ? 1 : 2;
  const kinds = shuffled(stageIndex === 0 ? KINDS.filter((k) => k !== 'blackout') : KINDS, rng);
  const chosen = kinds.reduce<OfficeEvent[]>((acc, kind) => {
    if (acc.length >= count) return acc;
    const fit = shuffled(candidates(kind, beats, rng), rng).find((e) => !acc.some((a) => overlaps(a, e)));
    return fit ? [...acc, fit] : acc;
  }, []);
  return [...chosen].sort((a, b) => a.time - b.time);
}

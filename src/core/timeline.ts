/**
 * Time → render state helpers.
 * - ropeState: rope phase is piecewise-linear between "passes" (moments the rope
 *   sweeps under the player), so phase ≡ 0 (mod 2π) exactly at each pass.
 *   Multi-under beats spin L times (passes 0.12s apart); Double-Dutch sections
 *   alternate passes between rope A (even) and rope B (odd).
 * - visibleObstacles: scrolling hurdles/birds/pickups in screen space.
 * - laneItems: rhythm-lane preview entries.
 */
import type { Beat, LaneItem, RopeState, VisibleObstacle } from '../types';
import { LANE_LEAD, LOGICAL_W, PLAYER_X, SCROLL_SPEED } from '../types';

const TAU = Math.PI * 2;
const IDLE_PERIOD = 1.2;
const MULTI_SPACING = 0.12;
const DD_LEAD = 1;
const DD_TAIL = 0.5;
const CULL_MARGIN = 60;
const LANE_PAST = 0.25;
const BIRD_HEIGHT = 92;
const PICKUP_HEIGHT = { 1: 50, 2: 120, 3: 185 } as const;

interface Phase {
  readonly phase: number;
  readonly speed: number;
}

const hasRope = (b: Beat) => b.obstacles.some((o) => o.kind === 'rope');

function ropeLevel(b: Beat): number {
  return Math.max(1, ...b.obstacles.filter((o) => o.kind === 'rope').map((o) => o.level));
}

function expandPasses(b: Beat): number[] {
  const l = ropeLevel(b);
  return Array.from({ length: l }, (_, k) => b.time + (k - (l - 1) / 2) * MULTI_SPACING);
}

/** index of the last pass ≤ t, or -1 */
function lastIndexAtOrBefore(passes: readonly number[], t: number): number {
  let lo = 0;
  let hi = passes.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (passes[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

function phaseAt(passes: readonly number[], t: number): Phase {
  const idle = TAU / IDLE_PERIOD;
  if (passes.length === 0) return { phase: idle * t, speed: idle };
  const i = lastIndexAtOrBefore(passes, t);
  if (i < 0) return { phase: idle * (t - passes[0]), speed: idle };
  if (i === passes.length - 1) {
    const speed = i > 0 ? TAU / (passes[i] - passes[i - 1]) : idle;
    return { phase: TAU * i + speed * (t - passes[i]), speed };
  }
  const span = passes[i + 1] - passes[i];
  return { phase: TAU * i + (TAU * (t - passes[i])) / span, speed: TAU / span };
}

/** maximal runs of consecutive Double-Dutch rope beats */
function ddSections(ropeBeats: readonly Beat[]): Beat[][] {
  return ropeBeats.reduce<Beat[][]>((acc, b, i) => {
    if (!b.doubleDutch) return acc;
    const continues = i > 0 && ropeBeats[i - 1].doubleDutch && acc.length > 0;
    if (!continues) return [...acc, [b]];
    return [...acc.slice(0, -1), [...acc[acc.length - 1], b]];
  }, []);
}

export function ropeState(beats: readonly Beat[], t: number): RopeState {
  const ropeBeats = beats.filter(hasRope);
  const sections = ddSections(ropeBeats);
  const bBeats = new Set(sections.flatMap((s) => s.filter((_, k) => k % 2 === 1)));
  const passesA = ropeBeats
    .filter((b) => !bBeats.has(b))
    .flatMap((b) => (b.doubleDutch ? [b.time] : expandPasses(b)))
    .sort((x, y) => x - y);
  const a = phaseAt(passesA, t);
  const active = sections.find(
    (s) => t >= s[0].time - DD_LEAD && t <= s[s.length - 1].time + DD_TAIL,
  );
  const passesB = active ? active.filter((_, k) => k % 2 === 1).map((b) => b.time) : [];
  const phaseB = active && passesB.length > 0 ? phaseAt(passesB, t).phase : null;
  return { phaseA: a.phase, phaseB, speed: a.speed };
}

function obstacleHeight(kind: VisibleObstacle['kind'], level: 1 | 2 | 3): number {
  if (kind === 'hurdle') return 0;
  if (kind === 'bird') return BIRD_HEIGHT;
  return PICKUP_HEIGHT[level];
}

export function visibleObstacles(beats: readonly Beat[], t: number): VisibleObstacle[] {
  return beats.flatMap((beat) => {
    const x = PLAYER_X + (beat.time - t) * SCROLL_SPEED;
    if (x < -CULL_MARGIN || x > LOGICAL_W + CULL_MARGIN) return [];
    return beat.obstacles.flatMap((o, index): VisibleObstacle[] => {
      if (o.kind === 'rope') return [];
      const kind = o.kind;
      return [{ id: `${beat.id}-${index}`, kind, level: o.level, x, height: obstacleHeight(kind, o.level) }];
    });
  });
}

export function laneItems(beats: readonly Beat[], t: number): LaneItem[] {
  return beats
    .filter((b) => b.time - t >= -LANE_PAST && b.time - t <= LANE_LEAD)
    .map((b) => ({
      beatId: b.id,
      timeUntil: b.time - t,
      kinds: b.obstacles.map((o) => o.kind),
      level: b.requiredLevel,
    }));
}

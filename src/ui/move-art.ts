// Animated 80x80 gesture illustrations for each move (tutorial cards + guide sheet).
// v4 moves use a side view; v5 lane moves use a 2.5D three-lane floor (see LANE_SCENES).
import type { LaneId, MoveId } from '../types';
import { svg } from './dom';

const GROUND = 64;
const RED = '#ff3b5c';
const CYAN = '#2ee6ff';
const FINGER = '#2ee6ff';
let uid = 0;

interface Scene {
  readonly lift: number; // agent height above the floor (ignored when sliding)
  readonly x?: number;
  readonly slide?: boolean;
  readonly taps?: number;
  readonly swipe?: boolean; // swipe-down gesture instead of taps
  readonly at: readonly [number, number]; // gesture anchor
  readonly layers: () => SVGElement[]; // lasers / drones drawn behind the agent
  readonly warnTint?: boolean;
}

/** Neon beam: soft glow under a bright core. */
function laser(d: string, cls = ''): SVGElement {
  return svg('g', { class: `tut__laser ${cls}`.trim() }, [
    svg('path', { d, stroke: RED, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.3 }),
    svg('path', { d, stroke: '#ff8fa0', 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
  ]);
}

function floorLaser(x: number, top = 48, cls = ''): SVGElement[] {
  return [svg('rect', { x: x - 4, y: GROUND - 1, width: 8, height: 4, rx: 1.5, fill: '#4a5680' }), laser(`M${x} ${GROUND} V${top}`, cls)];
}

function beams(count: number, fromLeft = false): SVGElement[] {
  return Array.from({ length: count }, (_, i) => {
    const y = GROUND - 8 - i * 10;
    return laser(fromLeft ? `M2 ${y} H30` : `M48 ${y} H80`, 'tut__laser--fly');
  });
}

function drone(x: number, y: number): SVGElement {
  return svg('g', { class: 'tut__drone', transform: `translate(${x} ${y})` }, [
    svg('path', { d: 'M-5 4 L-12 22 H12 L5 4z', fill: CYAN, opacity: 0.16 }),
    svg('path', { d: 'M-12 -4 H-4 M4 -4 H12', stroke: '#9fb0d8', 'stroke-width': 2, 'stroke-linecap': 'round' }),
    svg('ellipse', { cx: 0, cy: 1, rx: 8, ry: 5, fill: '#3b4670' }),
    svg('circle', { cx: 0, cy: 2, r: 2.6, fill: CYAN }),
  ]);
}

function agentBody(): SVGElement[] {
  return [
    svg('rect', { x: -6.5, y: 2, width: 13, height: 14, rx: 5, fill: '#4a5fa8', stroke: '#9fd8ff', 'stroke-width': 0.8 }),
    svg('path', { d: 'M-3 2 L0 7 L3 2z', fill: '#fff' }),
    svg('path', { d: 'M-1 4 L0 10 L1 4z', fill: RED }),
    svg('circle', { cx: 0, cy: -5, r: 7.5, fill: '#ffd9b8' }),
    svg('path', { d: 'M-7.5 -6 Q0 -16 7.5 -6 Q0 -10 -7.5 -6z', fill: '#1d2238' }),
    svg('rect', { x: -7, y: -7, width: 14, height: 4, rx: 2, fill: CYAN, opacity: 0.85 }),
    svg('circle', { cx: -2.6, cy: -2.5, r: 1.1, fill: '#1d2238' }),
    svg('circle', { cx: 2.6, cy: -2.5, r: 1.1, fill: '#1d2238' }),
    svg('circle', { cx: 7.6, cy: -3, r: 1.4, fill: '#9fb0d8' }),
  ];
}

function agent(s: Scene): SVGElement {
  const x = s.x ?? 36;
  if (s.slide) {
    // feet-first slide: rotate the standing pose back around the feet
    return svg('g', { transform: `translate(${x} ${GROUND}) rotate(-78) translate(0 -16)` }, [
      svg('g', { class: 'tut__fig tut__fig--slide' }, agentBody()),
    ]);
  }
  return svg('g', { transform: `translate(${x} ${GROUND - 16 - s.lift})` }, [svg('g', { class: 'tut__fig' }, agentBody())]);
}

function taps(n: number): SVGElement[] {
  return [
    ...Array.from({ length: n }, (_, i) =>
      svg('circle', { r: 5 + i * 3.5, fill: 'none', stroke: FINGER, 'stroke-width': 1.8, class: 'tut__ring', style: `animation-delay:${i * 0.16}s` }),
    ),
    svg('circle', { r: 4, fill: FINGER }),
  ];
}

function swipe(dir: 'up' | 'down'): SVGElement[] {
  const d = dir === 'down' ? 'M0 -10 V10 M-5 5 L0 10 L5 5' : 'M0 10 V-10 M-5 -5 L0 -10 L5 -5';
  return [
    svg('path', { d, fill: 'none', stroke: FINGER, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.55 }),
    svg('circle', { r: 4.6, fill: FINGER, stroke: '#fff', 'stroke-width': 1.4, class: `tut__finger tut__finger--${dir}` }),
  ];
}

const swipeDown = (): SVGElement[] => swipe('down');

type LaneMove = 'lane' | 'drop' | 'chaser' | 'lanejump';
type SideMove = Exclude<MoveId, LaneMove>;

const SCENES: Readonly<Record<SideMove, Scene>> = {
  jump: { lift: 18, x: 54, at: [18, 18], taps: 1, layers: () => floorLaser(56) },
  beam: { lift: 14, x: 60, at: [18, 18], taps: 1, layers: () => beams(1) },
  double: { lift: 24, x: 60, at: [18, 18], taps: 2, layers: () => beams(2) },
  triple: { lift: 33, x: 60, at: [18, 20], taps: 3, layers: () => beams(3) },
  slide: {
    lift: 0, slide: true, swipe: true, x: 48, at: [16, 22],
    layers: () => [svg('rect', { x: 50, y: 0, width: 12, height: 5, rx: 2, fill: '#4a5680' }), laser('M56 5 V46')],
  },
  high: { lift: 0, slide: true, swipe: true, x: 40, at: [16, 22], layers: () => [laser('M36 44 H80', 'tut__laser--fly')] },
  drone: {
    lift: 6, at: [66, 44], taps: 1, warnTint: true,
    layers: () => [svg('path', { d: 'M4 30 H76', stroke: RED, 'stroke-width': 1.6, 'stroke-dasharray': '3 4', opacity: 0.8 }), drone(46, 18)],
  },
  rear: {
    lift: 16, x: 50, at: [68, 16], taps: 1, warnTint: true,
    layers: () => [...beams(1, true), svg('path', { d: 'M4 30 L10 20 L16 30z', fill: '#ffc53d', class: 'tut__warn-pulse' }), svg('rect', { x: 9.2, y: 23, width: 1.6, height: 4, fill: '#1d2238' })],
  },
  gate: { lift: 18, x: 30, at: [16, 16], taps: 1, warnTint: true, layers: () => [...floorLaser(58), drone(58, 16)] },
  pulse: {
    lift: 16, x: 24, at: [66, 14], taps: 1,
    layers: () => [44, 58, 72].flatMap((x, i) => floorLaser(x, 50, `tut__pulse tut__pulse--${i}`)),
  },
};

// ---------- v5 lane moves: a 2.5D floor with three lanes ----------

const FLOOR_TOP = 38;
/** feet line and depth scale of each lane (0 = far / upper) */
const LANE_Y: Readonly<Record<LaneId, number>> = { 0: 49, 1: 61, 2: 74 };
const LANE_SCALE: Readonly<Record<LaneId, number>> = { 0: 0.62, 1: 0.7, 2: 0.78 };

interface LaneScene {
  readonly x: number; // agent x
  readonly from: LaneId; // lane the agent starts in (the threatened one)
  readonly to: LaneId; // safe lane it moves to
  readonly leap?: boolean; // also jumps (lanejump)
  readonly swipeAt: readonly [number, number]; // left-thumb swipe anchor
  readonly tapAt?: readonly [number, number]; // right-thumb tap anchor
  readonly layers: () => SVGElement[];
  readonly warnTint?: boolean;
}

function laneFloor(): SVGElement[] {
  return [
    svg('path', { d: `M0 ${FLOOR_TOP} H80 V80 H0z`, fill: '#202a4d' }),
    svg('path', { d: `M0 ${FLOOR_TOP} H80`, stroke: CYAN, 'stroke-width': 1.2, opacity: 0.55 }),
    svg('path', { d: 'M0 55 H80 M0 67.5 H80', stroke: '#9fb0d8', 'stroke-width': 0.8, 'stroke-dasharray': '4 3', opacity: 0.35 }),
  ];
}

/** Red "!" warning badge (sudden attacks). */
function bang(x: number, y: number): SVGElement {
  return svg('g', { class: 'tut__bang', transform: `translate(${x} ${y})` }, [
    svg('circle', { r: 5.5, fill: RED, stroke: '#fff', 'stroke-width': 1.2 }),
    svg('path', { d: 'M0 -2.8 V0.8', stroke: '#fff', 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
    svg('circle', { cy: 2.9, r: 0.95, fill: '#fff' }),
  ]);
}

function guard(x: number, lane: LaneId): SVGElement {
  const k = LANE_SCALE[lane] * 1.15;
  return svg('g', { transform: `translate(${x} ${LANE_Y[lane]}) scale(${k})` }, [
    svg('ellipse', { cy: 0, rx: 9, ry: 2.4, fill: '#000', opacity: 0.3 }),
    svg('rect', { x: -7, y: -22, width: 14, height: 18, rx: 5, fill: '#3b4670', stroke: '#9fb0d8', 'stroke-width': 0.8 }),
    svg('rect', { x: -5, y: -18, width: 10, height: 4, rx: 2, fill: RED, class: 'tut__eye' }),
    svg('path', { d: 'M-4 -4 V0 M4 -4 V0', stroke: '#9fb0d8', 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
    laser('M-11 -24 V-1'),
  ]);
}

function crate(x: number, lane: LaneId): SVGElement[] {
  const y = LANE_Y[lane];
  return [
    svg('ellipse', { cx: x, cy: y, rx: 9, ry: 2.6, fill: '#000', class: 'tut__shadow' }),
    svg('g', { class: 'tut__drop' }, [
      svg('g', { transform: `translate(${x} ${y - 9})` }, [
        svg('path', { d: 'M0 -24 V-9', stroke: '#9fb0d8', 'stroke-width': 1.4 }),
        svg('rect', { x: -8, y: -9, width: 16, height: 14, rx: 2, fill: '#c98a3d', stroke: '#7a4a17', 'stroke-width': 1.2 }),
        svg('path', { d: 'M-8 -9 L8 5 M8 -9 L-8 5', stroke: '#7a4a17', 'stroke-width': 1 }),
      ]),
    ]),
  ];
}

function chaser(lane: LaneId): SVGElement {
  return svg('g', { class: 'tut__chase' }, [
    svg('g', { transform: `translate(14 ${LANE_Y[lane] - 12})` }, [
      svg('path', { d: 'M-16 2 H-7 M-14 6 H-8', stroke: CYAN, 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.6 }),
      svg('path', { d: 'M-6 -4 H6 M0 -4 V-1', stroke: '#9fb0d8', 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
      svg('ellipse', { cx: 0, cy: 2, rx: 7.5, ry: 4.5, fill: '#5a2340', stroke: RED, 'stroke-width': 1 }),
      svg('circle', { cx: 3.5, cy: 2.5, r: 2, fill: RED }),
    ]),
  ]);
}

/** Full-width floor laser drawn across all three lanes (slanted for depth). */
function floorSweep(x: number): SVGElement[] {
  return [laser(`M${x + 4} ${FLOOR_TOP + 2} L${x - 4} 79`), laser(`M${x + 4} ${FLOOR_TOP - 4} L${x - 4} 72`, 'tut__laser--soft')];
}

const LANE_SCENES: Readonly<Record<LaneMove, LaneScene>> = {
  lane: { x: 26, from: 1, to: 0, swipeAt: [12, 18], layers: () => [guard(58, 1)] },
  drop: { x: 34, from: 1, to: 2, swipeAt: [12, 18], warnTint: true, layers: () => [...crate(44, 1), bang(66, 24)] },
  chaser: { x: 54, from: 1, to: 0, swipeAt: [12, 16], warnTint: true, layers: () => [chaser(1), bang(6, LANE_Y[1] - 14)] },
  lanejump: { x: 24, from: 1, to: 2, leap: true, swipeAt: [10, 18], tapAt: [70, 16], layers: () => [guard(64, 1), ...floorSweep(44)] },
};

function laneAgent(s: LaneScene): SVGElement {
  const k = LANE_SCALE[s.from];
  const dy = LANE_Y[s.to] - LANE_Y[s.from];
  return svg('g', { class: 'tut__shift', style: `--dy:${dy}px` }, [
    svg('ellipse', { cx: s.x, cy: LANE_Y[s.from], rx: 6, ry: 1.8, fill: '#000', opacity: 0.35 }),
    svg('g', { transform: `translate(${s.x} ${LANE_Y[s.from] - 16 * k}) scale(${k})` }, [
      svg('g', { class: s.leap ? 'tut__fig tut__fig--leap' : 'tut__fig' }, agentBody()),
    ]),
  ]);
}

function frame(id: MoveId, warnTint: boolean, inner: readonly SVGElement[], gesture: readonly SVGElement[]): SVGElement {
  uid += 1;
  const bg = `tut-bg-${uid}`;
  const clip = `tut-clip-${uid}`;
  const top = warnTint ? '#3a1630' : '#1c2750';
  return svg('svg', { class: `tut__art tut__art--${id}`, viewBox: '0 0 80 80', 'aria-hidden': 'true' }, [
    svg('defs', {}, [
      svg('clipPath', { id: clip }, [svg('rect', { width: 80, height: 80, rx: 22 })]),
      svg('linearGradient', { id: bg, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg('stop', { offset: 0, 'stop-color': top }),
        svg('stop', { offset: 1, 'stop-color': '#0c1228' }),
      ]),
    ]),
    svg('g', { 'clip-path': `url(#${clip})` }, [svg('rect', { width: 80, height: 80, fill: `url(#${bg})` }), ...inner]),
    ...gesture,
  ]);
}

const at = (p: readonly [number, number], children: SVGElement[]): SVGElement =>
  svg('g', { transform: `translate(${p[0]} ${p[1]})` }, children);

function isLaneMove(id: MoveId): id is LaneMove {
  return id in LANE_SCENES;
}

function laneArt(id: LaneMove): SVGElement {
  const s = LANE_SCENES[id];
  const dir = LANE_Y[s.to] < LANE_Y[s.from] ? 'up' : 'down';
  return frame(id, s.warnTint ?? false, [...laneFloor(), ...s.layers(), laneAgent(s)], [
    at(s.swipeAt, swipe(dir)),
    ...(s.tapAt ? [at(s.tapAt, taps(1))] : []),
  ]);
}

function sideArt(id: SideMove): SVGElement {
  const s = SCENES[id];
  return frame(
    id,
    s.warnTint ?? false,
    [
      svg('path', { d: 'M20 0V64M40 0V64M60 0V64', stroke: '#ffffff', 'stroke-opacity': 0.05, 'stroke-width': 1 }),
      svg('rect', { y: GROUND, width: 80, height: 16, fill: '#202a4d' }),
      svg('path', { d: `M0 ${GROUND} H80`, stroke: CYAN, 'stroke-width': 1.2, opacity: 0.55 }),
      ...s.layers(),
      agent(s),
    ],
    [at(s.at, s.swipe ? swipeDown() : taps(s.taps ?? 1))],
  );
}

/** Returns a fresh animated illustration for a move. */
export function moveArt(id: MoveId): SVGElement {
  return isLaneMove(id) ? laneArt(id) : sideArt(id);
}

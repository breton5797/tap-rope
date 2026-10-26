// Animated 80x80 gesture diagrams for each move (tutorial cards + field manual), v6 style:
// clean line drawings on a dark plate, an adult-proportioned operator silhouette (no face), thin red
// lasers, amber warning triangles and teal touch marks.
// Full-width moves use a side view; v5 lane moves use a 2.5D three-lane floor (see LANE_SCENES).
import type { LaneId, MoveId } from '../types';
import { svg } from './dom';

const GROUND = 64;
const RED = '#ff2a3a';
const RED_CORE = '#ffd0d4';
const TEAL = '#3fe0d0';
const AMBER = '#ffb020';
const INK = '#d5dde2';
const STEEL = '#7d8a93';
let uid = 0;

const STROKE = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

type Pose = 'run' | 'tuck' | 'slide';

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

/** Laser: faint bloom under a hot thin core. */
function laser(d: string, cls = ''): SVGElement {
  return svg('g', { class: `tut__laser ${cls}`.trim() }, [
    svg('path', { ...STROKE, d, stroke: RED, 'stroke-width': 4, opacity: 0.35 }),
    svg('path', { ...STROKE, d, stroke: RED_CORE, 'stroke-width': 1 }),
  ]);
}

/** Jump lasers as in-game: horizontal tripwires strung between two floor posts, N stacked beams for level N. */
function tripwire(x0: number, x1: number, count: number, cls = ''): SVGElement[] {
  const top = GROUND - 6 - (count - 1) * 8;
  return [
    ...[x0, x1].map((x) => svg('rect', { x: x - 1.5, y: top - 6, width: 3, height: GROUND - top + 6, fill: '#1b2329', stroke: STEEL, 'stroke-width': 0.7 })),
    ...[x0, x1].map((x) => svg('rect', { x: x - 1, y: top - 6, width: 2, height: 1.5, fill: RED })),
    ...Array.from({ length: count }, (_, i) => laser(`M${x0 + 1.5} ${GROUND - 6 - i * 8} H${x1 - 1.5}`, cls)),
  ];
}

/** Rear beams still fly in from behind (the warning move). */
function beams(count: number, fromLeft = false): SVGElement[] {
  return Array.from({ length: count }, (_, i) => {
    const y = GROUND - 8 - i * 10;
    return laser(fromLeft ? `M2 ${y} H30` : `M48 ${y} H80`, 'tut__laser--fly');
  });
}

/** Slide laser as in-game: beams drop from a ceiling housing and END above the floor; an amber clearance bar marks the gap. */
function ceilingCurtain(x0: number, x1: number, bottom: number): SVGElement[] {
  const xs = [x0 + 4, (x0 + x1) / 2, x1 - 4];
  return [
    svg('rect', { x: x0, y: 0, width: x1 - x0, height: 6, fill: '#1b2329', stroke: STEEL, 'stroke-width': 0.8 }),
    ...xs.map((x) => svg('rect', { x: x - 1.5, y: 5, width: 3, height: 2, fill: RED_CORE })),
    ...xs.map((x) => laser(`M${x} 7 V${bottom}`)),
    svg('path', { d: `M${x0 - 2} ${bottom + 2.5} H${x1 + 2}`, stroke: AMBER, 'stroke-width': 1.4, 'stroke-dasharray': '3 2' }),
  ];
}

/** Matte quadcopter with a downward scan cone. */
function drone(x: number, y: number, scan = RED): SVGElement {
  return svg('g', { class: 'tut__drone', transform: `translate(${x} ${y})` }, [
    svg('path', { d: 'M-4 3 L-11 24 H11 L4 3z', fill: scan, opacity: 0.12 }),
    svg('path', { ...STROKE, d: 'M-12 -3 H-4 M4 -3 H12 M-12 -5 V-1 M12 -5 V-1', stroke: STEEL, 'stroke-width': 1.2 }),
    svg('rect', { x: -6, y: -2, width: 12, height: 5, rx: 1, fill: '#1b2329', stroke: INK, 'stroke-width': 0.9 }),
    svg('rect', { x: -1.5, y: 1.5, width: 3, height: 1.6, fill: scan }),
  ]);
}

/** Operator silhouette, feet at the origin, ~32 units tall (≈ 7.5 heads). */
function figure(pose: Pose): SVGElement[] {
  const P: Readonly<Record<Pose, { body: string; head: readonly [number, number] }>> = {
    run: {
      body: 'M0 -26 L-1 -15 M-1 -15 L3 -8 L1 0 M-1 -15 L-4 -8 L-7 -2 M0 -25 L-4 -19 L-2 -14 M0 -25 L4 -20 L7 -22',
      head: [0.5, -29.5],
    },
    tuck: {
      body: 'M0 -26 L0 -15 M0 -15 L5 -10 L1 -5 M0 -15 L-3 -9 L-6 -6 M0 -25 L5 -27 L8 -31 M0 -25 L-3 -21 L-1 -17',
      head: [0.8, -29.5],
    },
    slide: {
      body: 'M0 -5 L-9 -12 M0 -5 L8 -3 L14 0 M0 -5 L-1 0 L5 0 M-7 -11 L-12 -4 L-14 0 M-7 -11 L-3 -15 L2 -16',
      head: [-11, -15],
    },
  };
  const p = P[pose];
  return [
    svg('path', { ...STROKE, d: p.body, stroke: INK, 'stroke-width': 2.6 }),
    svg('circle', { cx: p.head[0], cy: p.head[1], r: 2.4, fill: INK }),
    // earpiece / NVG mount: a single teal point, no face
    svg('circle', { cx: p.head[0] + 1.4, cy: p.head[1] - 0.6, r: 0.8, fill: TEAL }),
  ];
}

function agent(s: Scene): SVGElement {
  const x = s.x ?? 36;
  if (s.slide) return svg('g', { transform: `translate(${x} ${GROUND})` }, [svg('g', { class: 'tut__fig tut__fig--slide' }, figure('slide'))]);
  return svg('g', { transform: `translate(${x} ${GROUND - s.lift})` }, [svg('g', { class: 'tut__fig' }, figure(s.lift > 8 ? 'tuck' : 'run'))]);
}

function taps(n: number): SVGElement[] {
  return [
    ...Array.from({ length: n }, (_, i) =>
      svg('circle', { r: 5 + i * 3.5, fill: 'none', stroke: TEAL, 'stroke-width': 1.2, class: 'tut__ring', style: `animation-delay:${i * 0.16}s` }),
    ),
    svg('circle', { r: 2.6, fill: TEAL }),
  ];
}

function swipe(dir: 'up' | 'down'): SVGElement[] {
  const d = dir === 'down' ? 'M0 -10 V10 M-4 6 L0 10 L4 6' : 'M0 10 V-10 M-4 -6 L0 -10 L4 -6';
  return [
    svg('path', { ...STROKE, d, stroke: TEAL, 'stroke-width': 1.6, opacity: 0.6 }),
    svg('circle', { r: 3.6, fill: 'none', stroke: TEAL, 'stroke-width': 1.4, class: `tut__finger tut__finger--${dir}` }),
  ];
}

const swipeDown = (): SVGElement[] => swipe('down');

type LaneMove = 'lane' | 'drop' | 'chaser' | 'lanejump';
type SideMove = Exclude<MoveId, LaneMove>;

/** Amber triangle warning marker (sudden attacks). */
function warnMark(x: number, y: number, cls = 'tut__warn-pulse'): SVGElement {
  return svg('g', { class: cls, transform: `translate(${x} ${y})` }, [
    svg('path', { d: 'M0 -6 L6 5 H-6z', fill: 'none', stroke: AMBER, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
    svg('path', { d: 'M0 -2 V1.4', stroke: AMBER, 'stroke-width': 1.4 }),
    svg('circle', { cy: 3.2, r: 0.7, fill: AMBER }),
  ]);
}

const SCENES: Readonly<Record<SideMove, Scene>> = {
  jump: { lift: 16, x: 58, at: [18, 18], taps: 1, layers: () => tripwire(44, 74, 1) },
  beam: { lift: 16, x: 58, at: [18, 18], taps: 1, layers: () => tripwire(44, 74, 1) },
  double: { lift: 22, x: 58, at: [18, 18], taps: 2, layers: () => tripwire(44, 74, 2) },
  triple: { lift: 29, x: 58, at: [18, 16], taps: 3, layers: () => tripwire(44, 74, 3) },
  slide: {
    lift: 0, slide: true, swipe: true, x: 50, at: [16, 22],
    layers: () => ceilingCurtain(44, 70, 44),
  },
  high: { lift: 0, slide: true, swipe: true, x: 40, at: [16, 22], layers: () => [laser('M36 44 H80', 'tut__laser--fly')] },
  drone: {
    lift: 6, at: [66, 44], taps: 1, warnTint: true,
    layers: () => [svg('path', { d: 'M4 30 H76', stroke: RED, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0.7 }), drone(46, 18)],
  },
  rear: { lift: 16, x: 50, at: [68, 16], taps: 1, warnTint: true, layers: () => [...beams(1, true), warnMark(10, 26)] },
  gate: { lift: 16, x: 30, at: [16, 16], taps: 1, warnTint: true, layers: () => [...tripwire(48, 68, 1), drone(58, 16)] },
  pulse: {
    lift: 16, x: 24, at: [66, 14], taps: 1,
    layers: () => [40, 54, 68].flatMap((x, i) => tripwire(x, x + 10, 1, `tut__pulse tut__pulse--${i}`)),
  },
};

// ---------- v5 lane moves: a 2.5D floor with three lanes ----------

const FLOOR_TOP = 38;
/** feet line and depth scale of each lane (0 = far / upper) */
const LANE_Y: Readonly<Record<LaneId, number>> = { 0: 49, 1: 61, 2: 74 };
const LANE_SCALE: Readonly<Record<LaneId, number>> = { 0: 0.6, 1: 0.68, 2: 0.76 };

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
    svg('path', { d: `M0 ${FLOOR_TOP} H80 V80 H0z`, fill: '#11171c' }),
    svg('path', { d: `M0 ${FLOOR_TOP} H80`, stroke: STEEL, 'stroke-width': 0.8 }),
    svg('path', { d: 'M0 55 H80 M0 67.5 H80', stroke: STEEL, 'stroke-width': 0.6, 'stroke-dasharray': '4 3', opacity: 0.6 }),
  ];
}

/** Bipedal armoured sentry with a red sensor slit and a laser shield. */
function guard(x: number, lane: LaneId): SVGElement {
  const k = LANE_SCALE[lane] * 1.15;
  return svg('g', { transform: `translate(${x} ${LANE_Y[lane]}) scale(${k})` }, [
    svg('path', { d: 'M-6 -24 H6 L7 -12 H-7z', fill: '#1b2329', stroke: INK, 'stroke-width': 0.9 }),
    svg('rect', { x: -4, y: -21, width: 8, height: 1.8, fill: RED, class: 'tut__eye' }),
    svg('path', { ...STROKE, d: 'M-4 -12 L-5 -5 L-3 0 M4 -12 L5 -5 L3 0', stroke: INK, 'stroke-width': 1.6 }),
    laser('M-11 -25 V-1'),
  ]);
}

/** Steel cargo on a crane chain, with its landing shadow. */
function crate(x: number, lane: LaneId): SVGElement[] {
  const y = LANE_Y[lane];
  return [
    svg('ellipse', { cx: x, cy: y, rx: 9, ry: 2.4, fill: '#000', class: 'tut__shadow' }),
    svg('g', { class: 'tut__drop' }, [
      svg('g', { transform: `translate(${x} ${y - 9})` }, [
        svg('path', { d: 'M0 -26 V-9', stroke: STEEL, 'stroke-width': 1, 'stroke-dasharray': '1.5 1' }),
        svg('rect', { x: -8, y: -9, width: 16, height: 14, fill: '#1b2329', stroke: INK, 'stroke-width': 0.9 }),
        svg('path', { d: 'M-8 -9 L8 5 M8 -9 L-8 5', stroke: STEEL, 'stroke-width': 0.8 }),
      ]),
    ]),
  ];
}

/** Pursuit quadcopter with an amber searchlight, dashing in from the left. */
function chaser(lane: LaneId): SVGElement {
  return svg('g', { class: 'tut__chase' }, [
    svg('g', { transform: `translate(14 ${LANE_Y[lane] - 12})` }, [
      svg('path', { d: 'M5 2 L22 8 L22 -2z', fill: AMBER, opacity: 0.18 }),
      svg('path', { ...STROKE, d: 'M-16 2 H-8 M-14 6 H-9', stroke: STEEL, 'stroke-width': 1 }),
      svg('path', { ...STROKE, d: 'M-7 -4 H-1 M1 -4 H7', stroke: STEEL, 'stroke-width': 1.2 }),
      svg('rect', { x: -5, y: -2, width: 10, height: 5, rx: 1, fill: '#1b2329', stroke: INK, 'stroke-width': 0.9 }),
      svg('circle', { cx: 5, cy: 0.5, r: 1.4, fill: AMBER }),
    ]),
  ]);
}

/** Full-width floor laser drawn across all three lanes (slanted for depth). */
function floorSweep(x: number): SVGElement[] {
  return [laser(`M${x + 4} ${FLOOR_TOP + 2} L${x - 4} 79`), laser(`M${x + 4} ${FLOOR_TOP - 4} L${x - 4} 72`, 'tut__laser--soft')];
}

const LANE_SCENES: Readonly<Record<LaneMove, LaneScene>> = {
  lane: { x: 26, from: 1, to: 0, swipeAt: [12, 18], layers: () => [guard(58, 1)] },
  drop: { x: 34, from: 1, to: 2, swipeAt: [12, 18], warnTint: true, layers: () => [...crate(44, 1), warnMark(66, 22, 'tut__bang')] },
  chaser: { x: 54, from: 1, to: 0, swipeAt: [12, 16], warnTint: true, layers: () => [chaser(1), warnMark(7, LANE_Y[1] - 15, 'tut__bang')] },
  lanejump: { x: 24, from: 1, to: 2, leap: true, swipeAt: [10, 18], tapAt: [70, 16], layers: () => [guard(64, 1), ...floorSweep(44)] },
};

function laneAgent(s: LaneScene): SVGElement {
  const k = LANE_SCALE[s.from];
  const dy = LANE_Y[s.to] - LANE_Y[s.from];
  return svg('g', { class: 'tut__shift', style: `--dy:${dy}px` }, [
    svg('ellipse', { cx: s.x, cy: LANE_Y[s.from], rx: 5, ry: 1.4, fill: '#000', opacity: 0.5 }),
    svg('g', { transform: `translate(${s.x} ${LANE_Y[s.from]}) scale(${k})` }, [
      svg('g', { class: s.leap ? 'tut__fig tut__fig--leap' : 'tut__fig' }, figure(s.leap ? 'tuck' : 'run')),
    ]),
  ]);
}

function frame(id: MoveId, warnTint: boolean, inner: readonly SVGElement[], gesture: readonly SVGElement[]): SVGElement {
  uid += 1;
  const bg = `tut-bg-${uid}`;
  const clip = `tut-clip-${uid}`;
  return svg('svg', { class: `tut__art tut__art--${id}`, viewBox: '0 0 80 80', 'aria-hidden': 'true' }, [
    svg('defs', {}, [
      svg('clipPath', { id: clip }, [svg('rect', { width: 80, height: 80, rx: 3 })]),
      svg('linearGradient', { id: bg, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg('stop', { offset: 0, 'stop-color': warnTint ? '#1f1012' : '#121a1f' }),
        svg('stop', { offset: 1, 'stop-color': '#07090c' }),
      ]),
    ]),
    svg('g', { 'clip-path': `url(#${clip})` }, [svg('rect', { width: 80, height: 80, fill: `url(#${bg})` }), ...inner]),
    svg('rect', { x: 0.5, y: 0.5, width: 79, height: 79, rx: 3, fill: 'none', stroke: 'rgba(196,214,224,0.22)' }),
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
      svg('path', { d: 'M20 0V64M40 0V64M60 0V64', stroke: '#ffffff', 'stroke-opacity': 0.04, 'stroke-width': 1 }),
      svg('rect', { y: GROUND, width: 80, height: 16, fill: '#11171c' }),
      svg('path', { d: `M0 ${GROUND} H80`, stroke: STEEL, 'stroke-width': 0.8 }),
      ...s.layers(),
      agent(s),
    ],
    [at(s.at, s.swipe ? swipeDown() : taps(s.taps ?? 1))],
  );
}

/** Returns a fresh animated diagram for a move. */
export function moveArt(id: MoveId): SVGElement {
  return isLaneMove(id) ? laneArt(id) : sideArt(id);
}

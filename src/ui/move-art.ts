// Animated gesture illustrations (80x80) for each move: tutorial cards + guide sheet.
import type { MoveId } from '../types';
import { svg } from './dom';

const GROUND = 64;
const BLUE = '#4f6bff';
let uid = 0;

type Swipe = 'up' | 'down' | 'h';

interface Scene {
  readonly bg: readonly [string, string];
  readonly lift: number; // figure height above ground
  readonly x?: number; // figure x (default 40)
  readonly taps?: number;
  readonly swipe?: Swipe;
  readonly at: readonly [number, number]; // gesture anchor
  readonly extras?: () => SVGElement[];
  readonly flip?: boolean;
  readonly crossArms?: boolean;
  readonly rope?: 'normal' | 'none' | 'double' | 'back';
}

function bird(): SVGElement {
  return svg('g', { transform: 'translate(44 13)' }, [
    svg('ellipse', { cx: 0, cy: 0, rx: 9, ry: 6.5, fill: '#5b8cff' }),
    svg('path', { d: 'M-3 -2 L4 -11 L6 -1z', fill: '#3d6be0', class: 'tut__wing' }),
    svg('path', { d: 'M-8 -1 L-14 1 L-8 3z', fill: '#ffb020' }),
    svg('circle', { cx: -4, cy: -1.5, r: 1.6, fill: '#1f1a4d' }),
  ]);
}

function ring(id: string): SVGElement[] {
  return [
    svg('defs', {}, [
      svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, ['#ff5d6c', '#ffb340', '#ffe14d', '#3fe0a0', '#45b6ff', '#8a6bff'].map((c, i) =>
        svg('stop', { offset: i / 5, 'stop-color': c }),
      )),
    ]),
    svg('ellipse', { cx: 40, cy: 38, rx: 13, ry: 24, fill: 'none', stroke: `url(#${id})`, 'stroke-width': 4.5, opacity: 0.9 }),
  ];
}

function ball(): SVGElement {
  return svg('g', { class: 'tut__ball', transform: `translate(58 ${GROUND - 8})` }, [
    svg('circle', { r: 8, fill: '#ff8a3d' }),
    svg('path', { d: 'M-8 0h16M0 -8v16', stroke: '#fff', 'stroke-width': 2, opacity: 0.8 }),
    svg('circle', { cx: -2.5, cy: -3, r: 2, fill: '#fff', opacity: 0.6 }),
  ]);
}

function figure(s: Scene): SVGElement {
  const y = GROUND - 22 - s.lift;
  const arms = s.crossArms
    ? [svg('path', { d: 'M-9 4 L9 13 M9 4 L-9 13', stroke: '#ffd9b8', 'stroke-width': 3, 'stroke-linecap': 'round' })]
    : [];
  return svg('g', { transform: `translate(${s.x ?? 40} ${y})` }, [
    svg('g', { class: s.flip ? 'tut__fig tut__fig--flip' : 'tut__fig' }, [
      svg('rect', { x: -6.5, y: 2, width: 13, height: 14, rx: 5.5, fill: '#ff5d6c' }),
      ...arms,
      svg('circle', { cx: 0, cy: -5, r: 7.5, fill: '#ffd9b8' }),
      svg('path', { d: 'M-7.5 -6 Q0 -16 7.5 -6 Q0 -10 -7.5 -6z', fill: '#4a2c2a' }),
      svg('circle', { cx: -2.6, cy: -4, r: 1.1, fill: '#2a2350' }),
      svg('circle', { cx: 2.6, cy: -4, r: 1.1, fill: '#2a2350' }),
    ]),
  ]);
}

function rope(kind: Scene['rope']): SVGElement[] {
  const low = `M6 ${GROUND - 14} Q40 ${GROUND + 14} 74 ${GROUND - 14}`;
  const base = { fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round' };
  if (kind === 'none') return [];
  if (kind === 'double') {
    return [
      svg('path', { ...base, d: low, stroke: '#ff5da2' }),
      svg('path', { ...base, d: `M6 ${GROUND - 14} Q40 0 74 ${GROUND - 14}`, stroke: '#45b6ff', 'stroke-dasharray': '1 0' }),
    ];
  }
  if (kind === 'back') {
    // rope plus a counter-clockwise "rewind" arrow around the kid
    return [
      svg('path', { ...base, d: low, stroke: '#8a6bff' }),
      svg('path', { ...base, 'stroke-width': 2.6, stroke: '#ff5da2', d: 'M48 40 A17 17 0 1 0 16 40' }),
      svg('path', { d: 'M10.5 37 L21.5 37 L16 44.5z', fill: '#ff5da2' }),
    ];
  }
  return [svg('path', { ...base, d: low, stroke: '#ff5da2' })];
}

function taps(n: number): SVGElement[] {
  return [
    ...Array.from({ length: n }, (_, i) =>
      svg('circle', { r: 5 + i * 3.5, fill: 'none', stroke: BLUE, 'stroke-width': 1.8, class: 'tut__ring', style: `animation-delay:${i * 0.16}s` }),
    ),
    svg('circle', { r: 4, fill: BLUE }),
  ];
}

function swipe(dir: Swipe): SVGElement[] {
  const arrow = {
    up: 'M0 10 V-10 M-5 -5 L0 -10 L5 -5',
    down: 'M0 -10 V10 M-5 5 L0 10 L5 5',
    h: 'M-12 0 H12 M-7 -5 L-12 0 L-7 5 M7 -5 L12 0 L7 5',
  }[dir];
  return [
    svg('path', { d: arrow, fill: 'none', stroke: BLUE, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.55 }),
    svg('circle', { r: 4.6, fill: BLUE, stroke: '#fff', 'stroke-width': 1.6, class: `tut__finger tut__finger--${dir}` }),
  ];
}

const SCENES: Readonly<Record<MoveId, Scene>> = {
  jump: { bg: ['#e8f6ff', '#bfe4ff'], lift: 8, taps: 1, at: [64, 18] },
  double: { bg: ['#efe9ff', '#d6c9ff'], lift: 18, taps: 2, at: [64, 18] },
  triple: { bg: ['#efe9ff', '#cbb9ff'], lift: 27, taps: 3, at: [64, 18] },
  bird: {
    bg: ['#ffe9ee', '#ffc7d4'], lift: 4, taps: 1, at: [66, 44],
    extras: () => [svg('path', { d: 'M4 25 H76', stroke: '#ff4d6d', 'stroke-width': 2, 'stroke-dasharray': '3 4', 'stroke-linecap': 'round' }), bird()],
  },
  tumble: { bg: ['#fff6dc', '#ffe08a'], lift: 18, swipe: 'up', at: [67, 30], flip: true, rope: 'none', extras: () => ring(`tut-ring-${uid}`) },
  side: { bg: ['#e2fbf3', '#aef0d8'], lift: 12, x: 26, swipe: 'h', at: [52, 14], extras: () => [ball()] },
  cross: { bg: ['#ffe9f3', '#ffc4de'], lift: 16, x: 26, swipe: 'h', at: [58, 34], crossArms: true },
  back: { bg: ['#e8f0ff', '#c4d6ff'], lift: 8, x: 32, swipe: 'down', at: [67, 30], rope: 'back' },
  dd: { bg: ['#e2fbf3', '#bdf3e2'], lift: 14, taps: 1, at: [66, 14], rope: 'double' },
};

/** Returns a fresh animated illustration for a move. */
export function moveArt(id: MoveId): SVGElement {
  const s = SCENES[id];
  uid += 1;
  const bg = `tut-bg-${uid}`;
  const clip = `tut-clip-${uid}`;
  const gesture = s.swipe ? swipe(s.swipe) : taps(s.taps ?? 1);
  return svg('svg', { class: `tut__art tut__art--${id}`, viewBox: '0 0 80 80', 'aria-hidden': 'true' }, [
    svg('defs', {}, [
      svg('clipPath', { id: clip }, [svg('rect', { width: 80, height: 80, rx: 22 })]),
      svg('linearGradient', { id: bg, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg('stop', { offset: 0, 'stop-color': s.bg[0] }),
        svg('stop', { offset: 1, 'stop-color': s.bg[1] }),
      ]),
    ]),
    svg('g', { 'clip-path': `url(#${clip})` }, [
      svg('rect', { width: 80, height: 80, fill: `url(#${bg})` }),
      svg('rect', { y: GROUND, width: 80, height: 16, fill: '#7fd68a' }),
      ...rope(s.rope ?? 'normal'),
      ...(s.extras?.() ?? []),
      figure(s),
    ]),
    svg('g', { transform: `translate(${s.at[0]} ${s.at[1]})` }, gesture),
  ]);
}

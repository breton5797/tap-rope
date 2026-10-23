// Character avatars for the shop, built as inline SVG (100x100 grid).
import type { SkinId } from '../types';
import { svg } from './dom';

type Attrs = Readonly<Record<string, string | number>>;
type Shape = readonly [string, Attrs, string?];

interface SkinArt {
  readonly bg: readonly [string, string];
  readonly body: string;
  readonly face: string;
  readonly back: readonly Shape[];
  readonly head?: readonly Shape[];
  readonly front: readonly Shape[];
  readonly eyes?: string;
  readonly mask?: boolean; // face covered: no blush/mouth
}

const INK = '#1d2238';
const SKIN_TONE = '#ffd9b8';
const SUIT = '#273150';
const RED = '#ff3b5c';
const CYAN = '#2ee6ff';

/** shirt collar + tie on the suit body */
const TIE: readonly Shape[] = [
  ['path', { d: 'M43 66 L50 75 L57 66z', fill: '#f4f7ff' }],
  ['path', { d: 'M48.4 69 L50 84 L51.6 69z', fill: RED }],
];
const EARPIECE: readonly Shape[] = [
  ['path', { d: 'M74 46 q4 10 -3 18', fill: 'none', stroke: '#9fb0d8', 'stroke-width': 1.6 }],
  ['circle', { cx: 74.5, cy: 45, r: 3.2, fill: '#9fb0d8' }],
];
const GOGGLES: readonly Shape[] = [
  ['rect', { x: 25, y: 27, width: 50, height: 8, rx: 4, fill: '#20283f' }],
  ['circle', { cx: 40, cy: 31, r: 6.5, fill: CYAN, stroke: '#20283f', 'stroke-width': 2.5 }],
  ['circle', { cx: 60, cy: 31, r: 6.5, fill: CYAN, stroke: '#20283f', 'stroke-width': 2.5 }],
  ['circle', { cx: 38, cy: 29, r: 1.8, fill: '#fff' }],
  ['circle', { cx: 58, cy: 29, r: 1.8, fill: '#fff' }],
];

const ART: Readonly<Record<SkinId, SkinArt>> = {
  kid: {
    bg: ['#2b3c80', '#111a3d'],
    body: SUIT,
    face: SKIN_TONE,
    back: [],
    front: [
      ['path', { d: 'M25 42C24 24 38 16 51 16.5c14 .5 25 10 24 25-5-7-13-10-20-9.5-3-4-9-6-14-4-6 2-11 7-16 14z', fill: INK }],
      ...GOGGLES,
      ...TIE,
      ...EARPIECE,
    ],
  },
  cat: {
    bg: ['#4a2f7a', '#170f36'],
    body: SUIT,
    face: '#ffb760',
    back: [
      ['path', { d: 'M28 34L30 11l18 13z', fill: '#ff9b3d' }],
      ['path', { d: 'M72 34L70 11 52 24z', fill: '#ff9b3d' }],
      ['path', { d: 'M32 28l1-10 8 6z', fill: '#ffc3d0' }],
      ['path', { d: 'M68 28l-1-10-8 6z', fill: '#ffc3d0' }],
    ],
    front: [
      ['path', { d: 'M44 20.5l2 7M50 19v8M56 20.5l-2 7', stroke: '#e57a1f', 'stroke-width': 2.6, 'stroke-linecap': 'round', fill: 'none' }],
      ['path', { d: 'M22 50h11M23 56l10-3M78 50H67M77 56l-10-3', stroke: '#7a4a1e', 'stroke-width': 1.6, 'stroke-linecap': 'round', fill: 'none', opacity: 0.6 }],
      ['path', { d: 'M48 50.5h4l-2 2.5z', fill: '#ff6b8a' }],
      ['path', { d: 'M50 64 L41 59 L41 69z M50 64 L59 59 L59 69z', fill: RED }],
      ['circle', { cx: 50, cy: 64, r: 2.4, fill: '#c4123a' }],
    ],
  },
  bunny: {
    bg: ['#3b2a78', '#120c2c'],
    body: '#6a54f0',
    face: '#ffffff',
    back: [
      ['ellipse', { cx: 39, cy: 14, rx: 7.5, ry: 19, fill: '#ffffff', transform: 'rotate(-12 39 14)' }],
      ['ellipse', { cx: 61, cy: 14, rx: 7.5, ry: 19, fill: '#ffffff', transform: 'rotate(12 61 14)' }],
      ['ellipse', { cx: 39, cy: 15, rx: 3.6, ry: 13, fill: '#ffb3d1', transform: 'rotate(-12 39 15)' }],
      ['ellipse', { cx: 61, cy: 15, rx: 3.6, ry: 13, fill: '#ffb3d1', transform: 'rotate(12 61 15)' }],
    ],
    front: [
      ['ellipse', { cx: 50, cy: 51, rx: 3, ry: 2.2, fill: '#ff7aa8' }],
      ['path', { d: 'M24 44 A26 26 0 0 1 76 44', fill: 'none', stroke: '#20283f', 'stroke-width': 3.5 }],
      ['rect', { x: 20, y: 39, width: 8, height: 13, rx: 4, fill: '#20283f' }],
      ['rect', { x: 72, y: 39, width: 8, height: 13, rx: 4, fill: '#20283f' }],
      ['path', { d: 'M24 50 q2 9 14 8', fill: 'none', stroke: '#20283f', 'stroke-width': 2 }],
      ['circle', { cx: 39, cy: 58, r: 2.4, fill: CYAN }],
      ['rect', { x: 41, y: 70, width: 18, height: 10, rx: 2, fill: '#20283f' }],
      ['path', { d: 'M44 74h4M44 77h8', stroke: '#3ff0a6', 'stroke-width': 1.4 }],
    ],
  },
  robot: {
    bg: ['#14425c', '#061823'],
    body: '#8ea1cc',
    face: '#c8d3ee',
    eyes: RED,
    back: [
      ['path', { d: 'M50 19V8', stroke: '#8ea1cc', 'stroke-width': 3, 'stroke-linecap': 'round' }],
      ['circle', { cx: 50, cy: 7.5, r: 4.5, fill: RED }],
      ['rect', { x: 20, y: 36, width: 7, height: 14, rx: 3, fill: '#8ea1cc' }],
      ['rect', { x: 73, y: 36, width: 7, height: 14, rx: 3, fill: '#8ea1cc' }],
    ],
    head: [
      ['rect', { x: 25, y: 19, width: 50, height: 44, rx: 13, fill: '#c8d3ee' }],
      ['rect', { x: 31, y: 33, width: 38, height: 20, rx: 9, fill: '#1a2140' }],
    ],
    front: [
      ['rect', { x: 36, y: 66, width: 28, height: 10, rx: 3, fill: '#1a2140' }],
      ['text', { x: 50, y: 74.5, 'text-anchor': 'middle', 'font-size': 8, 'font-family': 'monospace', 'font-weight': 700, fill: CYAN }, 'R-7'],
    ],
  },
  ninja: {
    bg: ['#4a1238', '#160610'],
    body: '#1f2238',
    face: '#1f2238',
    back: [
      ['path', { d: 'M72 32c8 0 14 3 18 9-6-1-11 0-16 3z', fill: RED }],
      ['path', { d: 'M73 37c7 3 11 8 12 15-5-4-9-6-14-6z', fill: '#c4123a' }],
    ],
    mask: true,
    head: [
      ['circle', { cx: 50, cy: 42, r: 25, fill: '#1f2238' }],
      ['rect', { x: 28, y: 36, width: 44, height: 15, rx: 7.5, fill: SKIN_TONE }],
      ['rect', { x: 26.5, y: 28, width: 47, height: 6, rx: 3, fill: RED }],
    ],
    front: [['rect', { x: 32, y: 75, width: 36, height: 5, rx: 2.5, fill: RED }], ...EARPIECE],
  },
  astro: {
    bg: ['#2c3f30', '#0b140e'],
    body: '#3d4b37',
    face: SKIN_TONE,
    back: [],
    head: [
      ['circle', { cx: 50, cy: 44, r: 24, fill: SKIN_TONE }],
      ['path', { d: 'M23 42 A27 27 0 0 1 77 42 L77 46 H23z', fill: '#4b5d43' }],
      ['rect', { x: 30, y: 37, width: 40, height: 12, rx: 6, fill: '#101820' }],
      ['path', { d: 'M34 41 h9', stroke: CYAN, 'stroke-width': 2.4, 'stroke-linecap': 'round' }],
    ],
    eyes: CYAN,
    mask: true,
    front: [
      ['rect', { x: 33, y: 64, width: 10, height: 9, rx: 2, fill: '#2a3527' }],
      ['rect', { x: 57, y: 64, width: 10, height: 9, rx: 2, fill: '#2a3527' }],
      ['path', { d: 'M44 56 q6 4 12 0', fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linecap': 'round' }],
      ...EARPIECE,
    ],
  },
};

function shapes(list: readonly Shape[]): SVGElement[] {
  return list.map(([tag, attrs, text]) => svg(tag, attrs, text === undefined ? [] : [text]));
}

function faceFeatures(art: SkinArt): SVGElement[] {
  const eye = art.eyes ?? INK;
  const glow = art.eyes !== undefined;
  const parts: Shape[] = [
    ['ellipse', { cx: 41, cy: 44, rx: 3.4, ry: glow ? 3.4 : 4.4, fill: eye }],
    ['ellipse', { cx: 59, cy: 44, rx: 3.4, ry: glow ? 3.4 : 4.4, fill: eye }],
    ['circle', { cx: 42.2, cy: 42.4, r: 1.3, fill: '#fff' }],
    ['circle', { cx: 60.2, cy: 42.4, r: 1.3, fill: '#fff' }],
  ];
  if (!glow && !art.mask) {
    parts.push(
      ['ellipse', { cx: 34, cy: 52, rx: 4.5, ry: 2.8, fill: '#ff7aa0', opacity: 0.45 }],
      ['ellipse', { cx: 66, cy: 52, rx: 4.5, ry: 2.8, fill: '#ff7aa0', opacity: 0.45 }],
      ['path', { d: 'M45 53.5q5 5 10 0', stroke: INK, 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none' }],
    );
  }
  return shapes(parts);
}

/** Returns a self-contained avatar illustration for a skin. */
export function avatar(id: SkinId, withBg = true): SVGElement {
  const art = ART[id];
  const gid = `av-bg-${id}`;
  const defs = svg('defs', {}, [
    svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, [
      svg('stop', { offset: 0, 'stop-color': art.bg[0] }),
      svg('stop', { offset: 1, 'stop-color': art.bg[1] }),
    ]),
  ]);
  const head = art.head ?? [['circle', { cx: 50, cy: 42, r: 25, fill: art.face }] as const];
  return svg('svg', { viewBox: '0 0 100 100', class: `avatar avatar--${id}`, 'aria-hidden': 'true' }, [
    defs,
    withBg ? svg('rect', { x: 0, y: 0, width: 100, height: 100, rx: 26, fill: `url(#${gid})` }) : null,
    withBg ? svg('circle', { cx: 80, cy: 18, r: 22, fill: '#fff', opacity: 0.16 }) : null,
    svg('ellipse', { cx: 50, cy: 92, rx: 24, ry: 4.5, fill: '#000', opacity: 0.16 }),
    ...shapes(art.back),
    svg('rect', { x: 29, y: 58, width: 42, height: 32, rx: 15, fill: art.body }),
    ...shapes(head),
    ...faceFeatures(art),
    ...shapes(art.front),
  ]);
}

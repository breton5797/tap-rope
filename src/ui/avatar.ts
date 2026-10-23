// Character avatars for the shop, built as inline SVG (100x100 grid).
import type { SkinId } from '../types';
import { svg } from './dom';

type Attrs = Readonly<Record<string, string | number>>;
type Shape = readonly [string, Attrs];

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

const INK = '#2a2350';
const SKIN_TONE = '#ffd9b8';

const ART: Readonly<Record<SkinId, SkinArt>> = {
  kid: {
    bg: ['#8fd3ff', '#4fa8ff'],
    body: '#ff5d6c',
    face: SKIN_TONE,
    back: [],
    front: [
      ['path', { d: 'M25 42C24 24 38 16 51 16.5c14 .5 25 10 24 25-5-7-13-10-20-9.5-3-4-9-6-14-4-6 2-11 7-16 14z', fill: '#4a2c2a' }],
      ['circle', { cx: 50, cy: 15.5, r: 4, fill: '#4a2c2a' }],
    ],
  },
  cat: {
    bg: ['#ffd27a', '#ff9f43'],
    body: '#ff9b3d',
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
    ],
  },
  bunny: {
    bg: ['#ffd1e8', '#ff8cc6'],
    body: '#ffc4dd',
    face: '#ffffff',
    back: [
      ['ellipse', { cx: 39, cy: 14, rx: 7.5, ry: 19, fill: '#ffffff', transform: 'rotate(-12 39 14)' }],
      ['ellipse', { cx: 61, cy: 14, rx: 7.5, ry: 19, fill: '#ffffff', transform: 'rotate(12 61 14)' }],
      ['ellipse', { cx: 39, cy: 15, rx: 3.6, ry: 13, fill: '#ffb3d1', transform: 'rotate(-12 39 15)' }],
      ['ellipse', { cx: 61, cy: 15, rx: 3.6, ry: 13, fill: '#ffb3d1', transform: 'rotate(12 61 15)' }],
    ],
    front: [['ellipse', { cx: 50, cy: 51, rx: 3, ry: 2.2, fill: '#ff7aa8' }]],
  },
  robot: {
    bg: ['#b8f1ff', '#55c7e8'],
    body: '#8ea1cc',
    face: '#c8d3ee',
    eyes: '#28e0ff',
    back: [
      ['path', { d: 'M50 19V8', stroke: '#8ea1cc', 'stroke-width': 3, 'stroke-linecap': 'round' }],
      ['circle', { cx: 50, cy: 7.5, r: 4.5, fill: '#ff5d6c' }],
      ['rect', { x: 20, y: 36, width: 7, height: 14, rx: 3, fill: '#8ea1cc' }],
      ['rect', { x: 73, y: 36, width: 7, height: 14, rx: 3, fill: '#8ea1cc' }],
    ],
    head: [
      ['rect', { x: 25, y: 19, width: 50, height: 44, rx: 13, fill: '#c8d3ee' }],
      ['rect', { x: 31, y: 33, width: 38, height: 20, rx: 9, fill: '#2b3561' }],
    ],
    front: [['rect', { x: 41, y: 70, width: 18, height: 7, rx: 3.5, fill: '#28e0ff', opacity: 0.85 }]],
  },
  ninja: {
    bg: ['#c7c2ff', '#7b6cff'],
    body: '#2b2b45',
    face: '#2b2b45',
    back: [
      ['path', { d: 'M72 32c8 0 14 3 18 9-6-1-11 0-16 3z', fill: '#ff4d6d' }],
      ['path', { d: 'M73 37c7 3 11 8 12 15-5-4-9-6-14-6z', fill: '#e2304f' }],
    ],
    mask: true,
    head: [
      ['circle', { cx: 50, cy: 42, r: 25, fill: '#2b2b45' }],
      ['rect', { x: 28, y: 36, width: 44, height: 15, rx: 7.5, fill: SKIN_TONE }],
      ['rect', { x: 26.5, y: 28, width: 47, height: 6, rx: 3, fill: '#ff4d6d' }],
    ],
    front: [['rect', { x: 32, y: 75, width: 36, height: 5, rx: 2.5, fill: '#ff4d6d' }]],
  },
  astro: {
    bg: ['#3b4a9c', '#141a46'],
    body: '#f4f7ff',
    face: '#f4f7ff',
    eyes: '#7df9ff',
    back: [['rect', { x: 64, y: 58, width: 14, height: 22, rx: 5, fill: '#c7d0ea' }]],
    head: [
      ['circle', { cx: 50, cy: 42, r: 27, fill: '#f4f7ff', stroke: '#c7d0ea', 'stroke-width': 2.5 }],
      ['rect', { x: 30, y: 30, width: 40, height: 26, rx: 13, fill: '#233a73' }],
      ['path', { d: 'M35 37c2-3 5-4.5 9-4.5', stroke: '#9fe9ff', 'stroke-width': 2.6, 'stroke-linecap': 'round', fill: 'none' }],
    ],
    front: [
      ['rect', { x: 39, y: 66, width: 12, height: 8, rx: 2, fill: '#ff5d6c' }],
      ['circle', { cx: 57, cy: 70, r: 3, fill: '#4fb8ff' }],
    ],
  },
};

function shapes(list: readonly Shape[]): SVGElement[] {
  return list.map(([tag, attrs]) => svg(tag, attrs));
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

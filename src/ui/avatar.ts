// Operator portraits for the loadout screen (100x100 inline SVG, GDD-v6 §3): full-body adult silhouettes
// (~7.5 heads), no faces, flat shading with a rim light in the operator's accent colour.
import type { SkinId } from '../types';
import { svg } from './dom';

type Attrs = Readonly<Record<string, string | number>>;
type Shape = readonly [string, Attrs];

interface Operator {
  readonly suit: string;
  readonly vest: string;
  readonly head: string; // balaclava / hood / helmet base
  readonly accent: string; // visor, lenses, status light
  readonly rim: string;
  readonly behind: readonly Shape[]; // backpack, sheath…
  readonly headgear: readonly Shape[];
  readonly extra: readonly Shape[];
}

const TEAL = '#3fe0d0';
const AMBER = '#ffb020';
const RED = '#ff2a3a';
const STEEL = '#7d8a93';

/** torso + arms + legs as one outline so it can carry the rim light */
const BODY = 'M44 25 L56 25 L64 29 L66 52 L63 60 L61 59 L61 36 L59 36 L59 55 L58 93 L52 93 L51 58 L49 58 L48 93 L42 93 L41 55 L41 36 L39 36 L39 59 L37 60 L34 52 L36 29 Z';
const RIM = 'M44 25 L36 29 L34 52 L37 60 M41 55 L42 93 M45 13 Q44 18 45.5 22';

const NVG: readonly Shape[] = [
  ['rect', { x: 45, y: 11.5, width: 10, height: 3, rx: 0.5, fill: '#2b3238' }],
  ['rect', { x: 46, y: 7.5, width: 3, height: 5, fill: '#2b3238' }],
  ['rect', { x: 51, y: 7.5, width: 3, height: 5, fill: '#2b3238' }],
  ['circle', { cx: 47.5, cy: 7.8, r: 0.9, fill: TEAL }],
  ['circle', { cx: 52.5, cy: 7.8, r: 0.9, fill: TEAL }],
];
const EARPIECE: readonly Shape[] = [['path', { d: 'M55 18 q2 3 0 6', fill: 'none', stroke: STEEL, 'stroke-width': 0.8 }]];

const OPS: Readonly<Record<SkinId, Operator>> = {
  // 에이전트 K — black tactical, NVG
  kid: { suit: '#1d2227', vest: '#2a3036', head: '#22272c', accent: TEAL, rim: TEAL, behind: [], headgear: [...NVG, ...EARPIECE], extra: [] },
  // 블랙캣 — matte stealth suit, visor slit
  cat: {
    suit: '#121518', vest: '#181c20', head: '#121518', accent: TEAL, rim: '#8fa3ad', behind: [],
    headgear: [['rect', { x: 45, y: 16.6, width: 10, height: 1.6, fill: TEAL }]],
    extra: [],
  },
  // 해커 — hood + equipment backpack, wrist terminal
  bunny: {
    suit: '#262b30', vest: '#30363c', head: '#1a1e22', accent: AMBER, rim: AMBER,
    behind: [
      ['rect', { x: 55, y: 27, width: 13, height: 22, rx: 1.5, fill: '#2e353b' }],
      ['path', { d: 'M65 27 V15', stroke: STEEL, 'stroke-width': 0.9 }],
      ['circle', { cx: 65, cy: 14.5, r: 0.9, fill: AMBER }],
    ],
    headgear: [['path', { d: 'M42.5 24 Q41.5 9 50 9 Q58.5 9 57.5 24 Z', fill: '#2a3036' }], ['path', { d: 'M45 13 Q50 11 55 13 L55 22 Q50 24 45 22 Z', fill: '#101316' }]],
    extra: [['rect', { x: 34.5, y: 53, width: 4, height: 3, fill: AMBER, opacity: 0.9 }]],
  },
  // R-7 — combat android, metal shell, red sensor bar
  robot: {
    suit: '#4f5961', vest: '#606b74', head: '#606b74', accent: RED, rim: '#c9d3d9', behind: [],
    headgear: [
      ['path', { d: 'M44.5 11 H55.5 L56.5 23 H43.5 Z', fill: '#606b74' }],
      ['rect', { x: 45.5, y: 15.5, width: 9, height: 1.8, fill: RED }],
    ],
    extra: [['path', { d: 'M44 33 H56 M44 38 H56 M50 30 V48', stroke: '#3a434a', 'stroke-width': 0.9 }]],
  },
  // 섀도우 — masked, deep navy, sheath across the back
  ninja: {
    suit: '#141a28', vest: '#1a2132', head: '#141a28', accent: '#8a7768', rim: '#6f86b5',
    behind: [['path', { d: 'M38 46 L63 6', stroke: '#2d3445', 'stroke-width': 2.2 }], ['path', { d: 'M60 10.5 L64 4', stroke: STEEL, 'stroke-width': 1.4 }]],
    headgear: [['rect', { x: 45.5, y: 16.4, width: 9, height: 1.5, fill: '#8a7768' }]],
    extra: [],
  },
  // 특수부대 — olive fatigues, helmet with NVG mount
  astro: {
    suit: '#363d2f', vest: '#454d3b', head: '#2c3227', accent: TEAL, rim: AMBER, behind: [],
    headgear: [
      ['path', { d: 'M43 17.5 Q43 8.5 50 8.5 Q57 8.5 57 17.5 Z', fill: '#4a523f' }],
      ['rect', { x: 47.5, y: 9, width: 5, height: 2.5, fill: '#2b3238' }],
      ['rect', { x: 45, y: 17, width: 10, height: 2.4, rx: 0.6, fill: '#15191c' }],
    ],
    extra: [],
  },
};

let uid = 0;

function shapes(list: readonly Shape[]): SVGElement[] {
  return list.map(([tag, attrs]) => svg(tag, attrs));
}

/** Returns a self-contained portrait for an operator skin. */
export function avatar(id: SkinId, withBg = true): SVGElement {
  const op = OPS[id];
  uid += 1;
  const bg = `op-bg-${uid}`;
  const light = `op-light-${uid}`;
  // portrait crop around the standing figure (x 18..82, y 2..98)
  return svg('svg', { viewBox: '18 2 64 96', class: `avatar avatar--${id}`, 'aria-hidden': 'true' }, [
    svg('defs', {}, [
      svg('linearGradient', { id: bg, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg('stop', { offset: 0, 'stop-color': '#172026' }),
        svg('stop', { offset: 1, 'stop-color': '#080a0d' }),
      ]),
      svg('radialGradient', { id: light, cx: 0.5, cy: 0, r: 0.8 }, [
        svg('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.12 }),
        svg('stop', { offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 0 }),
      ]),
    ]),
    withBg ? svg('rect', { width: 100, height: 100, rx: 3, fill: `url(#${bg})` }) : null,
    withBg ? svg('rect', { width: 100, height: 100, rx: 3, fill: `url(#${light})` }) : null,
    withBg ? svg('path', { d: 'M0 94 H100', stroke: 'rgba(196,214,224,0.18)', 'stroke-width': 0.8 }) : null,
    svg('ellipse', { cx: 50, cy: 94, rx: 16, ry: 2.2, fill: '#000', opacity: 0.55 }),
    ...shapes(op.behind),
    svg('path', { d: BODY, fill: op.suit }),
    // shade the far (right) side: key light comes from upper left
    svg('path', { d: 'M50 25 L56 25 L64 29 L66 52 L63 60 L61 59 L61 36 L59 36 L59 55 L58 93 L52 93 L51 58 L50 58 Z', fill: '#000', opacity: 0.22 }),
    svg('path', { d: 'M41 30 H59 V48 H41 Z', fill: op.vest }),
    svg('path', { d: 'M42.5 41 h4 v5 h-4z M48 41 h4 v5 h-4z M53.5 41 h4 v5 h-4z', fill: '#000', opacity: 0.25 }),
    svg('rect', { x: 41, y: 51, width: 18, height: 2.6, fill: '#0e1114' }),
    svg('rect', { x: 58.5, y: 57, width: 4, height: 9, fill: '#0e1114' }),
    svg('path', { d: 'M41 89 h7.5 v4.5 h-8z M51.5 89 h7.5 l.5 4.5 h-8z', fill: '#0b0d10' }),
    svg('rect', { x: 47.6, y: 21.5, width: 4.8, height: 4.5, fill: op.head }),
    svg('ellipse', { cx: 50, cy: 17.5, rx: 5, ry: 6, fill: op.head }),
    ...shapes(op.headgear),
    ...shapes(op.extra),
    svg('circle', { cx: 57, cy: 32, r: 0.9, fill: op.accent }),
    svg('path', { d: RIM, fill: 'none', stroke: op.rim, 'stroke-width': 0.8, opacity: 0.7 }),
  ]);
}

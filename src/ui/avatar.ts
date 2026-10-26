// Operator portraits for the loadout screen (inline SVG, GDD-v6 §3): full-body adult silhouettes (~7.5 heads),
// no faces. Each loadout has its own build (shoulders, waist, stance) and kit so the six read apart at a glance.
import type { SkinId } from '../types';
import { svg } from './dom';

type Attrs = Readonly<Record<string, string | number>>;
type Shape = readonly [string, Attrs];

interface Build {
  readonly sh: number; // shoulder half-width
  readonly waist: number; // torso half-width
  readonly leg: number; // leg width
  readonly stance: number; // extra spread of the feet
}

interface Operator {
  readonly build: Build;
  readonly suit: string;
  readonly head: string;
  readonly accent: string; // visor, lenses, status light
  readonly behind: readonly Shape[]; // drawn before the body (packs, sheaths)
  readonly kit: readonly Shape[]; // drawn over the body (vests, plates, weapons)
  readonly headgear: readonly Shape[];
}

const CX = 50;
const TEAL = '#3fe0d0';
const AMBER = '#ffb020';
const RED = '#ff2a3a';
const STEEL = '#7d8a93';
const DARK = '#0e1114';

/** Mirrored outline of torso + arms + legs for a build. */
function bodyPath(b: Build): string {
  const left: (readonly [number, number])[] = [
    [-6, 25],
    [-b.sh, 29],
    [-(b.sh + 2), 52],
    [-(b.sh - 1), 60],
    [-(b.sh - 3), 59],
    [-(b.sh - 3), 36],
    [-b.waist, 36],
    [-b.waist, 55],
    [-(b.waist + b.stance), 93],
    [-(b.waist + b.stance - b.leg), 93],
    [-1, 58],
  ];
  const right = [...left].reverse().map(([x, y]) => [-x, y] as const);
  return `M${[...left, ...right].map(([x, y]) => `${CX + x} ${y}`).join(' L')} Z`;
}

/** Right half only, darkened: the key light comes from upper left. */
function shadePath(b: Build): string {
  return `M${CX} 25 L${CX + 6} 25 L${CX + b.sh} 29 L${CX + b.sh + 2} 52 L${CX + b.sh - 1} 60 L${CX + b.sh - 3} 59 L${CX + b.sh - 3} 36 L${CX + b.waist} 36 L${CX + b.waist} 55 L${CX + b.waist + b.stance} 93 L${CX + b.waist + b.stance - b.leg} 93 L${CX + 1} 58 L${CX} 58 Z`;
}

const boots = (b: Build): Shape => {
  const o = b.waist + b.stance;
  return ['path', { d: `M${CX - o} 89 h${b.leg} v4.5 h-${b.leg + 0.6}z M${CX + o - b.leg} 89 h${b.leg} l.6 4.5 h-${b.leg + 0.6}z`, fill: '#0b0d10' }];
};

const vest = (fill: string, w = 9, top = 30, bottom = 48): readonly Shape[] => [
  ['path', { d: `M${CX - w} ${top} H${CX + w} V${bottom} H${CX - w} Z`, fill }],
  ['path', { d: `M${CX - w + 1.5} ${bottom - 7} h4 v5 h-4z M${CX - 2} ${bottom - 7} h4 v5 h-4z M${CX + w - 5.5} ${bottom - 7} h4 v5 h-4z`, fill: '#000', opacity: 0.28 }],
];

const NVG: readonly Shape[] = [
  ['rect', { x: 45, y: 11.5, width: 10, height: 3, rx: 0.5, fill: '#2b3238' }],
  ['rect', { x: 46, y: 7.5, width: 3, height: 5, fill: '#2b3238' }],
  ['rect', { x: 51, y: 7.5, width: 3, height: 5, fill: '#2b3238' }],
  ['circle', { cx: 47.5, cy: 7.8, r: 0.9, fill: TEAL }],
  ['circle', { cx: 52.5, cy: 7.8, r: 0.9, fill: TEAL }],
];

const OPS: Readonly<Record<SkinId, Operator>> = {
  // 에이전트 K — black tactical: standard build, plate vest, holster, NVG + earpiece
  kid: {
    build: { sh: 14, waist: 9, leg: 7, stance: 0 },
    suit: '#1d2227', head: '#22272c', accent: TEAL, behind: [],
    kit: [...vest('#2a3036'), ['rect', { x: 41, y: 51, width: 18, height: 2.6, fill: DARK }], ['rect', { x: 58.5, y: 57, width: 4, height: 9, fill: DARK }]],
    headgear: [...NVG, ['path', { d: 'M55 18 q2 3 0 6', fill: 'none', stroke: STEEL, 'stroke-width': 0.8 }]],
  },
  // 블랙캣 — matte stealth suit: slim build, no vest, seam lines, visor slit
  cat: {
    build: { sh: 11.5, waist: 7.5, leg: 6, stance: 0.5 },
    suit: '#121518', head: '#121518', accent: TEAL, behind: [],
    kit: [
      ['path', { d: 'M50 27 V57 M43 36 L50 44 L57 36', fill: 'none', stroke: '#2c3238', 'stroke-width': 0.7 }],
      ['rect', { x: 42.5, y: 53, width: 15, height: 1.4, fill: '#2c3238' }],
    ],
    headgear: [['rect', { x: 45, y: 16.6, width: 10, height: 1.6, fill: TEAL }]],
  },
  // 해커 — loose hoodie build, wide equipment pack, cable to a wrist terminal
  bunny: {
    build: { sh: 13, waist: 10.5, leg: 7.5, stance: 1 },
    suit: '#262b30', head: '#1a1e22', accent: AMBER,
    behind: [
      ['rect', { x: 53, y: 26, width: 17, height: 24, rx: 1.5, fill: '#2e353b' }],
      ['path', { d: 'M67 26 V12', stroke: STEEL, 'stroke-width': 0.9 }],
      ['circle', { cx: 67, cy: 11.5, r: 0.9, fill: AMBER }],
    ],
    kit: [
      ['path', { d: 'M62 44 C68 52 60 62 38 57', fill: 'none', stroke: '#11161a', 'stroke-width': 1.3 }],
      ['rect', { x: 34, y: 54.5, width: 5, height: 3.5, fill: AMBER, opacity: 0.9 }],
      ['path', { d: 'M42 44 H58', stroke: '#1c2125', 'stroke-width': 1 }],
    ],
    headgear: [['path', { d: 'M42 25 Q40.5 8 50 8 Q59.5 8 58 25 Z', fill: '#2a3036' }], ['path', { d: 'M45 13 Q50 11 55 13 L55 22 Q50 24 45 22 Z', fill: '#0c0f12' }]],
  },
  // R-7 — combat android: broad heavy frame, shoulder and knee plates, angular head, red sensor bar
  robot: {
    build: { sh: 17, waist: 10, leg: 8.5, stance: 1.5 },
    suit: '#4f5961', head: '#606b74', accent: RED, behind: [],
    kit: [
      ['path', { d: 'M31 27 L41 25 L42 34 L32 36 Z M69 27 L59 25 L58 34 L68 36 Z', fill: '#6b7781' }],
      ['path', { d: 'M42 30 H58 L56 46 H44 Z', fill: '#5d6871' }],
      ['path', { d: 'M44 35 H56 M45 40 H55 M50 30 V46', stroke: '#3a434a', 'stroke-width': 0.9 }],
      ['path', { d: 'M40 72 h7 v5 h-7z M53 72 h7 v5 h-7z', fill: '#6b7781' }],
    ],
    headgear: [['path', { d: 'M44 10.5 H56 L57 23 H43 Z', fill: '#606b74' }], ['rect', { x: 45, y: 15.5, width: 10, height: 1.8, fill: RED }]],
  },
  // 섀도우 — navy wrap, wide low stance, chest sash, leg wraps, mask, sheath across the back
  ninja: {
    build: { sh: 12.5, waist: 8, leg: 6.5, stance: 4 },
    suit: '#141a28', head: '#141a28', accent: '#8a7768',
    behind: [['path', { d: 'M36 50 L64 5', stroke: '#2d3445', 'stroke-width': 2.4 }], ['path', { d: 'M61 9.5 L65 3', stroke: STEEL, 'stroke-width': 1.4 }]],
    kit: [
      ['path', { d: 'M42 30 L58 50', stroke: '#232b3f', 'stroke-width': 3 }],
      ['rect', { x: 42, y: 52, width: 16, height: 2.4, fill: '#232b3f' }],
      ['path', { d: 'M39 80 l7 -2 M39 84 l7 -2 M54 78 l7 2 M54 82 l7 2', stroke: '#232b3f', 'stroke-width': 1 }],
    ],
    headgear: [['rect', { x: 45.5, y: 16.4, width: 9, height: 1.5, fill: '#8a7768' }]],
  },
  // 특수부대 — olive fatigues: heavy plate carrier, rifle across the chest, helmet with NVG mount, radio whip
  astro: {
    build: { sh: 15, waist: 10, leg: 7.5, stance: 1.5 },
    suit: '#363d2f', head: '#2c3227', accent: TEAL,
    behind: [['path', { d: 'M38 30 L33 6', stroke: '#2a2f26', 'stroke-width': 0.9 }]],
    kit: [
      ...vest('#454d3b', 10.5, 29, 50),
      ['path', { d: 'M33 52 L68 37 L69.5 39.5 L35 55 Z', fill: '#15191c' }],
      ['path', { d: 'M45 47 l2 5 h2.5 l-2 -6z', fill: '#15191c' }],
    ],
    headgear: [
      ['path', { d: 'M42.5 18 Q42.5 8 50 8 Q57.5 8 57.5 18 Z', fill: '#4a523f' }],
      ['rect', { x: 47.5, y: 8.5, width: 5, height: 2.5, fill: '#2b3238' }],
      ['rect', { x: 45, y: 17, width: 10, height: 2.4, rx: 0.6, fill: '#15191c' }],
    ],
  },
};

let uid = 0;

function shapes(list: readonly Shape[]): SVGElement[] {
  return list.map(([tag, attrs]) => svg(tag, attrs));
}

/** Returns a self-contained portrait for an operator skin. */
export function avatar(id: SkinId, withBg = true): SVGElement {
  const op = OPS[id];
  const body = bodyPath(op.build);
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
    withBg ? svg('rect', { x: 0, width: 100, height: 100, fill: `url(#${bg})` }) : null,
    withBg ? svg('rect', { x: 0, width: 100, height: 100, fill: `url(#${light})` }) : null,
    withBg ? svg('path', { d: 'M0 94 H100', stroke: 'rgba(196,214,224,0.18)', 'stroke-width': 0.8 }) : null,
    svg('ellipse', { cx: CX, cy: 94, rx: 17 + op.build.stance, ry: 2.2, fill: '#000', opacity: 0.55 }),
    ...shapes(op.behind),
    svg('path', { d: body, fill: op.suit }),
    svg('path', { d: shadePath(op.build), fill: '#000', opacity: 0.22 }),
    ...shapes(op.kit),
    shapes([boots(op.build)])[0],
    svg('rect', { x: 47.6, y: 21.5, width: 4.8, height: 4.5, fill: op.head }),
    svg('ellipse', { cx: CX, cy: 17.5, rx: 5, ry: 6, fill: op.head }),
    ...shapes(op.headgear),
    svg('circle', { cx: CX + op.build.waist - 2, cy: 32, r: 0.9, fill: op.accent }),
    // even, faint edge light all round (no one-sided rim)
    svg('path', { d: body, fill: 'none', stroke: 'rgba(196,214,224,0.28)', 'stroke-width': 0.5 }),
  ]);
}

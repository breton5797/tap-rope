// Decorative scene (200x130, right-aligned) for each zone card: theme × variant.
import type { Variant, WorldId } from '../types';
import { svg } from './dom';

type Scene = () => SVGElement[];

const W = 'rgba(255,255,255,';

function fence(): SVGElement[] {
  const lines = Array.from({ length: 14 }, (_, i) => `M${60 + i * 12} 130 L${100 + i * 12} 82 M${100 + i * 12} 130 L${60 + i * 12} 82`).join(' ');
  return [svg('path', { d: lines, stroke: `${W}0.18)`, 'stroke-width': 1.4 }), svg('path', { d: 'M56 82 H200', stroke: `${W}0.35)`, 'stroke-width': 2 })];
}

function tower(): SVGElement[] {
  return [
    svg('path', { d: 'M150 130 L158 60 M180 130 L172 60 M152 104 L178 104', stroke: '#9fb0d8', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    svg('rect', { x: 146, y: 44, width: 38, height: 18, rx: 3, fill: '#33406a' }),
    svg('path', { d: 'M166 52 L60 128 L110 130z', fill: '#ffe58a', opacity: 0.18, class: 'zone__sweep' }),
    svg('circle', { cx: 166, cy: 52, r: 4, fill: '#fff6c8' }),
  ];
}

function skyline(): SVGElement[] {
  const blocks = [[70, 70, 22], [94, 52, 26], [122, 78, 18], [142, 40, 30], [174, 64, 26]] as const;
  return [
    svg('circle', { cx: 176, cy: 26, r: 14, fill: '#f6f3d8' }),
    ...[[90, 18], [120, 30], [150, 12], [62, 36]].map(([x, y]) => svg('circle', { cx: x, cy: y, r: 1.4, fill: '#fff', class: 'zone__twinkle' })),
    ...blocks.map(([x, y, w]) => svg('rect', { x, y, width: w, height: 130 - y, fill: '#0b1230' })),
    ...blocks.flatMap(([x, y]) => [0, 1, 2].map((i) => svg('rect', { x: x + 5 + (i % 2) * 8, y: y + 8 + i * 14, width: 4, height: 5, fill: '#ffd76a', opacity: 0.8 }))),
  ];
}

function dawn(): SVGElement[] {
  return [
    svg('circle', { cx: 182, cy: 112, r: 24, fill: '#ffd76a', opacity: 0.95 }),
    svg('ellipse', { cx: 150, cy: 92, rx: 26, ry: 6, fill: `${W}0.3)` }),
    svg('g', { class: 'zone__heli', transform: 'translate(122 40)' }, [
      svg('ellipse', { cx: 0, cy: 0, rx: 16, ry: 9, fill: '#1b2347' }),
      svg('path', { d: 'M12 -2 H40 M38 -7 V3', stroke: '#1b2347', 'stroke-width': 4, 'stroke-linecap': 'round' }),
      svg('path', { d: 'M-10 10 H12', stroke: '#1b2347', 'stroke-width': 2.5 }),
      svg('path', { d: 'M-26 -12 H26', stroke: '#1b2347', 'stroke-width': 2.5, class: 'zone__rotor' }),
      svg('ellipse', { cx: -6, cy: -2, rx: 6, ry: 4, fill: '#7fe3ff' }),
    ]),
  ];
}

function flasks(): SVGElement[] {
  return [
    svg('path', { d: 'M60 0V130M100 0V130M140 0V130M180 0V130M40 40H200M40 80H200', stroke: `${W}0.08)`, 'stroke-width': 1.5 }),
    ...[[120, 2], [154, 1.4], [184, 1.7]].map(([x, k]) =>
      svg('g', { transform: `translate(${x} ${118}) scale(${k})` }, [
        svg('path', { d: 'M-4 -30 V-16 L-14 0 H14 L4 -16 V-30z', fill: `${W}0.22)`, stroke: `${W}0.6)`, 'stroke-width': 1.2 }),
        svg('path', { d: 'M-10 -6 H10 L14 0 H-14z', fill: '#3ff0ff' }),
        svg('circle', { cx: 2, cy: -12, r: 1.8, fill: '#bff9ff', class: 'zone__bubble' }),
      ]),
    ),
  ];
}

function racks(): SVGElement[] {
  return [60, 104, 148].flatMap((x) => [
    svg('rect', { x, y: 18, width: 36, height: 112, rx: 3, fill: '#0e1528', stroke: '#2a3a63' }),
    ...Array.from({ length: 6 }, (_, i) => svg('rect', { x: x + 6, y: 28 + i * 16, width: 6, height: 3, rx: 1.5, fill: i % 3 === 0 ? '#3ff0a6' : '#2ee6ff', class: `zone__led zone__led--${(i + x) % 3}` })),
  ]);
}

function siren(): SVGElement[] {
  return [
    svg('path', { d: 'M168 18 L80 130 H200 V60z', fill: '#ff3b5c', opacity: 0.2, class: 'zone__siren' }),
    svg('rect', { x: 160, y: 6, width: 16, height: 14, rx: 7, fill: '#ff5a72' }),
    svg('rect', { x: 156, y: 18, width: 24, height: 5, rx: 2, fill: '#2a1020' }),
  ];
}

function bars(): SVGElement[] {
  return [
    svg('rect', { x: 70, y: 22, width: 130, height: 108, fill: '#0c1020', opacity: 0.55 }),
    ...Array.from({ length: 9 }, (_, i) => svg('rect', { x: 74 + i * 14, y: 22, width: 5, height: 108, rx: 2.5, fill: '#a6aec6' })),
    svg('rect', { x: 70, y: 22, width: 130, height: 6, fill: '#8890aa' }),
    svg('rect', { x: 128, y: 70, width: 16, height: 14, rx: 3, fill: '#ffc53d' }),
    svg('path', { d: 'M131 70 V64 a5 5 0 0 1 10 0 V70', fill: 'none', stroke: '#ffc53d', 'stroke-width': 2.5 }),
  ];
}

function gear(): SVGElement[] {
  const teeth = Array.from({ length: 10 }, (_, i) => svg('rect', { x: -4, y: -36, width: 8, height: 12, rx: 2, fill: '#d9a24a', transform: `rotate(${i * 36})` }));
  return [
    svg('g', { class: 'zone__gear', transform: 'translate(156 70)' }, [...teeth, svg('circle', { r: 27, fill: '#d9a24a' }), svg('circle', { r: 10, fill: '#2e2416' })]),
    svg('rect', { x: 50, y: 112, width: 150, height: 18, fill: 'url(#zone-hazard)' }),
  ];
}

function steam(): SVGElement[] {
  return [
    svg('path', { d: 'M60 96 H200 M60 112 H200', stroke: '#5b8f84', 'stroke-width': 10 }),
    svg('rect', { x: 120, y: 86, width: 10, height: 34, rx: 2, fill: '#4a7a70' }),
    ...[[150, 70, 18], [172, 54, 14], [132, 52, 12]].map(([cx, cy, r], i) => svg('circle', { cx, cy, r, fill: `${W}0.18)`, class: `zone__steam zone__steam--${i}` })),
  ];
}

const SCENES: Readonly<Record<string, Scene>> = {
  't0-base': () => [...fence(), ...tower()],
  't0-night': skyline,
  't0-dawn': dawn,
  't1-base': flasks,
  't1-dark': racks,
  't1-alarm': () => [...flasks(), ...siren()],
  't2-base': bars,
  't2-alarm': () => [...bars(), ...siren()],
  't3-base': gear,
  't3-steam': steam,
};

export function zoneKey(theme: WorldId, variant: Variant): string {
  return `t${theme}-${variant}`;
}

export function zoneArt(theme: WorldId, variant: Variant): SVGElement {
  const scene = SCENES[zoneKey(theme, variant)] ?? SCENES[`t${theme}-base`] ?? SCENES['t0-base'];
  return svg('svg', { class: 'zone__art', viewBox: '0 0 200 130', preserveAspectRatio: 'xMaxYMax meet', 'aria-hidden': 'true' }, [
    svg('defs', {}, [
      svg('pattern', { id: 'zone-hazard', width: 16, height: 18, patternUnits: 'userSpaceOnUse', patternTransform: 'skewX(-35)' }, [
        svg('rect', { width: 8, height: 18, fill: '#ffc53d' }),
        svg('rect', { x: 8, width: 8, height: 18, fill: '#1d1a12' }),
      ]),
    ]),
    ...(scene ? scene() : []),
  ]);
}

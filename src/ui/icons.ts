// Inline SVG icon set (24x24 grid): thin tactical line icons. Each call returns a fresh element.
// Keys are kept from v4/v5 so screens stay stable; the cute ones were redrawn (heart = armor plate,
// star = rank chevron, coin = credit ₵, gift = supply crate, crown = target reticle, fire = power bolt).
import { svg } from './dom';

type Shape = readonly [string, Readonly<Record<string, string | number>>];

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'square', 'stroke-linejoin': 'miter' };

function icon(shapes: readonly Shape[], cls = ''): SVGElement {
  return svg(
    'svg',
    { viewBox: '0 0 24 24', class: `ico ${cls}`.trim(), 'aria-hidden': 'true', focusable: 'false' },
    shapes.map(([tag, attrs]) => svg(tag, attrs)),
  );
}

const line = (d: string, extra: Readonly<Record<string, string | number>> = {}): Shape => ['path', { ...LINE, d, ...extra }];
const fill = (d: string, opacity = 1): Shape => ['path', { d, fill: 'currentColor', opacity }];

export const icons = {
  /** armor plate (hearts are gone in v6) */
  heart: (): SVGElement => icon([fill('M5 4h14v9.5L12 20l-7-6.5z', 0.9)], 'ico--armor'),
  /** rank chevron */
  star: (): SVGElement => icon([line('M5 15l7-6 7 6'), line('M5 20l7-6 7 6', { opacity: 0.5 })], 'ico--rank'),
  lock: (): SVGElement => icon([line('M8 11V7.5a4 4 0 018 0V11'), line('M5 11h14v10H5z'), line('M12 15v2')]),
  unlock: (): SVGElement => icon([line('M8 11V7.5a4 4 0 017.6-1.7'), line('M5 11h14v10H5z')]),
  /** credit mark ₵ */
  coin: (): SVGElement =>
    icon([line('M12 3v18', { 'stroke-width': 1.6 }), line('M17 7.5A6 6 0 1017 16.5', { 'stroke-width': 2 })], 'ico--credit'),
  pause: (): SVGElement => icon([fill('M7 5h3v14H7zM14 5h3v14h-3z')]),
  play: (): SVGElement => icon([fill('M8 5l11 7-11 7z')]),
  back: (): SVGElement => icon([line('M14 5l-7 7 7 7')]),
  close: (): SVGElement => icon([line('M6 6l12 12M18 6L6 18')]),
  next: (): SVGElement => icon([line('M10 5l7 7-7 7')]),
  /** manual / dossier */
  book: (): SVGElement => icon([line('M6 3h9l3 3v15H6z'), line('M9 9h6M9 13h6M9 17h4')]),
  /** supply crate (bonus stages) */
  gift: (): SVGElement => icon([line('M4 8h16v12H4z'), line('M4 8l3-4h10l3 4'), line('M10 12h4')]),
  /** target reticle (boss stages) */
  crown: (): SVGElement =>
    icon([['circle', { ...LINE, cx: 12, cy: 12, r: 7 }], line('M12 2v5M12 17v5M2 12h5M17 12h5'), ['circle', { cx: 12, cy: 12, r: 1.6, fill: 'currentColor' }]]),
  retry: (): SVGElement => icon([line('M5 12a7 7 0 102.1-5'), line('M5 4v4h4')]),
  /** map grid */
  grid: (): SVGElement => icon([line('M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z'), line('M9 4v14M15 6v14')]),
  calendar: (): SVGElement => icon([line('M4 6h16v14H4z'), line('M4 10h16M8 3v5M16 3v5'), fill('M8 13h3v3H8z')]),
  infinity: (): SVGElement =>
    icon([line('M7.5 8.5C5.5 8.5 4 10 4 12s1.5 3.5 3.5 3.5c3 0 6-7 9-7 2 0 3.5 1.5 3.5 3.5s-1.5 3.5-3.5 3.5c-3 0-6-7-9-7z', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]),
  /** loadout case */
  bag: (): SVGElement => icon([line('M3 8h18v12H3z'), line('M9 8V5h6v3'), line('M3 13h18')]),
  gear: (): SVGElement =>
    icon([
      ['circle', { ...LINE, cx: 12, cy: 12, r: 3 }],
      line('M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'),
    ]),
  shield: (): SVGElement => icon([line('M12 3l8 3v6c0 4.5-3.3 7.7-8 9-4.7-1.3-8-4.5-8-9V6z'), line('M8.5 12l2.5 2.5 4.5-5')]),
  clock: (): SVGElement => icon([['circle', { ...LINE, cx: 12, cy: 13, r: 8 }], line('M12 9v4l3 2M9 2h6')]),
  check: (): SVGElement => icon([line('M5 12.5l4.5 4.5L19 7.5', { 'stroke-width': 2.2 })]),
  sound: (): SVGElement => icon([fill('M4 9h4l5-4v14l-5-4H4z'), line('M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11')]),
  music: (): SVGElement => icon([line('M3 12h3l2-6 3 12 3-9 2 3h5')]),
  vibrate: (): SVGElement => icon([line('M8 3h8v18H8z'), line('M4 8v8M20 8v8')]),
  /** motion / effects */
  sparkle: (): SVGElement => icon([line('M3 12h4M17 12h4M12 3v4M12 17v4'), ['circle', { ...LINE, cx: 12, cy: 12, r: 2.5 }]]),
  /** power bolt (overdrive) */
  fire: (): SVGElement => icon([fill('M13 2L5 14h6l-1 8 8-12h-6z')]),
} as const;

export type IconName = keyof typeof icons;

// Inline SVG icon set (24x24 grid). Each call returns a fresh element.
import { svg } from './dom';

type Shape = readonly [string, Readonly<Record<string, string | number>>];

const STROKE = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function icon(shapes: readonly Shape[], cls = ''): SVGElement {
  return svg(
    'svg',
    { viewBox: '0 0 24 24', class: `ico ${cls}`.trim(), 'aria-hidden': 'true', focusable: 'false' },
    shapes.map(([tag, attrs]) => svg(tag, attrs)),
  );
}

const HEART_D = 'M12 20.6s-7.6-4.5-9.6-9.1C.9 8 3.1 4.3 6.7 4.3c2.1 0 3.9 1.2 5.3 3 1.4-1.8 3.2-3 5.3-3 3.6 0 5.8 3.7 4.3 7.2-2 4.6-9.6 9.1-9.6 9.1z';
const STAR_D = 'M12 2.4l2.95 5.98 6.6.96-4.78 4.65 1.13 6.57L12 17.46l-5.9 3.1 1.13-6.57L2.45 9.34l6.6-.96z';

export const icons = {
  heart: (): SVGElement => icon([['path', { d: HEART_D, fill: 'currentColor' }]], 'ico--heart'),
  star: (): SVGElement => icon([['path', { d: STAR_D, fill: 'currentColor', 'stroke-linejoin': 'round' }]], 'ico--star'),
  lock: (): SVGElement =>
    icon([
      ['path', { ...STROKE, d: 'M7.5 10.5V8a4.5 4.5 0 019 0v2.5' }],
      ['rect', { x: 4.5, y: 10, width: 15, height: 11, rx: 3.5, fill: 'currentColor' }],
      ['circle', { cx: 12, cy: 15.5, r: 1.6, fill: '#fff', opacity: 0.85 }],
    ]),
  coin: (): SVGElement =>
    icon(
      [
        ['circle', { cx: 12, cy: 12, r: 10, fill: '#f5a524' }],
        ['circle', { cx: 12, cy: 11.2, r: 9, fill: '#ffd04d' }],
        ['circle', { cx: 12, cy: 11.2, r: 5.8, fill: 'none', stroke: '#f0a21c', 'stroke-width': 1.8 }],
        ['path', { d: 'M10.6 8.6h2.2v5.6', fill: 'none', stroke: '#e48a12', 'stroke-width': 2, 'stroke-linecap': 'round' }],
        ['path', { d: 'M6.2 7.4a7 7 0 013.6-2.9', fill: 'none', stroke: '#fff7d1', 'stroke-width': 1.6, 'stroke-linecap': 'round' }],
      ],
      'ico--coin',
    ),
  pause: (): SVGElement =>
    icon([
      ['rect', { x: 6, y: 4.5, width: 4.2, height: 15, rx: 1.6, fill: 'currentColor' }],
      ['rect', { x: 13.8, y: 4.5, width: 4.2, height: 15, rx: 1.6, fill: 'currentColor' }],
    ]),
  play: (): SVGElement => icon([['path', { d: 'M8 5.2v13.6a1 1 0 001.5.86l10.6-6.8a1 1 0 000-1.72L9.5 4.34A1 1 0 008 5.2z', fill: 'currentColor' }]]),
  back: (): SVGElement => icon([['path', { ...STROKE, 'stroke-width': 3, d: 'M14.5 5l-7 7 7 7' }]]),
  close: (): SVGElement => icon([['path', { ...STROKE, 'stroke-width': 3, d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }]]),
  book: (): SVGElement =>
    icon([
      ['path', { d: 'M4 5.2c2.6-1 5.3-.9 8 .6v14c-2.7-1.5-5.4-1.6-8-.6z', fill: 'currentColor', opacity: 0.55 }],
      ['path', { d: 'M20 5.2c-2.6-1-5.3-.9-8 .6v14c2.7-1.5 5.4-1.6 8-.6z', fill: 'currentColor' }],
    ]),
  gift: (): SVGElement =>
    icon([
      ['rect', { x: 3.5, y: 10, width: 17, height: 11, rx: 2.5, fill: 'currentColor' }],
      ['rect', { x: 2.5, y: 7, width: 19, height: 4.5, rx: 1.8, fill: 'currentColor', opacity: 0.8 }],
      ['rect', { x: 10.6, y: 7, width: 2.8, height: 14, fill: '#fff', opacity: 0.85 }],
      ['path', { d: 'M12 7c-1.5-3.2-5.6-3.9-5.6-1.4C6.4 7.2 9.6 7 12 7zm0 0c1.5-3.2 5.6-3.9 5.6-1.4C17.6 7.2 14.4 7 12 7z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 }],
    ]),
  crown: (): SVGElement =>
    icon([
      ['path', { d: 'M3 8.5l4.6 3.6L12 5l4.4 7.1L21 8.5l-1.8 10H4.8z', fill: 'currentColor', 'stroke-linejoin': 'round' }],
      ['circle', { cx: 3, cy: 8, r: 1.6, fill: 'currentColor' }],
      ['circle', { cx: 12, cy: 4.6, r: 1.6, fill: 'currentColor' }],
      ['circle', { cx: 21, cy: 8, r: 1.6, fill: 'currentColor' }],
      ['rect', { x: 4.8, y: 19.5, width: 14.4, height: 2, rx: 1, fill: 'currentColor' }],
    ]),
  unlock: (): SVGElement =>
    icon([
      ['path', { ...STROKE, d: 'M7.5 10.5V8a4.5 4.5 0 018.6-1.9' }],
      ['rect', { x: 4.5, y: 10, width: 15, height: 11, rx: 3.5, fill: 'currentColor' }],
    ]),
  next: (): SVGElement => icon([['path', { ...STROKE, 'stroke-width': 3, d: 'M9.5 5l7 7-7 7' }]]),
  retry: (): SVGElement =>
    icon([
      ['path', { ...STROKE, d: 'M4.8 12a7.2 7.2 0 102.3-5.3' }],
      ['path', { ...STROKE, d: 'M5.2 3.5v4.4h4.4' }],
    ]),
  grid: (): SVGElement =>
    icon([
      ['rect', { x: 3.5, y: 3.5, width: 7.5, height: 7.5, rx: 2.2, fill: 'currentColor' }],
      ['rect', { x: 13, y: 3.5, width: 7.5, height: 7.5, rx: 2.2, fill: 'currentColor', opacity: 0.6 }],
      ['rect', { x: 3.5, y: 13, width: 7.5, height: 7.5, rx: 2.2, fill: 'currentColor', opacity: 0.6 }],
      ['rect', { x: 13, y: 13, width: 7.5, height: 7.5, rx: 2.2, fill: 'currentColor' }],
    ]),
  calendar: (): SVGElement =>
    icon([
      ['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 3.5, fill: 'currentColor', opacity: 0.35 }],
      ['path', { d: 'M3.5 8.5a3.5 3.5 0 013.5-3.5h10a3.5 3.5 0 013.5 3.5v1.5h-17z', fill: 'currentColor' }],
      ['path', { ...STROKE, d: 'M8 3v4M16 3v4' }],
      ['path', { d: 'M12 12.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z', fill: 'currentColor' }],
    ]),
  infinity: (): SVGElement =>
    icon([['path', { ...STROKE, 'stroke-width': 2.8, d: 'M7.4 8.3C5.3 8.3 3.6 10 3.6 12s1.7 3.7 3.8 3.7c3.3 0 5.9-7.4 9.2-7.4 2.1 0 3.8 1.7 3.8 3.7s-1.7 3.7-3.8 3.7c-3.3 0-5.9-7.4-9.2-7.4z' }]]),
  bag: (): SVGElement =>
    icon([
      ['path', { d: 'M4.6 8h14.8l-1.1 10.6a2.6 2.6 0 01-2.6 2.4H8.3a2.6 2.6 0 01-2.6-2.4z', fill: 'currentColor' }],
      ['path', { ...STROKE, d: 'M8.8 10V6.8a3.2 3.2 0 016.4 0V10' }],
    ]),
  gear: (): SVGElement => {
    const teeth: Shape[] = Array.from({ length: 8 }, (_, i) => [
      'rect',
      { x: 10.3, y: 1.8, width: 3.4, height: 5, rx: 1.2, fill: 'currentColor', transform: `rotate(${i * 45} 12 12)` },
    ]);
    return icon([...teeth, ['circle', { cx: 12, cy: 12, r: 7, fill: 'currentColor' }], ['circle', { cx: 12, cy: 12, r: 2.8, fill: '#fff', opacity: 0.9 }]]);
  },
  shield: (): SVGElement =>
    icon([
      ['path', { d: 'M12 2.6l7.8 2.9v5.9c0 4.9-3.3 8.5-7.8 10-4.5-1.5-7.8-5.1-7.8-10V5.5z', fill: 'currentColor' }],
      ['path', { d: 'M8.4 12l2.5 2.5 4.8-5', fill: 'none', stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }],
    ]),
  clock: (): SVGElement =>
    icon([
      ['circle', { cx: 12, cy: 13, r: 8.2, fill: 'currentColor' }],
      ['path', { d: 'M12 8.8V13l2.8 1.8', fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round' }],
      ['path', { ...STROKE, d: 'M9.5 2.8h5' }],
    ]),
  check: (): SVGElement => icon([['path', { ...STROKE, 'stroke-width': 3.2, d: 'M5 12.6l4.4 4.4L19 7.4' }]]),
  sound: (): SVGElement =>
    icon([
      ['path', { d: 'M4 9.3h3.4L12 5.2v13.6l-4.6-4.1H4z', fill: 'currentColor', 'stroke-linejoin': 'round' }],
      ['path', { ...STROKE, d: 'M15.6 9a4.2 4.2 0 010 6M18.2 6.4a8 8 0 010 11.2' }],
    ]),
  music: (): SVGElement =>
    icon([
      ['path', { ...STROKE, d: 'M9 17.5V5.8l10-2.3v11.7' }],
      ['ellipse', { cx: 6.7, cy: 17.6, rx: 2.9, ry: 2.4, fill: 'currentColor' }],
      ['ellipse', { cx: 16.7, cy: 15.3, rx: 2.9, ry: 2.4, fill: 'currentColor' }],
    ]),
  vibrate: (): SVGElement =>
    icon([
      ['rect', { x: 7.5, y: 3.5, width: 9, height: 17, rx: 2.4, fill: 'currentColor' }],
      ['path', { ...STROKE, 'stroke-width': 2.2, d: 'M4.2 8.5v7M19.8 8.5v7' }],
    ]),
  sparkle: (): SVGElement =>
    icon([
      ['path', { d: 'M11 2.5l1.9 5.6 5.6 1.9-5.6 1.9L11 17.5l-1.9-5.6L3.5 10l5.6-1.9z', fill: 'currentColor' }],
      ['path', { d: 'M18.5 14.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z', fill: 'currentColor', opacity: 0.7 }],
    ]),
  fire: (): SVGElement =>
    icon([['path', { d: 'M12 2.5c.6 3.2 4.8 5.2 4.8 10.3a4.8 4.8 0 01-9.6 0c0-2.2 1-3.6 2.2-4.6-.1 1.6.6 2.6 1.6 2.9C11.8 8.6 10.6 5.6 12 2.5z', fill: 'currentColor' }]]),
} as const;

export type IconName = keyof typeof icons;

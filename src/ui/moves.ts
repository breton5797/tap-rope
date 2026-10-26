// Player-facing move catalogue (v5 LASER ESCAPE): names, hints, gestures and badge glyphs.
import type { MoveId } from '../types';
import { svg } from './dom';

export type Tone = 'sky' | 'violet' | 'pink' | 'mint' | 'sun';

export interface MoveInfo {
  readonly id: MoveId;
  readonly name: string;
  readonly hint: string; // one-line tutorial text
  readonly gesture: string; // short gesture label (tag pill)
  readonly tone: Tone;
  readonly warn?: boolean; // a "careful!" card (red-tinted)
}

export const MOVES: Readonly<Record<MoveId, MoveInfo>> = {
  jump: { id: 'jump', name: '점프', hint: '오른쪽을 탭하면 점프! 바닥 레이저를 넘어요', gesture: '탭', tone: 'sky' },
  beam: { id: 'beam', name: '레이저 빔', hint: '날아오는 빔은 줄 수만큼! 1줄이면 1단 점프', gesture: '탭', tone: 'pink' },
  double: { id: 'double', name: '2단 점프', hint: '공중에서 한 번 더 탭 → 2단 점프', gesture: '탭 ×2', tone: 'violet' },
  slide: { id: 'slide', name: '슬라이딩', hint: '오른쪽에서 아래로 밀면 슬라이딩! 천장 레이저를 피해요', gesture: '오른쪽 ↓', tone: 'mint' },
  drone: { id: 'drone', name: '경비 드론', hint: '드론이 있으면 낮게! 2단 점프 금지', gesture: '탭 한 번만', tone: 'sun', warn: true },
  triple: { id: 'triple', name: '3단 점프', hint: '세 번 탭 → 3단 점프! 빔 3줄도 거뜬해요', gesture: '탭 ×3', tone: 'violet' },
  high: { id: 'high', name: '머리 빔', hint: '머리 높이로 날아오는 빔! 점프 말고 슬라이딩', gesture: '오른쪽 ↓', tone: 'mint' },
  rear: { id: 'rear', name: '후방 레이저', hint: '뒤에서 쫓아오는 레이저! 경고를 보고 타이밍', gesture: '경고 보고 탭', tone: 'pink', warn: true },
  gate: { id: 'gate', name: '레이저 게이트', hint: '바닥 레이저 + 드론 = 딱 한 번만 점프', gesture: '탭 1번', tone: 'sun', warn: true },
  pulse: { id: 'pulse', name: '펄스 레이저', hint: '연속 바닥 레이저! 리듬에 맞춰 통통 점프', gesture: '리듬 탭', tone: 'sky' },
  lane: { id: 'lane', name: '레인 이동', hint: '왼쪽에서 위·아래로 밀어 경비로봇을 피해!', gesture: '왼쪽 ↑↓', tone: 'mint' },
  drop: { id: 'drop', name: '낙하 상자', hint: '‘!’가 뜬 레인에서 비켜!', gesture: '왼쪽 ↑↓', tone: 'sun', warn: true },
  chaser: { id: 'chaser', name: '추격 드론', hint: '뒤에서 돌진! ‘!’ 레인을 벗어나', gesture: '왼쪽 ↑↓', tone: 'pink', warn: true },
  lanejump: { id: 'lanejump', name: '피하고 뛰기', hint: '레인을 바꾸면서 점프!', gesture: '↑↓ + 탭', tone: 'violet' },
};

/** Display order for the guide sheet (= order of first appearance in the campaign). */
export const MOVE_ORDER: readonly MoveId[] = [
  'jump', 'lane', 'beam', 'double', 'slide', 'drone', 'drop', 'triple', 'high', 'rear', 'chaser', 'gate', 'pulse', 'lanejump',
];

const S = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

type Shape = readonly [string, Readonly<Record<string, string | number>>, string?];

function numeral(n: number): Shape[] {
  return [['text', { x: 12, y: 18.5, 'text-anchor': 'middle', 'font-size': 19, 'font-family': 'Jua, sans-serif', fill: 'currentColor' }, String(n)]];
}

const FLOOR: Shape = ['path', { ...S, d: 'M4 21h16' }];
const ARROW_DOWN: Shape = ['path', { ...S, d: 'M12 3v10M7.5 8.5L12 13l4.5-4.5' }];
/** three short lane strokes on the left of the glyph */
const LANES_MARK: Shape = ['path', { ...S, 'stroke-width': 2.2, d: 'M3 6h5M3 12h5M3 18h5', opacity: 0.7 }];
const BANG: readonly Shape[] = [['path', { ...S, d: 'M20 3v5' }], ['circle', { cx: 20, cy: 11.5, r: 1.4, fill: 'currentColor' }]];

const GLYPHS: Readonly<Record<MoveId, readonly Shape[]>> = {
  jump: [FLOOR, ['path', { ...S, d: 'M12 19V6M7.5 10.5L12 6l4.5 4.5' }]],
  beam: [
    ['path', { ...S, d: 'M3 9h13M3 15h13' }],
    ['circle', { cx: 19.5, cy: 9, r: 2, fill: 'currentColor' }],
    ['circle', { cx: 19.5, cy: 15, r: 2, fill: 'currentColor' }],
  ],
  double: numeral(2),
  triple: numeral(3),
  slide: [ARROW_DOWN, ['path', { ...S, d: 'M4 19c4 0 6-1 8-1s4 1 8 1' }]],
  high: [['path', { ...S, d: 'M3 6h18', 'stroke-width': 3 }], ['path', { ...S, d: 'M12 10v9M7.5 14.5L12 19l4.5-4.5' }]],
  drone: [
    ['path', { d: 'M6 11h12a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z', fill: 'currentColor' }],
    ['path', { ...S, 'stroke-width': 2, d: 'M3 8h6M15 8h6M12 11V8' }],
    ['path', { d: 'M10 14l-3 7h10l-3-7z', fill: 'currentColor', opacity: 0.35 }],
  ],
  rear: [
    ['path', { ...S, d: 'M21 12H6M10.5 7.5L6 12l4.5 4.5' }],
    ['path', { ...S, 'stroke-width': 2, d: 'M3 6v12', opacity: 0.6 }],
  ],
  gate: [
    ['path', { ...S, d: 'M6 21V12M18 21V12' }],
    ['path', { d: 'M8 5h8a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z', fill: 'currentColor' }],
    FLOOR,
  ],
  pulse: [['path', { ...S, d: 'M5 20V12M10 20V9M15 20V12M20 20V9' }]],
  lane: [LANES_MARK, ['path', { ...S, d: 'M16 4v16M12.5 7.5L16 4l3.5 3.5M12.5 16.5L16 20l3.5-3.5' }]],
  drop: [
    ['rect', { x: 5, y: 2, width: 11, height: 9, rx: 2, fill: 'currentColor' }],
    ['path', { ...S, 'stroke-width': 2, d: 'M10.5 14v4M8 16.5l2.5 2.5 2.5-2.5' }],
    ['path', { ...S, d: 'M3 21.5h15', opacity: 0.6 }],
    ...BANG,
  ],
  chaser: [
    ['path', { d: 'M9 10h12a3.5 3.5 0 0 1-3.5 3.5h-5A3.5 3.5 0 0 1 9 10z', fill: 'currentColor' }],
    ['path', { ...S, 'stroke-width': 2, d: 'M10 6.5h4M16 6.5h4M15 10V6.5' }],
    ['path', { ...S, 'stroke-width': 2.2, d: 'M2 11h4M3 16h5', opacity: 0.65 }],
    ['path', { ...S, 'stroke-width': 2, d: 'M8 21h14', opacity: 0.5 }],
  ],
  lanejump: [LANES_MARK, ['path', { ...S, d: 'M11 20L19 6M13.5 6H19v5.5' }]],
};

/** Small 24-grid glyph for a move (used on badges and chips). */
export function moveGlyph(id: MoveId): SVGElement {
  return svg(
    'svg',
    { viewBox: '0 0 24 24', class: 'ico', 'aria-hidden': 'true' },
    GLYPHS[id].map(([tag, attrs, text]) => svg(tag, attrs, text === undefined ? [] : [text])),
  );
}

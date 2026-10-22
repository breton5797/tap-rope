// Player-facing move catalogue: names, hints, gestures and small badge glyphs.
import type { MoveId, RopeMode } from '../types';
import { svg } from './dom';

export interface MoveInfo {
  readonly id: MoveId;
  readonly name: string;
  readonly hint: string; // one-line tutorial text
  readonly gesture: string; // short gesture label (tag pill)
  readonly modes: readonly RopeMode[]; // rope modes the move appears in
  readonly tone: 'sky' | 'violet' | 'pink' | 'mint' | 'sun';
}

export const MOVES: Readonly<Record<MoveId, MoveInfo>> = {
  jump: { id: 'jump', name: '점프', hint: '화면을 탭하면 점프!', gesture: '탭', modes: ['long', 'solo'], tone: 'sky' },
  double: { id: 'double', name: '이단뛰기', hint: '공중에서 한 번 더 탭 → 2단(이단뛰기)', gesture: '탭 ×2', modes: ['long', 'solo'], tone: 'violet' },
  triple: { id: 'triple', name: '삼단뛰기', hint: '세 번 탭 → 3단! 숫자를 확인하세요', gesture: '탭 ×3', modes: ['long', 'solo'], tone: 'violet' },
  bird: { id: 'bird', name: '새 피하기', hint: '새가 오면 낮게! 2단·덤블링 금지', gesture: '탭 한 번만', modes: ['long', 'solo'], tone: 'pink' },
  tumble: { id: 'tumble', name: '덤블링', hint: '위로 스와이프 → 덤블링! 무지개 링은 덤블링으로만', gesture: '위로 스와이프', modes: ['long'], tone: 'sun' },
  side: { id: 'side', name: '옆 이동', hint: '좌우 스와이프 → 옆 칸으로 점프! 굴러오는 공은 피하세요', gesture: '좌우 스와이프', modes: ['long', 'solo'], tone: 'mint' },
  cross: { id: 'cross', name: '엇걸어뛰기', hint: '점프 중 좌우 스와이프 → 엇걸어뛰기 ✕', gesture: '공중 스와이프', modes: ['solo'], tone: 'pink' },
  back: { id: 'back', name: '뒤로넘기', hint: '아래로 스와이프 → 뒤로넘기 ↺ (한 번 더 하면 앞으로)', gesture: '아래로 스와이프', modes: ['solo'], tone: 'sky' },
  dd: { id: 'dd', name: '더블더치', hint: '두 줄이 번갈아 와요! 리듬에 맞춰 연속 점프', gesture: '리듬 탭', modes: ['long'], tone: 'mint' },
};

/** Display order for the guide sheet. */
export const MOVE_ORDER: readonly MoveId[] = ['jump', 'double', 'triple', 'bird', 'side', 'tumble', 'cross', 'back', 'dd'];

export const ROPE_MODE_LABEL: Readonly<Record<RopeMode, string>> = { long: '긴 줄', solo: '개인 줄' };

const S = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

type Shape = readonly [string, Readonly<Record<string, string | number>>, string?];

function numeral(n: number): Shape[] {
  return [['text', { x: 12, y: 18.5, 'text-anchor': 'middle', 'font-size': 19, 'font-family': 'Jua, sans-serif', fill: 'currentColor' }, String(n)]];
}

const GLYPHS: Readonly<Record<MoveId, readonly Shape[]>> = {
  jump: numeral(1),
  double: numeral(2),
  triple: numeral(3),
  bird: [
    ['path', { d: 'M3.5 12.5c3-1 5.5-.4 7.5 1.6l2.6-6.2 1.7 5.3c2 .1 4 1.2 5.2 2.8-3.2.8-6 2.6-9 2.6-3.6 0-6.4-2.6-8-6.1z', fill: 'currentColor' }],
  ],
  tumble: [
    ['path', { ...S, d: 'M17.8 8.2A7 7 0 1 0 19 13' }],
    ['path', { ...S, d: 'M18.6 3.8l-.6 4.6-4.5-.8' }],
  ],
  side: [
    ['path', { ...S, d: 'M4 12h16' }],
    ['path', { ...S, d: 'M7.5 8.5L4 12l3.5 3.5M16.5 8.5L20 12l-3.5 3.5' }],
  ],
  cross: [['path', { ...S, 'stroke-width': 3, d: 'M6 6l12 12M18 6L6 18' }]],
  back: [
    ['path', { ...S, d: 'M6.2 8.2A7 7 0 1 1 5 13' }],
    ['path', { ...S, d: 'M5.4 3.8l.6 4.6 4.5-.8' }],
  ],
  dd: [
    ['path', { ...S, 'stroke-width': 2.4, d: 'M3 7Q12 23 21 7' }],
    ['path', { ...S, 'stroke-width': 2.4, d: 'M3 17Q12 1 21 17', opacity: 0.6 }],
  ],
};

/** Small 24-grid glyph for a move (used on badges and chips). */
export function moveGlyph(id: MoveId): SVGElement {
  return svg(
    'svg',
    { viewBox: '0 0 24 24', class: 'ico', 'aria-hidden': 'true' },
    GLYPHS[id].map(([tag, attrs, text]) => svg(tag, attrs, text === undefined ? [] : [text])),
  );
}

/**
 * Static game content: 4 worlds, 6 skins and the 20-stage campaign (GDD v2 §12).
 * Each stage alternates long rope (friends turn it) and solo rope (the kid turns
 * it) and introduces one move at a time: W1 jump → hurdle → solo 이단 → ball;
 * W2 덤블링 + bird → 엇걸어 → 3단; W3 뒤로넘기 → Double-Dutch; W4 (moon) mixes all.
 * `moves` lists exactly the moves a stage's mix can produce (and the generator
 * guarantees each appears at least once).
 */
import type { MoveId, RopeMode, SkinMeta, StageDef, WorldId, WorldMeta } from '../types';
import { hashString } from './rng';

export const WORLDS: readonly WorldMeta[] = [
  { id: 0, name: '놀이터', subtitle: '햇살 가득 첫 줄넘기', gravityScale: 1.0 },
  { id: 1, name: '노을 해변', subtitle: '파도 소리와 함께 리듬을', gravityScale: 1.0 },
  { id: 2, name: '네온 시티', subtitle: '빛나는 밤의 더블더치', gravityScale: 1.0 },
  { id: 3, name: '달 기지', subtitle: '둥실둥실 저중력 점프', gravityScale: 0.82 },
];

export const SKINS: readonly SkinMeta[] = [
  { id: 'kid', name: '기본', price: 0 },
  { id: 'cat', name: '냥냥이', price: 60 },
  { id: 'bunny', name: '토끼', price: 90 },
  { id: 'ninja', name: '닌자', price: 140 },
  { id: 'robot', name: '로봇', price: 200 },
  { id: 'astro', name: '우주인', price: 300 },
];

type Mix = StageDef['mix'];

interface Row {
  readonly name: string;
  readonly mode: RopeMode;
  readonly moves: readonly MoveId[];
  readonly bpm: number;
  readonly hazards: number;
  readonly w: readonly [number, number, number];
  readonly mix: Partial<Mix>;
  readonly pickup: number;
}

const NO_MIX: Mix = { hurdle: 0, bird: 0, combo: 0, doubleDutch: 0, ball: 0, ring: 0, cross: 0, back: 0 };

const LONG_ALL: readonly MoveId[] = ['jump', 'double', 'triple', 'tumble', 'side', 'dd', 'bird'];
const SOLO_ALL: readonly MoveId[] = ['jump', 'double', 'triple', 'cross', 'back', 'side', 'bird'];

const ROWS: readonly Row[] = [
  // W1 놀이터
  { name: '첫 점프', mode: 'long', moves: ['jump'], bpm: 92, hazards: 14, w: [1, 0, 0], mix: {}, pickup: 0.15 },
  { name: '폴짝 허들', mode: 'long', moves: ['jump'], bpm: 94, hazards: 18, w: [1, 0, 0],
    mix: { hurdle: 0.35 }, pickup: 0.2 },
  { name: '혼자서 이단뛰기', mode: 'solo', moves: ['jump', 'double'], bpm: 96, hazards: 20, w: [0.5, 0.5, 0],
    mix: {}, pickup: 0.2 },
  { name: '데굴데굴 공 피하기', mode: 'long', moves: ['jump', 'side'], bpm: 98, hazards: 20, w: [1, 0, 0],
    mix: { ball: 0.4, hurdle: 0.1 }, pickup: 0.2 },
  { name: '놀이터 대장', mode: 'long', moves: ['jump', 'double', 'side'], bpm: 102, hazards: 24, w: [0.6, 0.4, 0],
    mix: { hurdle: 0.25, ball: 0.2, combo: 0.15 }, pickup: 0.22 },
  // W2 노을 해변
  { name: '무지개 덤블링', mode: 'long', moves: ['jump', 'double', 'tumble', 'bird'], bpm: 104, hazards: 24,
    w: [0.7, 0.3, 0], mix: { ring: 0.35, bird: 0.25, hurdle: 0.1 }, pickup: 0.22 },
  { name: '엇걸어 콩콩', mode: 'solo', moves: ['jump', 'double', 'cross'], bpm: 106, hazards: 24, w: [0.6, 0.4, 0],
    mix: { cross: 0.45 }, pickup: 0.22 },
  { name: '세 번 콩콩콩', mode: 'long', moves: ['jump', 'double', 'triple', 'tumble', 'bird'], bpm: 108,
    hazards: 26, w: [0.35, 0.3, 0.35], mix: { ring: 0.2, hurdle: 0.2, combo: 0.1, bird: 0.1 }, pickup: 0.22 },
  { name: '엇걸어 삼단', mode: 'solo', moves: ['jump', 'double', 'triple', 'cross'], bpm: 110, hazards: 28,
    w: [0.4, 0.35, 0.25], mix: { cross: 0.5 }, pickup: 0.24 },
  { name: '노을 피날레', mode: 'long', moves: ['jump', 'double', 'triple', 'tumble', 'side', 'bird'], bpm: 113,
    hazards: 30, w: [0.35, 0.4, 0.25],
    mix: { hurdle: 0.25, bird: 0.2, combo: 0.2, ball: 0.2, ring: 0.2 }, pickup: 0.25 },
  // W3 네온 시티
  { name: '거꾸로 빙글', mode: 'solo', moves: ['jump', 'double', 'back'], bpm: 114, hazards: 28, w: [0.6, 0.4, 0],
    mix: { back: 0.6 }, pickup: 0.24 },
  { name: '네온 더블더치', mode: 'long', moves: ['jump', 'double', 'dd'], bpm: 116, hazards: 30, w: [0.55, 0.45, 0],
    mix: { doubleDutch: 0.5, hurdle: 0.2, combo: 0.1 }, pickup: 0.25 },
  { name: '뒤로 엇걸어', mode: 'solo', moves: ['jump', 'double', 'cross', 'back'], bpm: 118, hazards: 32,
    w: [0.55, 0.45, 0], mix: { cross: 0.45, back: 0.45 }, pickup: 0.25 },
  { name: '빛의 장애물', mode: 'long', moves: ['jump', 'double', 'triple', 'tumble', 'side', 'dd'], bpm: 120,
    hazards: 34, w: [0.4, 0.35, 0.25],
    mix: { doubleDutch: 0.4, ball: 0.25, ring: 0.25, hurdle: 0.2, combo: 0.15 }, pickup: 0.25 },
  { name: '네온 솔로 마스터', mode: 'solo', moves: SOLO_ALL, bpm: 122, hazards: 36, w: [0.35, 0.4, 0.25],
    mix: { cross: 0.7, back: 0.65, ball: 0.3, bird: 0.15, combo: 0.15 }, pickup: 0.25 },
  // W4 달 기지 (low gravity)
  { name: '둥실 첫걸음', mode: 'long', moves: LONG_ALL, bpm: 120, hazards: 32, w: [0.4, 0.35, 0.25],
    mix: { hurdle: 0.25, bird: 0.2, combo: 0.2, doubleDutch: 0.3, ball: 0.3, ring: 0.2 }, pickup: 0.28 },
  { name: '달빛 솔로', mode: 'solo', moves: SOLO_ALL, bpm: 122, hazards: 34, w: [0.35, 0.4, 0.25],
    mix: { bird: 0.2, combo: 0.2, ball: 0.3, cross: 0.7, back: 0.55 }, pickup: 0.28 },
  { name: '운석 소나기', mode: 'long', moves: LONG_ALL, bpm: 126, hazards: 36, w: [0.3, 0.4, 0.3],
    mix: { hurdle: 0.3, bird: 0.25, combo: 0.3, doubleDutch: 0.35, ball: 0.3, ring: 0.25 }, pickup: 0.28 },
  { name: '우주 정거장', mode: 'solo', moves: SOLO_ALL, bpm: 128, hazards: 38, w: [0.3, 0.35, 0.35],
    mix: { bird: 0.25, combo: 0.25, ball: 0.3, cross: 0.75, back: 0.3 }, pickup: 0.3 },
  { name: '달의 챔피언', mode: 'long', moves: LONG_ALL, bpm: 132, hazards: 40, w: [0.25, 0.35, 0.4],
    mix: { hurdle: 0.35, bird: 0.3, combo: 0.35, doubleDutch: 0.4, ball: 0.35, ring: 0.3 }, pickup: 0.3 },
];

/** The moves a rope mode + level weights + mix can produce, in canonical order. */
export function movesForMix(
  mode: RopeMode, w: readonly [number, number, number], mix: Mix,
): MoveId[] {
  const long = mode === 'long';
  const on: Record<MoveId, boolean> = {
    jump: true,
    double: w[1] > 0,
    triple: w[2] > 0,
    tumble: long && mix.ring > 0,
    side: mix.ball > 0,
    cross: !long && mix.cross > 0,
    back: !long && mix.back > 0,
    dd: long && mix.doubleDutch > 0,
    bird: mix.bird > 0,
  };
  const order: readonly MoveId[] = ['jump', 'double', 'triple', 'tumble', 'side', 'cross', 'back', 'dd', 'bird'];
  return order.filter((m) => on[m]);
}

function toStage(row: Row, i: number): StageDef {
  const world = Math.floor(i / 5) as WorldId;
  const index = i % 5;
  const id = `w${world + 1}-s${index + 1}`;
  return {
    id, world, index, name: row.name, ropeMode: row.mode, moves: row.moves,
    bpm: row.bpm, hazardBeats: row.hazards,
    seed: hashString(`taprope:${id}`),
    levelWeights: row.w,
    mix: { ...NO_MIX, ...row.mix },
    pickupRate: row.pickup,
  };
}

export const STAGES: readonly StageDef[] = ROWS.map(toStage);

export function stageById(id: string): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}

export function nextStageId(id: string): string | null {
  const i = STAGES.findIndex((s) => s.id === id);
  if (i < 0 || i + 1 >= STAGES.length) return null;
  return STAGES[i + 1].id;
}

/**
 * Static game content: 4 worlds, 6 skins and the 20-stage campaign.
 * Difficulty ramps smoothly: W1 teaches 1단 → hurdles → 2단; W2 adds birds and
 * 3단; W3 adds Double-Dutch; W4 (moon, low gravity) mixes everything.
 */
import type { SkinMeta, StageDef, WorldId, WorldMeta } from '../types';
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

/** [name, bpm, hazardBeats, w1, w2, w3, hurdle, bird, combo, doubleDutch, pickupRate] */
type Row = readonly [string, number, number, number, number, number, number, number, number, number, number];

const ROWS: readonly Row[] = [
  // W1 놀이터 — 1단, then hurdles, then 2단
  ['첫 점프', 92, 14, 1, 0, 0, 0, 0, 0, 0, 0.15],
  ['폴짝 허들', 94, 18, 1, 0, 0, 0.3, 0, 0, 0, 0.2],
  ['두 번 콩콩', 96, 20, 0.7, 0.3, 0, 0.2, 0, 0, 0, 0.2],
  ['그네 옆 리듬', 100, 22, 0.6, 0.4, 0, 0.25, 0, 0.1, 0, 0.22],
  ['놀이터 대장', 104, 24, 0.5, 0.5, 0, 0.25, 0, 0.15, 0, 0.22],
  // W2 노을 해변 — birds, then 3단
  ['갈매기 조심', 106, 24, 0.6, 0.4, 0, 0.2, 0.2, 0.1, 0, 0.22],
  ['모래성 넘기', 108, 26, 0.5, 0.5, 0, 0.3, 0.2, 0.15, 0, 0.22],
  ['세 번 콩콩콩', 110, 26, 0.45, 0.4, 0.15, 0.2, 0.2, 0.15, 0, 0.24],
  ['파도 타기', 113, 28, 0.4, 0.4, 0.2, 0.25, 0.25, 0.2, 0, 0.24],
  ['노을 피날레', 116, 30, 0.35, 0.4, 0.25, 0.25, 0.25, 0.25, 0, 0.25],
  // W3 네온 시티 — Double-Dutch
  ['네온 더블더치', 118, 30, 0.5, 0.35, 0.15, 0.2, 0.15, 0.15, 0.4, 0.25],
  ['빌딩 숲 리듬', 120, 32, 0.4, 0.4, 0.2, 0.25, 0.2, 0.2, 0.4, 0.25],
  ['전광판 계단', 122, 32, 0.35, 0.4, 0.25, 0.25, 0.2, 0.25, 0.45, 0.25],
  ['야경 질주', 124, 34, 0.35, 0.35, 0.3, 0.3, 0.25, 0.25, 0.45, 0.25],
  ['네온 마스터', 126, 36, 0.3, 0.4, 0.3, 0.3, 0.25, 0.3, 0.5, 0.25],
  // W4 달 기지 — everything, low gravity
  ['둥실 첫걸음', 124, 32, 0.4, 0.35, 0.25, 0.25, 0.2, 0.2, 0.3, 0.28],
  ['운석 피하기', 126, 34, 0.35, 0.35, 0.3, 0.3, 0.3, 0.25, 0.35, 0.28],
  ['무중력 계단', 128, 36, 0.3, 0.4, 0.3, 0.3, 0.25, 0.3, 0.35, 0.28],
  ['우주 정거장', 130, 38, 0.3, 0.35, 0.35, 0.3, 0.3, 0.3, 0.4, 0.3],
  ['달의 챔피언', 132, 40, 0.25, 0.35, 0.4, 0.35, 0.3, 0.35, 0.4, 0.3],
];

function toStage(row: Row, i: number): StageDef {
  const [name, bpm, hazardBeats, w1, w2, w3, hurdle, bird, combo, doubleDutch, pickupRate] = row;
  const world = Math.floor(i / 5) as WorldId;
  const index = i % 5;
  const id = `w${world + 1}-s${index + 1}`;
  return {
    id, world, index, name, bpm, hazardBeats,
    seed: hashString(`taprope:${id}`),
    levelWeights: [w1, w2, w3],
    mix: { hurdle, bird, combo, doubleDutch },
    pickupRate,
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

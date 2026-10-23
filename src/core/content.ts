/**
 * Static game content (GDD v3 §15): 4 themes (WORLDS: background, music, gravity),
 * 10 player-facing chapters of 10 stages (theme × look variant), 6 skins and the
 * 100-stage campaign built by the formula in campaign.ts.
 */
import type { ChapterMeta, SkinMeta, StageDef, WorldMeta } from '../types';
import { buildCampaign } from './campaign';

export { movesForMix } from './moves';

export const WORLDS: readonly WorldMeta[] = [
  { id: 0, name: '놀이터', subtitle: '햇살 가득 첫 줄넘기', gravityScale: 1.0 },
  { id: 1, name: '노을 해변', subtitle: '파도 소리와 함께 리듬을', gravityScale: 1.0 },
  { id: 2, name: '네온 시티', subtitle: '빛나는 밤의 더블더치', gravityScale: 1.0 },
  { id: 3, name: '달 기지', subtitle: '둥실둥실 저중력 점프', gravityScale: 0.82 },
];

export const CHAPTERS: readonly ChapterMeta[] = [
  { id: 0, name: '놀이터', subtitle: '햇살 가득 첫 줄넘기', theme: 0, variant: 'base' },
  { id: 1, name: '노을 해변', subtitle: '파도 소리와 함께 리듬을', theme: 1, variant: 'base' },
  { id: 2, name: '네온 시티', subtitle: '빛나는 밤의 더블더치', theme: 2, variant: 'base' },
  { id: 3, name: '달 기지', subtitle: '둥실둥실 저중력 점프', theme: 3, variant: 'base' },
  { id: 4, name: '놀이터의 밤', subtitle: '가로등 아래 별빛 줄넘기', theme: 0, variant: 'night' },
  { id: 5, name: '가을 놀이터', subtitle: '낙엽 위로 사뿐사뿐', theme: 0, variant: 'autumn' },
  { id: 6, name: '밤바다', subtitle: '달빛 파도 위의 리듬', theme: 1, variant: 'night' },
  { id: 7, name: '비 오는 네온', subtitle: '빗속을 가르는 네온 점프', theme: 2, variant: 'rain' },
  { id: 8, name: '일식의 달', subtitle: '붉게 물든 저중력 무대', theme: 3, variant: 'eclipse' },
  { id: 9, name: '무지개 피날레', subtitle: '모든 기술을 무지개 위에서', theme: 0, variant: 'rainbow' },
];

export const SKINS: readonly SkinMeta[] = [
  { id: 'kid', name: '기본', price: 0 },
  { id: 'cat', name: '냥냥이', price: 60 },
  { id: 'bunny', name: '토끼', price: 90 },
  { id: 'ninja', name: '닌자', price: 140 },
  { id: 'robot', name: '로봇', price: 200 },
  { id: 'astro', name: '우주인', price: 300 },
];

export const STAGES: readonly StageDef[] = buildCampaign(CHAPTERS);

const BY_ID: ReadonlyMap<string, number> = new Map(STAGES.map((s, i) => [s.id, i]));

export function stageById(id: string): StageDef | undefined {
  const i = BY_ID.get(id);
  return i === undefined ? undefined : STAGES[i];
}

export function nextStageId(id: string): string | null {
  const i = BY_ID.get(id);
  if (i === undefined || i + 1 >= STAGES.length) return null;
  return STAGES[i + 1].id;
}

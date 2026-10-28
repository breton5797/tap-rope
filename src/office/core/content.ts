/**
 * Office content (칼퇴근 대작전, office spec §4, §13), swapped in for src/core/content.ts: the 야근상사
 * building as four corridor themes, five chapters of one boss stage each (12층 사무실 → 1층 로비), the two
 * new hires and the 17:30 → 18:00 clock. Stage ids keep the v8 `w{n}-s10` form so boss lookup, progress
 * and stars work unchanged. Each stage introduces 1–3 moves (spec §13 table) on top of everything before it.
 */
import type { ChapterMeta, MoveId, Scene, SkinMeta, StageDef, TransitionKind, Variant, WorldId, WorldMeta } from '../../types';
import { designCustomStage } from '../../core/campaign';
import { hashString } from '../../core/rng';

export { movesForMix } from '../../core/moves';

export const WORLDS: readonly WorldMeta[] = [
  { id: 0, name: '기획팀 사무실', subtitle: '야근상사 12층' },
  { id: 1, name: '탕비실 · 복도', subtitle: '복합기 앞 통로' },
  { id: 2, name: '회의실 층', subtitle: '유리벽 회의실' },
  { id: 3, name: '엘리베이터홀 · 로비', subtitle: '비상계단과 1층 회전문' },
];

/** the looks the office art covers; the lobby glows at dusk on the last stage */
export const DESIGNED_LOOKS: Readonly<Record<WorldId, readonly Variant[]>> = {
  0: ['base'],
  1: ['base'],
  2: ['base'],
  3: ['base', 'dawn'],
};

export const CHAPTERS: readonly ChapterMeta[] = [
  { id: 0, part: 1, name: '12층 기획팀 사무실', subtitle: '17:30 → 17:36', theme: 0, variant: 'base',
    briefing: '잠깐만~ 이것만 좀 봐줄래? 김대리의 부탁을 피해 자리를 뜬다.' },
  { id: 1, part: 1, name: '탕비실·복합기 복도', subtitle: '17:36 → 17:42', theme: 1, variant: 'base',
    briefing: '엑셀 최종본 수정 좀… 최종_진짜최종_v3. 박과장을 따돌려라.' },
  { id: 2, part: 1, name: '회의실 층', subtitle: '17:42 → 17:48', theme: 2, variant: 'base',
    briefing: '5분만 회의하자. 진짜 5분. 최팀장의 회의실 문이 열리기 전에 지나간다.' },
  { id: 3, part: 1, name: '엘리베이터홀·비상계단', subtitle: '17:48 → 17:54', theme: 3, variant: 'base',
    briefing: '라떼는 말이야, 9시 퇴근이 기본이었어. 오부장을 지나 계단으로.' },
  { id: 4, part: 1, name: '1층 로비·회전문', subtitle: '17:54 → 18:00', theme: 3, variant: 'dawn',
    briefing: '다들 저녁 먹고 가지? 내가 쏜다! 전무·이사·사장님을 뚫고 18:00 정각에 나간다.' },
];

export interface ChapterScenes {
  readonly scenes: readonly [Scene, Scene, Scene]; // sections 0 / 1 / 2
  readonly transitions: readonly [TransitionKind, TransitionKind]; // doors into sections 1 / 2
}

const sc = (world: WorldId, variant: Variant): Scene => ({ world, variant });

/** one row per chapter: each stage walks toward the next stage's floor */
export const CHAPTER_SCENES: readonly ChapterScenes[] = [
  { scenes: [sc(0, 'base'), sc(0, 'base'), sc(1, 'base')], transitions: ['turn', 'turn'] },
  { scenes: [sc(1, 'base'), sc(1, 'base'), sc(2, 'base')], transitions: ['turn', 'stairs'] },
  { scenes: [sc(2, 'base'), sc(2, 'base'), sc(3, 'base')], transitions: ['turn', 'turn'] },
  { scenes: [sc(3, 'base'), sc(3, 'base'), sc(3, 'base')], transitions: ['elevator', 'stairs'] },
  { scenes: [sc(3, 'dawn'), sc(3, 'dawn'), sc(3, 'dawn')], transitions: ['stairs', 'turn'] },
];

type StageLook = Pick<StageDef, 'chapter' | 'world' | 'variant'>;

function scenesOf(stage: StageLook): ChapterScenes {
  const i = CHAPTERS.findIndex((c) => c.theme === stage.world && c.variant === stage.variant);
  return CHAPTER_SCENES[i >= 0 ? i : Math.min(Math.max(stage.chapter, 0), CHAPTER_SCENES.length - 1)];
}

const clampSection = (section: number) => Math.min(2, Math.max(0, Math.floor(section)));

/** the corridor look of a stage's section (section 0 = the stage's own look) */
export function sceneFor(stage: StageLook, section: number): Scene {
  const k = clampSection(section);
  return k === 0 ? sc(stage.world, stage.variant) : scenesOf(stage).scenes[k];
}

/** how the scene changes at the door into `section` (1 or 2) */
export function transitionFor(stage: StageLook, section: number): TransitionKind {
  return scenesOf(stage).transitions[Math.max(1, clampSection(section)) - 1];
}

/** both new hires are free and owned from the start (picked on the first launch) */
export const SKINS: readonly SkinMeta[] = [
  { id: 'kid', name: '칼퇴준', price: 0 },
  { id: 'cat', name: '정시원', price: 0 },
];

/** spec §13: moves each stage teaches (beams arrive with the 2단 jump: the 결재판 boomerang) */
const NEW_MOVES: readonly (readonly MoveId[])[] = [
  ['jump', 'slide', 'lane'],
  ['double', 'beam', 'drone', 'drop'],
  ['chaser', 'high'],
  ['triple'],
  ['rear'],
];
const D: readonly number[] = [0.15, 0.3, 0.45, 0.58, 0.7];

export const STAGES: readonly StageDef[] = CHAPTERS.map((c, i) => {
  const id = `w${i + 1}-s10`;
  return designCustomStage(
    {
      id, name: c.name, n: (i + 1) * 10, chapter: c.id, index: 9, kind: 'boss', world: c.theme, variant: c.variant,
      d: D[i], seed: hashString(`officeescape:${id}`), campaign: true,
    },
    NEW_MOVES.slice(0, i + 1).flat(),
    NEW_MOVES[i],
  );
});

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

const CLOCK_START = 17 * 60 + 30;
const STAGE_MINUTES = 6;

/** wall clock "HH:MM" at `progress01` (clamped) through stage `stageIndex`: 17:30 + 6·n min, 18:00 at the end */
export function OFFICE_CLOCK(stageIndex: number, progress01: number): string {
  const p = Math.min(1, Math.max(0, progress01));
  const minutes = Math.floor(CLOCK_START + STAGE_MINUTES * (stageIndex + p) + 1e-9);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

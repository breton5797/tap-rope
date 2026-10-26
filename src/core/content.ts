/**
 * Static game content (GDD v4 §5, §7): 4 corridor themes (WORLDS), 10 zones (CHAPTERS: part 1
 * rescue, part 2 escape, each a designed theme × variant look with a mission briefing),
 * 6 spy skins, and the 100-stage campaign built by the formula in campaign.ts.
 * v5 §6.1: CHAPTER_SCENES — the look of each section (0 = the chapter look) and the door transitions.
 */
import type { ChapterMeta, Scene, SkinMeta, StageDef, TransitionKind, Variant, WorldId, WorldMeta } from '../types';
import { buildCampaign } from './campaign';

export { movesForMix } from './moves';

export const WORLDS: readonly WorldMeta[] = [
  { id: 0, name: '경비 초소', subtitle: '기지 바깥 경계선' },
  { id: 1, name: '연구소', subtitle: '하얀 실험실과 서버' },
  { id: 2, name: '감옥 블록', subtitle: '철창 너머의 복도' },
  { id: 3, name: '공장 · 수로', subtitle: '증기와 기계의 지하' },
];

/** The only theme × variant looks the renderer draws (endless/daily use these too). */
export const DESIGNED_LOOKS: Readonly<Record<WorldId, readonly Variant[]>> = {
  0: ['base', 'night', 'dawn'],
  1: ['base', 'dark', 'alarm'],
  2: ['base', 'alarm'],
  3: ['base', 'steam'],
};

export const CHAPTERS: readonly ChapterMeta[] = [
  { id: 0, part: 1, name: '외곽 경비구역', subtitle: '잠입 작전 개시', theme: 0, variant: 'base',
    briefing: '포로가 잡혀 있는 기지에 잠입한다. 레이저를 넘어라!' },
  { id: 1, part: 1, name: '지하 수로', subtitle: '증기 속으로', theme: 3, variant: 'steam',
    briefing: '경비를 피해 증기 가득한 수로로.' },
  { id: 2, part: 1, name: '연구동', subtitle: '하얀 보안 구역', theme: 1, variant: 'base',
    briefing: '하얀 실험실, 보안 레이저가 촘촘하다.' },
  { id: 3, part: 1, name: '서버실', subtitle: '불 꺼진 데이터 센터', theme: 1, variant: 'dark',
    briefing: '불이 꺼진 서버실. 드론을 조심해.' },
  { id: 4, part: 1, name: '감옥 블록', subtitle: '포로가 기다린다', theme: 2, variant: 'base',
    briefing: '포로가 있는 곳! 보스를 넘으면 구출 성공.' },
  { id: 5, part: 2, name: '경보 발령', subtitle: '들켰다, 뛰어!', theme: 2, variant: 'alarm',
    briefing: '경보가 울렸다! 포로와 함께 달려라.' },
  { id: 6, part: 2, name: '연구동 비상탈출', subtitle: '붉은 비상등 아래', theme: 1, variant: 'alarm',
    briefing: '붉은 비상등 아래 출구를 찾아라.' },
  { id: 7, part: 2, name: '공장 라인', subtitle: '멈추지 않는 기계', theme: 3, variant: 'base',
    briefing: '쉬지 않는 기계 사이로. 프레스에 끼이지 마!' },
  { id: 8, part: 2, name: '옥상', subtitle: '밤하늘 아래 경비선', theme: 0, variant: 'night',
    briefing: '밤하늘 아래 마지막 경비선. 헬기가 곧 온다.' },
  { id: 9, part: 2, name: '헬기 탈출', subtitle: '동이 트는 하늘', theme: 0, variant: 'dawn',
    briefing: '동이 튼다. 헬기까지 전력 질주!' },
];

export interface ChapterScenes {
  readonly scenes: readonly [Scene, Scene, Scene]; // sections 0 / 1 / 2
  readonly transitions: readonly [TransitionKind, TransitionKind]; // doors into sections 1 / 2
}

const sc = (world: WorldId, variant: Variant): Scene => ({ world, variant });

/** GDD v5 §6.1, one row per chapter (only designed looks; section 0 = the chapter's own look) */
export const CHAPTER_SCENES: readonly ChapterScenes[] = [
  { scenes: [sc(0, 'base'), sc(3, 'base'), sc(3, 'steam')], transitions: ['turn', 'stairs'] },
  { scenes: [sc(3, 'steam'), sc(3, 'base'), sc(1, 'base')], transitions: ['turn', 'stairs'] },
  { scenes: [sc(1, 'base'), sc(1, 'dark'), sc(1, 'base')], transitions: ['elevator', 'turn'] },
  { scenes: [sc(1, 'dark'), sc(1, 'base'), sc(2, 'base')], transitions: ['turn', 'stairs'] },
  { scenes: [sc(2, 'base'), sc(3, 'base'), sc(2, 'base')], transitions: ['stairs', 'elevator'] },
  { scenes: [sc(2, 'alarm'), sc(1, 'alarm'), sc(2, 'alarm')], transitions: ['turn', 'stairs'] },
  { scenes: [sc(1, 'alarm'), sc(1, 'dark'), sc(3, 'base')], transitions: ['turn', 'elevator'] },
  { scenes: [sc(3, 'base'), sc(3, 'steam'), sc(0, 'night')], transitions: ['turn', 'elevator'] },
  { scenes: [sc(0, 'night'), sc(1, 'dark'), sc(0, 'night')], transitions: ['turn', 'stairs'] },
  { scenes: [sc(0, 'dawn'), sc(0, 'base'), sc(0, 'dawn')], transitions: ['stairs', 'turn'] },
];

type StageLook = Pick<StageDef, 'chapter' | 'world' | 'variant'>;

/** the chapter whose look the stage wears (endless/daily borrow a chapter look but report chapter 0) */
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

export const SKINS: readonly SkinMeta[] = [
  { id: 'kid', name: '요원 K', price: 0 },
  { id: 'cat', name: '고양이 요원', price: 60 },
  { id: 'bunny', name: '토끼 해커', price: 90 },
  { id: 'ninja', name: '닌자 요원', price: 140 },
  { id: 'robot', name: '로봇 R-7', price: 200 },
  { id: 'astro', name: '특수부대', price: 300 },
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

/**
 * Static game content (GDD v4 §5, §7): 4 corridor themes (WORLDS), 10 zones (CHAPTERS: part 1
 * rescue, part 2 escape, each a designed theme × variant look with a mission briefing),
 * 6 operative skins (v6 §3 names), and the 100-stage campaign built by the formula in campaign.ts.
 * v6: player-facing text uses a terse operations-report voice.
 * v5 §6.1: CHAPTER_SCENES — the look of each section (0 = the chapter look) and the door transitions.
 */
import type { ChapterMeta, Scene, SkinMeta, StageDef, TransitionKind, Variant, WorldId, WorldMeta } from '../types';
import { buildCampaign } from './campaign';

export { movesForMix } from './moves';

export const WORLDS: readonly WorldMeta[] = [
  { id: 0, name: '경비 초소', subtitle: '기지 외곽 경계선' },
  { id: 1, name: '연구소', subtitle: '백색 보안 실험동' },
  { id: 2, name: '감옥 블록', subtitle: '중구금 수용동' },
  { id: 3, name: '공장 · 수로', subtitle: '지하 설비 구역' },
];

/** The only theme × variant looks the renderer draws (endless/daily use these too). */
export const DESIGNED_LOOKS: Readonly<Record<WorldId, readonly Variant[]>> = {
  0: ['base', 'night', 'dawn'],
  1: ['base', 'dark', 'alarm'],
  2: ['base', 'alarm'],
  3: ['base', 'steam'],
};

export const CHAPTERS: readonly ChapterMeta[] = [
  { id: 0, part: 1, name: '외곽 경비구역', subtitle: '작전 개시', theme: 0, variant: 'base',
    briefing: '목표는 기지에 억류된 포로. 외곽 레이저 경계선을 돌파해 침투한다.' },
  { id: 1, part: 1, name: '지하 수로', subtitle: '증기 배관 구역', theme: 3, variant: 'steam',
    briefing: '정문을 우회해 지하 수로로 진입한다. 증기로 시야 불량.' },
  { id: 2, part: 1, name: '연구동', subtitle: '백색 보안 구역', theme: 1, variant: 'base',
    briefing: '연구동 진입. 보안 레이저 밀도가 높다.' },
  { id: 3, part: 1, name: '서버실', subtitle: '정전된 데이터 센터', theme: 1, variant: 'dark',
    briefing: '서버실 전력 차단 상태. 드론 순찰을 확인했다.' },
  { id: 4, part: 1, name: '감옥 블록', subtitle: '포로 수용 구역', theme: 2, variant: 'base',
    briefing: '포로 위치 확인. 경비 책임자를 돌파하면 구출 완료.' },
  { id: 5, part: 2, name: '경보 발령', subtitle: '침투 노출', theme: 2, variant: 'alarm',
    briefing: '경보 발령. 포로를 데리고 비상 경로로 이탈한다.' },
  { id: 6, part: 2, name: '연구동 비상탈출', subtitle: '비상등 점등', theme: 1, variant: 'alarm',
    briefing: '연구동 봉쇄 진행 중. 비상등을 따라 출구로 이동한다.' },
  { id: 7, part: 2, name: '공장 라인', subtitle: '가동 중인 생산 설비', theme: 3, variant: 'base',
    briefing: '생산 라인을 가로질러 이탈한다. 프레스와 로봇 팔 작동 중.' },
  { id: 8, part: 2, name: '옥상', subtitle: '야간 최종 경비선', theme: 0, variant: 'night',
    briefing: '옥상 도달. 최종 경비선을 돌파하고 헬기와 합류한다.' },
  { id: 9, part: 2, name: '헬기 탈출', subtitle: '여명의 헬리패드', theme: 0, variant: 'dawn',
    briefing: '헬기 착륙 중. 헬리패드까지 이동해 탑승, 이탈한다.' },
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
  { id: 'kid', name: '에이전트 K', price: 0 },
  { id: 'cat', name: '블랙캣', price: 70 },
  { id: 'bunny', name: '해커', price: 250 },
  { id: 'ninja', name: '섀도우', price: 450 },
  { id: 'robot', name: 'R-7', price: 700 },
  { id: 'astro', name: '특수부대', price: 1200 },
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

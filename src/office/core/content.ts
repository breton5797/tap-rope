/**
 * Office content (칼퇴근 대작전, office spec §4, §13; part 2 spec §1), swapped in for src/core/content.ts: the
 * 야근상사 building as four corridor themes plus the way home as three outdoor themes (4 퇴근길 거리·버스정류장,
 * 5 지하철역, 6 먹자골목), ten chapters of one boss stage each — part 1 (1–5) 12층 사무실 → 1층 로비, part 2
 * (6–10) 회사 정문 → 우리 집 앞 — the four free hires and the 17:30 → 18:00 → 18:30 clock.
 * Stage 5's lobby is world 0 'dawn' (the art's sunset glass set) and stage 6's 정문·광장 is world 0 'night' (the
 * exterior night set); stage 10 is the street (theme 4) at night. Stage ids keep the v8 `w{n}-s10` form so boss
 * lookup, progress and stars work unchanged. Part 1 stages introduce 1–3 moves each (spec §13 table); in part 2
 * only stage 7 teaches one (lanejump), the others remix everything taught so far.
 */
import type { ChapterMeta, MoveId, Scene, SkinMeta, StageDef, TransitionKind, Variant, WorldId, WorldMeta } from '../../types';
import { designCustomStage } from '../../core/campaign';
import type { MissionSpec } from './missions';
import { hashString } from '../../core/rng';
import { CHARACTERS } from './characters';

export { movesForMix } from '../../core/moves';

export const WORLDS: readonly WorldMeta[] = [
  { id: 0, name: '기획팀 사무실', subtitle: '야근상사 12층' },
  { id: 1, name: '탕비실 · 복도', subtitle: '복합기 앞 통로' },
  { id: 2, name: '회의실 층', subtitle: '유리벽 회의실' },
  { id: 3, name: '엘리베이터홀 · 로비', subtitle: '비상계단과 1층 회전문' },
  { id: 4, name: '퇴근길 거리', subtitle: '버스정류장과 횡단보도' },
  { id: 5, name: '지하철역', subtitle: '개찰구와 환승 통로' },
  { id: 6, name: '먹자골목', subtitle: '회식 2차의 거리' },
];

/**
 * the looks the office art covers; world 0 dawn is the sunset lobby glass and world 0 night the gate plaza
 * after dark (the renderer's exterior sets); world 4 night is the street near home (stage 10)
 */
export const DESIGNED_LOOKS: Readonly<Record<WorldId, readonly Variant[]>> = {
  0: ['base', 'dawn', 'night'],
  1: ['base'],
  2: ['base'],
  3: ['base'],
  4: ['base', 'night'],
  5: ['base'],
  6: ['base'],
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
  { id: 4, part: 1, name: '1층 로비·회전문', subtitle: '17:54 → 18:00', theme: 0, variant: 'dawn',
    briefing: '다들 저녁 먹고 가지? 내가 쏜다! 전무·이사·사장님을 뚫고 18:00 정각에 나간다.' },
  { id: 5, part: 2, name: '회사 정문·광장', subtitle: '18:00 → 18:06', theme: 0, variant: 'night',
    briefing: '퇴근 전에 설문 하나만! 인사팀 강차장이 서명판을 들고 정문을 막아섰다.' },
  { id: 6, part: 2, name: '퇴근길 버스정류장', subtitle: '18:06 → 18:12', theme: 4, variant: 'base',
    briefing: '택시 같이 타자, 가면서 엑셀 얘기 좀. 박과장보다 먼저 버스에 올라탄다.' },
  { id: 7, part: 2, name: '지하철역 개찰구', subtitle: '18:12 → 18:18', theme: 5, variant: 'base',
    briefing: '잠깐, 영수증 처리 확인 좀. 감사팀 문상무를 지나 개찰구를 통과하라.' },
  { id: 8, part: 2, name: '먹자골목', subtitle: '18:18 → 18:24', theme: 6, variant: 'base',
    briefing: '1차는 맛보기야! 2차 가자! 윤이사의 회식 2차 손짓을 뿌리친다.' },
  { id: 9, part: 2, name: '우리 집 앞 동네', subtitle: '18:24 → 18:30', theme: 4, variant: 'night',
    briefing: '최팀장·한전무에 회장님까지! 마지막 골목을 지나 18:30 현관문에 도착한다.' },
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
  // lobby glass at sunset → down the last stairs past the elevator hall → the revolving door
  { scenes: [sc(0, 'dawn'), sc(3, 'base'), sc(0, 'dawn')], transitions: ['stairs', 'turn'] },
  // part 2: out of the gate plaza onto the street → down into the subway → up into the food alley → home
  { scenes: [sc(0, 'night'), sc(0, 'night'), sc(4, 'base')], transitions: ['turn', 'turn'] },
  { scenes: [sc(4, 'base'), sc(4, 'base'), sc(5, 'base')], transitions: ['turn', 'stairs'] },
  { scenes: [sc(5, 'base'), sc(5, 'base'), sc(6, 'base')], transitions: ['turn', 'stairs'] },
  { scenes: [sc(6, 'base'), sc(6, 'base'), sc(4, 'night')], transitions: ['turn', 'turn'] },
  { scenes: [sc(4, 'night'), sc(4, 'night'), sc(4, 'night')], transitions: ['turn', 'turn'] },
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

/** v2.2: all four hires are free and owned from the start (picked on the first launch) */
export const SKINS: readonly SkinMeta[] = CHARACTERS.map((c) => ({ id: c.id, name: c.name, price: 0 }));

/**
 * spec §13: moves each stage teaches (beams arrive with the 2단 jump: the 결재판 boomerang); part 2 (6–10)
 * teaches only lanejump on stage 7, the rest remix (an empty row adds nothing: designCustomStage's intro)
 */
const NEW_MOVES: readonly (readonly MoveId[])[] = [
  ['jump', 'slide', 'lane'],
  ['double', 'beam', 'drone', 'drop'],
  ['chaser', 'high'],
  ['triple'],
  ['rear'],
  [],
  ['lanejump'],
  [],
  [],
  [],
];
/** difficulty per stage; 6–10 are monotone placeholders the balance pass tunes (part 2 spec §4) */
const D: readonly number[] = [0.15, 0.3, 0.45, 0.58, 0.7, 0.73, 0.76, 0.79, 0.82, 0.85];

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

/**
 * v2: the StageDef one mission part is generated from — the stage's look and tempo (one bpm per stage), the
 * mission's moves and focus, its hazards and pickup rate, one section, and a seed derived from the run seed.
 */
export function missionPartStage(stage: StageDef, k: number, spec: MissionSpec): StageDef {
  const i = Math.max(0, STAGES.findIndex((s) => s.id === stage.id));
  const def = designCustomStage(
    {
      id: `${stage.id}#${k}`, name: stage.name, n: (i + 1) * 10, chapter: stage.chapter, index: stage.index, kind: 'boss',
      world: stage.world, variant: stage.variant, d: D[i], seed: hashString(`${stage.seed}:part${k}`), campaign: true,
    },
    spec.moves,
    spec.focus ?? [],
  );
  return { ...def, bpm: stage.bpm, hazardBeats: spec.hazards, pickupRate: spec.pickupRate, sections: 1 };
}

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

/** wall clock "HH:MM" at `progress01` (clamped) through stage `stageIndex`: 17:30 + 6·n min, 18:00 after stage 5, 18:30 after 10 */
export function OFFICE_CLOCK(stageIndex: number, progress01: number): string {
  const p = Math.min(1, Math.max(0, progress01));
  const minutes = Math.floor(CLOCK_START + STAGE_MINUTES * (stageIndex + p) + 1e-9);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

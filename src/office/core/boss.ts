/**
 * Office superiors (office spec §5, §13-4) — the office build's src/core/boss.ts (build/office-swaps.ts).
 * - Prototype shortcut: the seven superiors reuse v8 BossId slots so every shared renderer/HUD path keeps
 *   working (warden=김대리, sewer-eye=박과장, lab-ai=최팀장, core=오부장, jailer=한전무, apc=윤이사,
 *   chimera=사장님). Display text always comes from BOSSES / OFFICE_BOSSES, never the slot id.
 * - Stages 1–4 ("w{n}-s10") have one superior and a whole-stage "퇴근 게이지" (v8 rules).
 * - Stage 5 has one superior per section (한전무 → 윤이사 → 사장님): bossView returns the section's
 *   superior, hp counts only that section's hazards, and a door brings the next superior in ('intro'
 *   for STAGGER_TIME) instead of a stagger. Timing windows are the v8 ones; judging is untouched.
 */
import type { Beat, BossId, BossMeta, BossView, Door, StageDef } from '../../types';
import { HAZARD_KINDS } from '../../types';
import { ATTACK_LEAD, INTRO_LEAD, STAGGER_TIME, bossView as v8BossView } from '../../core/boss';

export { ATTACK_LEAD, INTRO_LEAD, STAGGER_TIME };

/** the stage whose sections each bring their own superior */
const FINAL_STAGE = 5;

export interface OfficeBoss {
  readonly slot: BossId;
  readonly title: string; // 직급
  readonly name: string; // e.g. "김대리"
  readonly stage: number; // 1..5
  readonly section: 0 | 1 | 2 | null; // stage 5 only
  readonly catchphrase: string; // speech bubble at the intro
  readonly exitLine: string; // speech bubble when the gauge runs out
  readonly tag: string; // short comic tag shown where v8 shows the codename
}

export const OFFICE_BOSSES: readonly OfficeBoss[] = [
  { slot: 'warden', title: '대리', name: '김대리', stage: 1, section: null, tag: '잠깐만~',
    catchphrase: '잠깐만~ 이것만 좀 봐줄래?', exitLine: '…그래, 가 봐. 내일 봐 줘~' },
  { slot: 'sewer-eye', title: '과장', name: '박과장', stage: 2, section: null, tag: '최종_v3',
    catchphrase: '엑셀 최종본 수정 좀… 최종_진짜최종_v3', exitLine: '…그래, 가 봐. v4는 내일 하자' },
  { slot: 'lab-ai', title: '팀장', name: '최팀장', stage: 3, section: null, tag: '5분만',
    catchphrase: '5분만 회의하자. 진짜 5분.', exitLine: '…그래, 가 봐. 회의록은 내가 쓸게' },
  { slot: 'core', title: '부장', name: '오부장', stage: 4, section: null, tag: '라떼는',
    catchphrase: '라떼는 말이야, 9시 퇴근이 기본이었어', exitLine: '…그래, 가 봐. 요즘 친구들 빠르네' },
  { slot: 'jailer', title: '전무', name: '한전무', stage: 5, section: 0, tag: '결재 회오리',
    catchphrase: '이 결재 서류, 오늘 안에 되겠지?', exitLine: '…그래, 가 봐. 결재는 내일 하지' },
  { slot: 'apc', title: '이사', name: '윤이사', stage: 5, section: 1, tag: '회식 가자',
    catchphrase: '다들 저녁 먹고 가지? 내가 쏜다!', exitLine: '…그래, 가 봐. 회식은 다음에!' },
  { slot: 'chimera', title: '사장', name: '사장님', stage: 5, section: 2, tag: '다들 수고~',
    catchphrase: '다들 수고 많아요~ 잠깐 얘기 좀 할까?', exitLine: '…그래, 가 봐. 칼퇴도 실력이지!' },
];

/** v8 surface: chapter = stage − 1 (the three stage-5 superiors share chapter 4) */
export const BOSSES: readonly BossMeta[] = OFFICE_BOSSES.map((b) => ({
  id: b.slot, chapter: b.stage - 1, name: b.name, codename: b.tag,
}));

type BossStage = Pick<StageDef, 'id' | 'kind' | 'chapter'>;

const stageNumber = (stage: BossStage): number | null =>
  stage.kind === 'boss' && stage.id === `w${stage.chapter + 1}-s10` ? stage.chapter + 1 : null;

/** the superior of `section` on an office stage ("w1-s10".."w5-s10"), else null */
export function bossForSection(stage: BossStage, section: number): BossMeta | null {
  const n = stageNumber(stage);
  if (n === null) return null;
  const office = OFFICE_BOSSES.find((b) => b.stage === n && (b.section === null || b.section === section));
  return office ? BOSSES.find((b) => b.id === office.slot) ?? null : null;
}

/** the stage superior (stage 5: the first one, 한전무), else null */
export function bossFor(stage: BossStage): BossMeta | null {
  return bossForSection(stage, 0);
}

const isHazardBeat = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));

/** stage 5: the section's superior, its own gauge, and an intro (not a stagger) after each door */
function finalStageView(base: BossView, stage: BossStage, beats: readonly Beat[], hazardDone: number): BossView {
  const boss = bossForSection(stage, base.phase);
  const hazards = beats.filter(isHazardBeat);
  const own = hazards.filter((b) => b.section === base.phase).length;
  const before = hazards.filter((b) => b.section < base.phase).length;
  const done = Math.min(own, Math.max(0, hazardDone - before));
  const hp = own > 0 ? 1 - done / own : 1;
  // v8 staggers the boss after a door; here the next superior walks in during that same window
  return { ...base, id: boss?.id ?? base.id, hp, state: base.state === 'stagger' ? 'intro' : base.state };
}

export function bossView(
  stage: BossStage, beats: readonly Beat[], doors: readonly Door[], t: number, hazardDone: number, hazardTotal: number,
): BossView | null {
  const n = stageNumber(stage);
  if (n === null) return null;
  // the v8 view only needs *a* boss on the stage; office stage ids match its "w{n}-s10" rule
  const base = v8BossView(stage, beats, doors, t, hazardDone, hazardTotal);
  if (!base) return null;
  if (n === FINAL_STAGE) return finalStageView(base, stage, beats, hazardDone);
  const boss = bossFor(stage);
  return boss ? { ...base, id: boss.id } : null;
}

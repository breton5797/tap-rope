/**
 * Office superiors (office spec §5, §13-4; part 2 spec §1) — the office build's src/core/boss.ts
 * (build/office-swaps.ts).
 * - Prototype shortcut: the ten superiors reuse v8 BossId slots so every shared renderer/HUD path keeps
 *   working (warden=김대리, sewer-eye=박과장, lab-ai=최팀장, core=오부장, jailer=한전무, apc=윤이사,
 *   chimera=사장님, crane=강차장, sniper=문상무, gunship=회장님). Display text always comes from BOSSES /
 *   OFFICE_BOSSES, never the slot id.
 * - Rematches (part 2: 박과장 on 7, 윤이사 on 9, 최팀장 / 한전무 on 10) are extra OFFICE_BOSSES rows on the same
 *   slot (same person, same art) with their own lines, so a slot can appear more than once. Lookups therefore
 *   go by stage (+ section), never by slot: bossForSection builds the BossMeta from the stage's own row (chapter
 *   = stage − 1), and superiorAt(stage, section) gives the full row. Finding a row by slot alone returns the
 *   part-1 one (same name and art, part-1 lines).
 * - Single-superior stages have one superior and a whole-stage "퇴근 게이지" (v8 rules).
 * - Stages 5 and 10 (MULTI_STAGES) have one superior per section (5: 한전무 → 윤이사 → 사장님, 10: 최팀장 →
 *   한전무 → 회장님): bossView returns the section's superior, hp counts only that section's hazards, and a door
 *   brings the next superior in ('intro' for STAGGER_TIME) instead of a stagger. Timing windows are the v8
 *   ones; judging is untouched.
 */
import type { Beat, BossId, BossMeta, BossView, Door, StageDef } from '../../types';
import { HAZARD_KINDS } from '../../types';
import { ATTACK_LEAD, INTRO_LEAD, STAGGER_TIME, bossView as v8BossView } from '../../core/boss';

export { ATTACK_LEAD, INTRO_LEAD, STAGGER_TIME };

/** the stages whose sections each bring their own superior (the end of part 1 and of part 2) */
const MULTI_STAGES: ReadonlySet<number> = new Set([5, 10]);

export interface OfficeBoss {
  readonly slot: BossId;
  readonly title: string; // 직급
  readonly name: string; // e.g. "김대리"
  readonly stage: number; // 1..10
  readonly section: 0 | 1 | 2 | null; // stages 5 and 10 only
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
  // ---- part 2: 퇴근길 ----
  { slot: 'crane', title: '차장', name: '강차장', stage: 6, section: null, tag: '설문 하나만',
    catchphrase: '퇴근 전에 설문 하나만! 금방 끝나~', exitLine: '…그래, 가 봐. 설문은 메일로 보낼게' },
  { slot: 'sewer-eye', title: '과장', name: '박과장', stage: 7, section: null, tag: '택시 같이',
    catchphrase: '택시 같이 타자, 가면서 엑셀 얘기 좀', exitLine: '…그래, 가 봐. 엑셀은 단톡방에 올릴게' },
  { slot: 'sniper', title: '상무', name: '문상무', stage: 8, section: null, tag: '영수증 확인',
    catchphrase: '잠깐, 영수증 처리 확인 좀 하지', exitLine: '…그래, 가 봐. 영수증은 내일 아침에!' },
  { slot: 'apc', title: '이사', name: '윤이사', stage: 9, section: null, tag: '2차 가자',
    catchphrase: '1차는 맛보기야! 2차 가자!', exitLine: '…그래, 가 봐. 3차는 다음에 꼭!' },
  { slot: 'lab-ai', title: '팀장', name: '최팀장', stage: 10, section: 0, tag: '통화 5분만',
    catchphrase: '퇴근길에 잠깐 통화 5분만! 진짜 5분!', exitLine: '…그래, 가 봐. 통화는 내일 9시에' },
  { slot: 'jailer', title: '전무', name: '한전무', stage: 10, section: 1, tag: '집 앞 결재',
    catchphrase: '이 결재, 집 앞에서 받아도 되지?', exitLine: '…그래, 가 봐. 결재판은 두고 갈게' },
  { slot: 'gunship', title: '회장', name: '회장님', stage: 10, section: 2, tag: '자네 말이야',
    catchphrase: '자네, 우리 회사 다닌 지 얼마나 됐지?', exitLine: '…그래, 가 봐. 칼퇴가 회사의 미래지!' },
];

/** a superior row as the v8 BossMeta (chapter = stage − 1; the multi-superior stages share their chapter) */
const toMeta = (b: OfficeBoss): BossMeta => ({ id: b.slot, chapter: b.stage - 1, name: b.name, codename: b.tag });

/**
 * v8 surface: one entry per OFFICE_BOSSES row, chapter = stage − 1 (the three superiors of stage 5 share chapter
 * 4, those of stage 10 chapter 9). A rematch slot appears twice (different chapters): find by chapter, not id.
 */
export const BOSSES: readonly BossMeta[] = OFFICE_BOSSES.map(toMeta);

type BossStage = Pick<StageDef, 'id' | 'kind' | 'chapter'>;

const stageNumber = (stage: BossStage): number | null =>
  stage.kind === 'boss' && stage.id === `w${stage.chapter + 1}-s10` ? stage.chapter + 1 : null;

/** the superior row of `section` on office stage number `stage` (1-based), else null */
export function superiorAt(stage: number, section: number): OfficeBoss | null {
  return OFFICE_BOSSES.find((b) => b.stage === stage && (b.section === null || b.section === section)) ?? null;
}

/** the superior of `section` on an office stage ("w1-s10".."w10-s10"), else null */
export function bossForSection(stage: BossStage, section: number): BossMeta | null {
  const n = stageNumber(stage);
  const office = n === null ? null : superiorAt(n, section);
  return office ? BOSSES[OFFICE_BOSSES.indexOf(office)] : null;
}

/** the stage superior (stages 5 / 10: the first one, 한전무 / 최팀장), else null */
export function bossFor(stage: BossStage): BossMeta | null {
  return bossForSection(stage, 0);
}

const isHazardBeat = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));

/** stages 5 / 10: the section's superior, its own gauge, and an intro (not a stagger) after each door */
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
  if (MULTI_STAGES.has(n)) return finalStageView(base, stage, beats, hazardDone);
  const boss = bossFor(stage);
  return boss ? { ...base, id: boss.id } : null;
}

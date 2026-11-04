/**
 * Office boss lines (office spec §5) — the office build's src/game/boss-lines.ts (build/office-swaps.ts).
 * Same helpers as v8: each phase is announced with the superior's attack name ("2차 공격 — 결재판 부메랑"),
 * and the last hazard becomes the finisher slow motion. On stages 5 and 10 each section has its own superior,
 * so phase n is announced with that section's superior's n-th attack. Lines are keyed by slot; a part-2
 * rematch (박과장 on 7, 윤이사 on 9, 최팀장 / 한전무 on 10) has its own commute attacks keyed by stage + slot
 * (REMATCH_ATTACKS), so phaseLineDue takes the stage; without one (or off a rematch) the slot names apply.
 */
import type { BossId, BossView, StageDef } from '../../types';
import { bossForSection } from '../core/boss';
import { FINISHER_SLOW, INTRO_LINE_AGE, finisherStarts, type PhaseLine } from '../../game/boss-lines';

export { FINISHER_SLOW, INTRO_LINE_AGE, finisherStarts, type PhaseLine };

/** attack name per superior and phase (1..3): every v8 slot is a superior now (crane / sniper / gunship = part 2) */
export const BOSS_ATTACKS: Readonly<Record<BossId, readonly [string, string, string]>> = {
  warden: ['포스트잇 폭풍', '서류 더미 와르르', '커피 좀 사 와~ 쟁반'],
  'sewer-eye': ['최종_v3 종이비행기', '결재판 부메랑', '복합기 용지 걸림'],
  'lab-ai': ['회의실 문 벌컥', '화이트보드 돌진', '레이저 포인터 "여기 보세요~"'],
  core: ['나이스 샷 퍼팅', '"라떼는 말이야" 말풍선', '엘리베이터 띵!'],
  jailer: ['결재 서류 회오리', '서류 회오리 2연타', '최종 결재 폭풍'],
  apc: ['넥타이 채찍', '법인카드 "회식 가자"', '회식 총공세'],
  chimera: ['화상회의 거대 얼굴', '회전문 가속', '금일봉 봉투 비'],
  crane: ['설문지 폭탄', '서명판 부메랑', '"하나만 더!" 설문 폭풍'],
  sniper: ['영수증 뭉치 투척', '돋보기 "이건 뭐지?"', '감사 도장 연타'],
  gunship: ['훈화 말씀 확성기', '"자네!" 손짓', '창립기념 떡 세례'],
};

/** part 2 rematches: "<stage>:<slot>" → attack names (the commute: 택시·버스, 먹자골목 2차, 집 앞) */
export const REMATCH_ATTACKS: Readonly<Record<string, readonly [string, string, string]>> = {
  '7:sewer-eye': ['택시 합승 손짓', '"가면서 엑셀 얘기 좀" 노트북', '버스 문 앞 최종_v4'],
  '9:apc': ['꼬치 세례', '"2차 가자!" 어깨동무', '노래방 마이크 돌진'],
  '10:lab-ai': ['퇴근길 영상통화 "5분만"', '"진짜 5분" 무한 통화', '집 앞 단톡방 회의 소집'],
  '10:jailer': ['집 앞 결재판 회오리', '현관 앞 결재 2연타', '도어락 앞 최종 결재'],
};

type LineStage = Pick<StageDef, 'id' | 'kind' | 'chapter'>;

/** the attack names of the superior in view: the stage's rematch set, else the slot's */
function attacksOf(cur: BossView, stage: LineStage | undefined): readonly [string, string, string] {
  const meta = stage ? bossForSection(stage, cur.phase) : null;
  return (meta && REMATCH_ATTACKS[`${meta.chapter + 1}:${cur.id}`]) || BOSS_ATTACKS[cur.id];
}

/** surprise event "사장님 깜짝 순시 사내방송": every superior's line becomes this (copy only) */
export const BROADCAST_LINE = '네 사장님!';

/** the phase line due now, given the last phase already announced (−1 = none), on `stage` (rematch names) */
export function phaseLineDue(lastAnnounced: number, cur: BossView | null, stage?: LineStage): PhaseLine | null {
  if (!cur || cur.state === 'defeated' || cur.phase <= lastAnnounced) return null;
  if (cur.phase === 0 && cur.state === 'intro' && cur.stateAge < INTRO_LINE_AGE) return null;
  return { phase: cur.phase, kicker: `${cur.phase + 1}차 공격`, text: attacksOf(cur, stage)[cur.phase] };
}

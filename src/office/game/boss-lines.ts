/**
 * Office boss lines (office spec §5) — the office build's src/game/boss-lines.ts (build/office-swaps.ts).
 * Same helpers as v8: each phase is announced with the superior's attack name ("2차 공격 — 결재판 부메랑"),
 * and the last hazard becomes the finisher slow motion. On stage 5 each section has its own superior, so
 * phase n is announced with that section's superior's n-th attack.
 */
import type { BossId, BossView } from '../../types';
import { FINISHER_SLOW, INTRO_LINE_AGE, finisherStarts, type PhaseLine } from '../../game/boss-lines';

export { FINISHER_SLOW, INTRO_LINE_AGE, finisherStarts, type PhaseLine };

/** attack name per superior and phase (1..3); unused v8 slots keep a generic office set */
export const BOSS_ATTACKS: Readonly<Record<BossId, readonly [string, string, string]>> = {
  warden: ['포스트잇 폭풍', '서류 더미 와르르', '커피 좀 사 와~ 쟁반'],
  'sewer-eye': ['최종_v3 종이비행기', '결재판 부메랑', '복합기 용지 걸림'],
  'lab-ai': ['회의실 문 벌컥', '화이트보드 돌진', '레이저 포인터 "여기 보세요~"'],
  core: ['나이스 샷 퍼팅', '"라떼는 말이야" 말풍선', '엘리베이터 띵!'],
  jailer: ['결재 서류 회오리', '서류 회오리 2연타', '최종 결재 폭풍'],
  apc: ['넥타이 채찍', '법인카드 "회식 가자"', '회식 총공세'],
  chimera: ['화상회의 거대 얼굴', '회전문 가속', '금일봉 봉투 비'],
  crane: ['야근 요청', '추가 업무', '주말 출근'],
  sniper: ['야근 요청', '추가 업무', '주말 출근'],
  gunship: ['야근 요청', '추가 업무', '주말 출근'],
};

/** surprise event "사장님 깜짝 순시 사내방송": every superior's line becomes this (copy only) */
export const BROADCAST_LINE = '네 사장님!';

/** the phase line due now, given the last phase already announced (−1 = none) */
export function phaseLineDue(lastAnnounced: number, cur: BossView | null): PhaseLine | null {
  if (!cur || cur.state === 'defeated' || cur.phase <= lastAnnounced) return null;
  if (cur.phase === 0 && cur.state === 'intro' && cur.stateAge < INTRO_LINE_AGE) return null;
  return { phase: cur.phase, kicker: `${cur.phase + 1}차 공격`, text: BOSS_ATTACKS[cur.id][cur.phase] };
}

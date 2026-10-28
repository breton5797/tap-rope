/**
 * v8 (GDD-v8 A3, presentation only): the boss announces each phase with its attack name
 * ("PHASE 2 — 기관포 연사"), and the last hazard becomes a finisher (slow motion, then the boss blows up
 * as the agent lands). Pure helpers; app.ts plays them, render/boss.ts draws the blast.
 */
import type { BossId, BossView } from '../types';

/** attack name per boss and phase (1..3) */
export const BOSS_ATTACKS: Readonly<Record<BossId, readonly [string, string, string]>> = {
  warden: ['순찰 사격', '봉쇄 레이저', '총력 진압'],
  'sewer-eye': ['탐색 스캔', '수류 레이저', '전방위 감시'],
  'lab-ai': ['방어 프로토콜', '레이저 격자', '시스템 폭주'],
  core: ['전력 방출', '과부하 펄스', '코어 붕괴'],
  jailer: ['구속 장치', '감금 레이저', '최종 봉쇄'],
  apc: ['돌진', '포탑 연사', '전면 돌파'],
  chimera: ['포식 본능', '독침 난사', '광폭화'],
  crane: ['화물 낙하', '프레스 강타', '전 라인 가동'],
  sniper: ['조준', '정밀 저격', '연속 저격'],
  gunship: ['탐조등 추적', '기관포 연사', '미사일 일제 사격'],
};

/** the first phase is announced once the boss has revealed itself */
export const INTRO_LINE_AGE = 0.8;

export interface PhaseLine {
  readonly phase: number; // 0..2
  readonly kicker: string; // "PHASE 2"
  readonly text: string; // attack name
}

/** the phase line due now, given the last phase already announced (−1 = none) */
export function phaseLineDue(lastAnnounced: number, cur: BossView | null): PhaseLine | null {
  if (!cur || cur.state === 'defeated' || cur.phase <= lastAnnounced) return null;
  if (cur.phase === 0 && cur.state === 'intro' && cur.stateAge < INTRO_LINE_AGE) return null;
  return { phase: cur.phase, kicker: `PHASE ${cur.phase + 1}`, text: BOSS_ATTACKS[cur.id][cur.phase] };
}

/** the boss just took its last hazard (HP reached 0): start the finisher slow motion */
export function finisherStarts(prev: BossView | null, cur: BossView | null): boolean {
  return prev !== null && cur !== null && prev.hp > 0 && cur.hp <= 0;
}

/** finisher slow motion (timewarp caps it at 0.5 s real): covers most of the last jump's fall */
export const FINISHER_SLOW = { seconds: 0.5, factor: 0.3 } as const;

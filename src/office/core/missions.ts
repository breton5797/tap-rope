/**
 * Office v2 missions (spec §3): each stage is three missions, one per section — dodge / collect / chase /
 * finale. This file holds the script (STAGE_MISSIONS, spec §3.2) and the pure rules: progress, the stage
 * grade, stars and the stamp bonus. Missions never fail a stage (only 체력 0 does): a completed mission is a
 * stamp, a reward rather than a gate.
 * Part generation (office/core/levels.ts) reads `hazards`, `moves`, `focus`, `density` and `pickupRate`.
 */
import type { MoveId } from '../../types';

export type MissionKind = 'dodge' | 'collect' | 'chase' | 'finale';
export type CollectibleId = 'coupon' | 'docs' | 'cookie' | 'badge' | 'envelope';

export interface MissionSpec {
  readonly kind: MissionKind;
  readonly title: string;
  /** dodge / chase / finale: the scripted hazards; collect: the items to collect */
  readonly target: number;
  /** hazards the part is generated with */
  readonly hazards: number;
  readonly moves: readonly MoveId[];
  /** moves that get an intro-sized share of the mix (the section's signature attack) */
  readonly focus?: readonly MoveId[];
  /** < 1 spreads the part out (collect: 0.6); ≥ 1 keeps the boss spacing (no extra slack) */
  readonly density: number;
  readonly pickupRate: number;
  /** collect: the stage's themed item; a finale may carry a bonus collectible too */
  readonly collectible?: CollectibleId;
  /** the superior's line on the mission card */
  readonly line: string;
}

export interface MissionStats {
  hazardsTotal: number;
  dodged: number;
  hits: number;
  collected: number;
  /** finale: the last hazard (the leap) was passed without a hit */
  finisherClean: boolean;
}

const S1 = ['jump', 'slide', 'lane'] as const;
const S2 = [...S1, 'double', 'beam', 'drone', 'drop'] as const;
const S3 = [...S2, 'chaser', 'high'] as const;
const S4 = [...S3, 'triple'] as const;
const S5 = [...S4, 'rear'] as const;

const COLLECT = { density: 0.6, pickupRate: 1 } as const;
const DODGE = { density: 1, pickupRate: 0.25 } as const;
const CHASE = { density: 1.15, pickupRate: 0.15 } as const;
const FINALE = { density: 1, pickupRate: 0.15 } as const;

const m = (spec: MissionSpec): MissionSpec => spec;

/** spec §3.2 — numbers are hazards (dodge / chase / finale) or the collect target */
export const STAGE_MISSIONS: Readonly<Record<string, readonly [MissionSpec, MissionSpec, MissionSpec]>> = {
  'w1-s10': [
    m({ kind: 'dodge', title: '포스트잇 폭풍', target: 8, hazards: 8, moves: S1, focus: ['lane'], ...DODGE, line: '잠깐만~ 이것만 좀 봐줄래?' }),
    m({ kind: 'collect', title: '커피 쿠폰', target: 5, hazards: 8, moves: S1, collectible: 'coupon', ...COLLECT, line: '커피 좀 사 와~ 쿠폰은 알아서 모으고!' }),
    m({ kind: 'finale', title: '잠깐만~ 뛰어넘기', target: 8, hazards: 8, moves: S1, focus: ['slide'], ...FINALE, line: '어디 가? 아직 6시 안 됐잖아~' }),
  ],
  'w2-s10': [
    m({ kind: 'collect', title: '최종_v3 서류', target: 6, hazards: 9, moves: ['jump', 'double', 'lane', 'drop'], collectible: 'docs', ...COLLECT, line: '최종_진짜최종_v3 어디 갔어?' }),
    m({ kind: 'dodge', title: '종이비행기 편대', target: 10, hazards: 10, moves: ['jump', 'double', 'drone', 'lane'], focus: ['drone'], ...DODGE, line: '복합기가 또 폭주한다!' }),
    m({ kind: 'finale', title: '결재판 부메랑', target: 10, hazards: 10, moves: S2, focus: ['beam'], ...FINALE, line: '이거 결재 받고 가야지~' }),
  ],
  'w3-s10': [
    m({ kind: 'chase', title: '5분만! 회의실 추격', target: 12, hazards: 12, moves: ['jump', 'slide', 'lane', 'double', 'chaser', 'drop'], focus: ['chaser'], ...CHASE, line: '5분만 회의하자. 진짜 5분!' }),
    m({ kind: 'dodge', title: '레이저 포인터 회랑', target: 10, hazards: 10, moves: ['jump', 'slide', 'high', 'double', 'lane'], focus: ['slide', 'high'], ...DODGE, line: '여기 보세요~ 여기, 여기!' }),
    m({ kind: 'finale', title: '회의 소집 저지', target: 12, hazards: 12, moves: S3, focus: ['chaser', 'high'], ...FINALE, line: '전원 회의실로 집합!' }),
  ],
  'w4-s10': [
    m({ kind: 'dodge', title: '골프공 퍼팅', target: 12, hazards: 12, moves: ['jump', 'double', 'triple', 'lane', 'slide'], ...DODGE, line: '나이스 샷~ 라떼는 말이야!' }),
    m({ kind: 'collect', title: '사원증', target: 7, hazards: 10, moves: ['jump', 'double', 'lane', 'slide', 'drop'], collectible: 'badge', ...COLLECT, line: '사원증 없으면 못 나가~' }),
    m({ kind: 'finale', title: '엘리베이터 문', target: 14, hazards: 14, moves: S4, focus: ['chaser', 'lane'], ...FINALE, line: '띵~ 같이 내려가지?' }),
  ],
  'w5-s10': [
    m({ kind: 'finale', title: '결재 회오리', target: 14, hazards: 14, moves: S5, focus: ['drone'], ...FINALE, line: '이 결재는 오늘 꼭 받아야 해!' }),
    m({ kind: 'chase', title: '회식 가자', target: 14, hazards: 14, moves: S5, focus: ['chaser', 'rear'], ...CHASE, line: '다들 저녁 먹고 가지? 내가 쏜다!' }),
    m({ kind: 'finale', title: '회전문 피날레', target: 16, hazards: 16, moves: S5, focus: ['lane'], ...FINALE, collectible: 'envelope', line: '수고 많아요~ 잠깐 얘기 좀 할까?' }),
  ],
};

/** the mission of `section` on a stage, or null off the office script */
export function missionFor(stageId: string, section: number): MissionSpec | null {
  return STAGE_MISSIONS[stageId]?.[section] ?? null;
}

const DODGE_SHARE = 0.8;
const MAX_HITS = 2;

/** value / target shown on the chip and whether the mission is (so far) complete */
export function missionProgress(spec: MissionSpec, s: MissionStats): { readonly value: number; readonly target: number; readonly complete: boolean } {
  switch (spec.kind) {
    case 'dodge':
      return { value: s.dodged, target: s.hazardsTotal, complete: s.dodged >= Math.floor(DODGE_SHARE * s.hazardsTotal) };
    case 'collect':
      return { value: s.collected, target: spec.target, complete: s.collected >= spec.target };
    case 'chase':
      return { value: s.dodged, target: s.hazardsTotal, complete: s.hits <= MAX_HITS };
    case 'finale':
      return { value: s.dodged, target: s.hazardsTotal, complete: s.finisherClean && s.hits <= MAX_HITS };
  }
}

export type StageGrade = 'S' | 'A' | 'B' | 'C';

/** S = every stamp and no hit all stage, A = every stamp, B = 1–2 stamps, C = none */
export function stageGrade(stamps: readonly boolean[], hits: number): StageGrade {
  const n = stamps.filter(Boolean).length;
  if (n === stamps.length && n > 0) return hits === 0 ? 'S' : 'A';
  return n > 0 ? 'B' : 'C';
}

/** a cleared stage earns max(1, stamps) stars */
export function starsFor(stamps: readonly boolean[]): 1 | 2 | 3 {
  return Math.min(3, Math.max(1, stamps.filter(Boolean).length)) as 1 | 2 | 3;
}

/** 칼퇴 포인트 for each stamp on stage `stageIndex` (0-based) */
export const MISSION_BONUS = (stageIndex: number): number => 150 * (stageIndex + 1);

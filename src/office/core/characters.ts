/**
 * v2.2 four heroes (spec §1–2): who they are and what their stars do. Ids reuse the SkinId slots (save
 * compatibility); only the names are shown. Fairness ranks above stats (P3): a character may jump higher,
 * switch lanes faster or slide longer than the default, never less — the generator assumes the default
 * (LANE_STEP per lane, DEFAULT_PHYSICS airtimes) and lays every stage out with the character's own physics.
 * Focus (fever gauge gain) and luck (coin multiplier) only touch points and the economy, never judging.
 */
import type { PhysicsConfig, SkinId } from '../../types';
import { LANE_SWITCH_TIME } from '../../types';
import { DEFAULT_PHYSICS } from '../../core/physics';
import { LANE_STEP } from '../../core/spacing';

export interface Stars {
  readonly jump: number;
  readonly agility: number;
  readonly hearts: number;
  readonly focus: number;
  readonly luck: number;
}

export interface Character {
  readonly id: SkinId;
  readonly name: string;
  readonly gender: 'm' | 'f';
  /** the type tag on the card, e.g. "균형형" */
  readonly role: string;
  readonly blurb: string;
  readonly catchphrase: string;
  /** point colour (rings, collect bursts, card trim) */
  readonly accent: string;
  readonly stars: Stars;
}

export interface CharacterStats {
  readonly physics: PhysicsConfig;
  /** seconds a human-paced lane switch takes with this character (the generator assumes LANE_STEP) */
  readonly laneTime: number;
  readonly slideTime: number;
  readonly hearts: number;
  /** fever gauge gain multiplier */
  readonly feverGain: number;
  /** coin multiplier */
  readonly coinMul: number;
}

export const STAR_AXES: readonly { readonly key: keyof Stars; readonly label: string }[] = [
  { key: 'jump', label: '점프력' },
  { key: 'agility', label: '민첩' },
  { key: 'hearts', label: '체력' },
  { key: 'focus', label: '집중' },
  { key: 'luck', label: '행운' },
];

export const CHARACTERS: readonly Character[] = [
  {
    id: 'kid', name: '칼퇴준', gender: 'm', role: '균형형 · 성실한 신입', accent: '#4a8fe7',
    blurb: '모든 능력 보통. 처음이라면 추천!', catchphrase: '저 오늘 약속 있어서요…!',
    stars: { jump: 3, agility: 3, hearts: 3, focus: 3, luck: 3 },
  },
  {
    id: 'cat', name: '정시원', gender: 'f', role: '민첩형 · 눈치 백단', accent: '#f0628f',
    blurb: '숙이기가 길고 옆으로 비키기가 가벼워요. 몸놀림으로 승부!', catchphrase: '6시 땡이면 저는 없는 사람입니다!',
    stars: { jump: 3, agility: 5, hearts: 3, focus: 3, luck: 3 },
  },
  {
    id: 'bunny', name: '고도약', gender: 'm', role: '점프형 · 다리 긴 신입', accent: '#ff8a2a',
    blurb: '높고 길게 뛰어요. 대신 칼퇴 모드가 느리게 차고 포인트가 적어요.', catchphrase: '한 번에 넘으면 되죠?',
    stars: { jump: 5, agility: 3, hearts: 3, focus: 2, luck: 2 },
  },
  {
    id: 'robot', name: '유행운', gender: 'f', role: '행운형 · 운 좋은 사원', accent: '#2ec4a6',
    blurb: '체력이 많고 칼퇴 포인트를 많이 벌어요. 대신 칼퇴 모드가 느리게 차요.', catchphrase: '오늘 왠지 느낌이 좋아요~',
    stars: { jump: 3, agility: 3, hearts: 4, focus: 2, luck: 5 },
  },
];

interface Tuning {
  readonly jumpMul: number;
  readonly boostMul: number;
  readonly laneTime: number;
  readonly slideTime: number;
  readonly hearts: number;
  readonly feverGain: number;
  readonly coinMul: number;
}

const BASE: Tuning = {
  jumpMul: 1, boostMul: 1, laneTime: LANE_STEP, slideTime: DEFAULT_PHYSICS.slideTime, hearts: 3, feverGain: 1, coinMul: 1,
};

/** spec §2 numbers (stars are the display of these) */
const TUNING: Readonly<Record<string, Tuning>> = {
  kid: BASE,
  /** 2026-11-03 user-approved balance change: cat hearts 2 → 3 (docs/balance/after.md) */
  cat: { ...BASE, laneTime: 0.24, slideTime: 0.65 },
  bunny: { ...BASE, jumpMul: 1.12, boostMul: 1.08, feverGain: 0.8, coinMul: 0.8 },
  robot: { ...BASE, hearts: 4, feverGain: 0.8, coinMul: 1.5 },
};

/** the character for a skin id (unknown ids play as the balanced hire) */
export function characterFor(id: SkinId): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function statsFor(id: SkinId): CharacterStats {
  const t = TUNING[characterFor(id).id];
  return {
    physics: {
      ...DEFAULT_PHYSICS,
      jumpV: DEFAULT_PHYSICS.jumpV * t.jumpMul,
      boostV: DEFAULT_PHYSICS.boostV * t.boostMul,
      slideTime: t.slideTime,
      // the switch animation scales with the human lane time (judging uses the target lane at once)
      laneSwitchTime: LANE_SWITCH_TIME * (t.laneTime / LANE_STEP),
    },
    laneTime: t.laneTime,
    slideTime: t.slideTime,
    hearts: t.hearts,
    feverGain: t.feverGain,
    coinMul: t.coinMul,
  };
}

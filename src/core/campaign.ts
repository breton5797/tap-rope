/**
 * The 100-stage campaign as a formula (GDD v4 §5, v3 §17). Stage number n = chapter·10 + index + 1.
 * - kind: n % 10 == 5 → bonus, n % 10 == 0 → boss, otherwise normal.
 * - difficulty d(n) = 0.80·(n−1)/99 + 0.20·index/9, then boss +0.08, bonus −0.25,
 *   first-introduction stage −0.04. A chapter's first stage is automatically easier than the
 *   previous boss. The generator's random slack shrinks continuously with tempo; bosses get none.
 * - mapping: bpm = 88 + 62·d (≤ 150); hazards = 14 + 34·d (boss ×1.4 ≤ 60, bonus 12–16);
 *   level weights and mix values grow with d, restricted to the stage's moves.
 * - moves: intro stage = jump + lane + 이단 (once unlocked) + the new move, which gets a focused mix
 *   (high/rear/gate/chaser intros use a 100% share so nothing else shadows it); every other normal stage
 *   and every boss = all unlocked moves; bonus = jump (+ 이단), coin-rich.
 * - v5 lanes (GDD v5 §5, §7): lane-beat share 0.2 + 0.15·d once unlocked (0.5 on the lane / drop /
 *   chaser / lanejump intro stages); part 2 (chapter ≥ 5) adds +0.1 to the chaser and rear shares.
 * - sections (doors): bonus 1, normal 2, boss 3.
 * - pickups: bonus 0.8, boss 0.1, normal 0.3 − 0.15·d.
 */
import type { ChapterMeta, MoveId, StageDef, StageKind, WorldId } from '../types';
import { MOVE_ORDER, movesForMix } from './moves';
import { hashString } from './rng';

export const INTRO_STAGE: Readonly<Record<MoveId, number>> = {
  jump: 1, lane: 2, beam: 3, double: 4, slide: 6, drone: 8, drop: 9, triple: 11, high: 13, rear: 16, chaser: 18,
  gate: 21, pulse: 24, lanejump: 27,
};
/** share given to the newly introduced feature on its intro stage (lane: of hazards; drop / chaser /
 * lanejump: of lane beats) */
const INTRO_FOCUS: Partial<Record<MoveId, number>> = {
  beam: 0.85, slide: 0.35, drone: 0.35, high: 1, rear: 1, gate: 1, pulse: 0.6,
  lane: 0.5, drop: 0.6, chaser: 1, lanejump: 0.6,
};
const LANE_MOVES: readonly MoveId[] = ['lane', 'drop', 'chaser', 'lanejump'];
/** part 2 (the escape) sends more attacks from behind */
const PART2_REAR_BONUS = 0.1;
const SECTIONS: Readonly<Record<StageKind, number>> = { bonus: 1, normal: 2, boss: 3 };

/** 8 normal names (index 0–3, 5–8), then the bonus and boss suffixes, per chapter */
const NAMES: readonly (readonly string[])[] = [
  ['첫 잠입', '경비로봇 피하기', '날아오는 빔', '두 겹 레이저', '서치라이트 피하기', '머리 조심!', '경비견 순찰로', '떨어지는 상자', '비상 보급품', '정문 경비대장'],
  ['하수구 입구', '증기 파이프 길', '물방울 리듬', '녹슨 사다리', '세 겹 레이저', '쥐들의 지름길', '뒤에서 온다!', '수문 개방', '잃어버린 금화', '수로의 감시자'],
  ['하얀 복도', '소독실 통과', '실험체 탈출?', '현미경 아래', '보안 카메라 사각', '피하고 뛰어!', '레이저 미로', '연구원 출입증', '연구 자금', '연구소장의 함정'],
  ['꺼진 불빛', '깜빡이는 서버', '케이블 정글', '등 뒤의 경보', '냉각팬 바람', '해킹 진행 중', '방화벽 돌파', '데이터 센터', '백업 드라이브', '중앙 서버 코어'],
  ['철창 복도', '간수 교대 시간', '감방 열쇠', '레이저 게이트', '탈옥 지도', '펄스 경보', '감시탑 아래', '독방 앞까지', '압수품 창고', '포로 구출 대작전'],
  ['사이렌이 울린다', '포로와 함께', '빨간 경광등', '봉쇄 직전', '숨을 고르며', '추격 드론', '셔터가 닫힌다', '비상계단', '응급 상자', '경비대 총출동'],
  ['비상구를 찾아라', '붉은 실험실', '깨진 유리벽', '탈출 통로', '흩어진 서류', '자동 잠금장치', '경보 해제 실패', '연구동 출구', '비상금 금고', '실험 병기 폭주'],
  ['컨베이어 벨트', '프레스 기계', '용접 불꽃', '부품 창고', '휴식 시간', '로봇 팔 사이로', '고철 더미', '증기 배출', '공구 상자', '공장장의 마지막 라인'],
  ['옥상 문을 열고', '바람 부는 난간', '별빛 아래 질주', '물탱크 위로', '도시 야경', '탐조등 교차', '안테나 숲', '마지막 경비선', '하늘 보급품', '옥상의 저격 드론'],
  ['동이 튼다', '헬리패드로', '프로펠러 바람', '마지막 레이저', '구조 신호', '로프를 잡아라', '헬기 시동', '이륙 직전', '임무 보상', '헬기 대탈출'],
];

type Mix = StageDef['mix'];
type Weights = readonly [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

export function stageNumber(s: Pick<StageDef, 'chapter' | 'index'>): number {
  return s.chapter * 10 + s.index + 1;
}

export function kindFor(n: number): StageKind {
  return n % 10 === 0 ? 'boss' : n % 10 === 5 ? 'bonus' : 'normal';
}

const introMove = (n: number): MoveId | undefined => MOVE_ORDER.find((m) => INTRO_STAGE[m] === n);

function nameFor(n: number): string {
  const names = NAMES[Math.floor((n - 1) / 10)];
  const i = (n - 1) % 10;
  if (i === 4) return `보너스 ${names[8]}`;
  if (i === 9) return `보스 ${names[9]}`;
  return names[i < 4 ? i : i - 1];
}

export function curveD(n: number): number {
  const index = (n - 1) % 10;
  const kind = kindFor(n);
  const base = 0.8 * ((n - 1) / 99) + 0.2 * (index / 9);
  const bump = (kind === 'boss' ? 0.08 : kind === 'bonus' ? -0.25 : 0) + (introMove(n) ? -0.04 : 0);
  return clamp01(base + bump);
}

export function movesFor(n: number, kind: StageKind, intro?: MoveId): MoveId[] {
  const unlocked = MOVE_ORDER.filter((m) => INTRO_STAGE[m] <= n);
  if (kind === 'bonus') return unlocked.filter((m) => m === 'jump' || m === 'double');
  const base = (m: MoveId) => (m === 'double' || m === 'lane') && unlocked.includes(m);
  if (intro) return MOVE_ORDER.filter((m) => m === 'jump' || m === intro || base(m));
  return unlocked;
}

function weightsFor(moves: readonly MoveId[], d: number, kind: StageKind, intro?: MoveId): Weights {
  const w2 = !moves.includes('double') ? 0 : intro === 'double' ? 0.3 : kind === 'bonus' ? 0.15 : 0.2 + 0.25 * d;
  const w3 = !moves.includes('triple') ? 0 : intro === 'triple' ? 0.3 : 0.08 + 0.27 * d;
  return [round2(1 - w2 - w3), round2(w2), round2(w3)];
}

function mixFor(moves: readonly MoveId[], d: number, part2: boolean, intro?: MoveId): Mix {
  const on = (m: MoveId) => moves.includes(m);
  const val = (m: MoveId, normal: number) => (!on(m) ? 0 : round2(intro === m ? (INTRO_FOCUS[m] ?? normal) : normal));
  const slideOn = on('slide') || on('high');
  const droneOn = on('drone') || on('gate');
  const laneIntro = intro !== undefined && LANE_MOVES.includes(intro);
  const rush = part2 ? PART2_REAR_BONUS : 0;
  return {
    beam: on('beam') || on('rear') ? (intro === 'rear' ? 0.5 : val('beam', 0.25 + 0.25 * d)) : 0,
    slide: !slideOn ? 0 : round2(intro === 'slide' || intro === 'high' ? 0.35 : 0.25 + 0.15 * d),
    high: val('high', 0.3 + 0.2 * d),
    rear: val('rear', 0.12 + 0.2 * d + rush),
    drone: !droneOn ? 0 : round2(intro === 'drone' || intro === 'gate' ? 0.35 : 0.08 + 0.12 * d),
    gate: val('gate', 0.3 + 0.3 * d),
    pulse: val('pulse', 0.15 + 0.15 * d),
    lane: !LANE_MOVES.some(on) ? 0 : round2(laneIntro ? (INTRO_FOCUS.lane ?? 0) : (0.2 + 0.15 * d) * (intro ? 0.5 : 1)),
    drop: val('drop', 0.2 + 0.1 * d),
    chaser: val('chaser', 0.15 + 0.1 * d + rush),
    laneCombo: val('lanejump', 0.15 + 0.2 * d),
  };
}

export interface StageShape {
  readonly id: string;
  readonly name: string;
  readonly n: number; // campaign stage number: decides which moves are unlocked
  readonly chapter: number;
  readonly index: number;
  readonly kind: StageKind;
  readonly world: WorldId;
  readonly variant: StageDef['variant'];
  readonly d: number;
  readonly seed: number;
  /** endless: use every move unlocked at n, without the intro-stage focus */
  readonly unlockedOnly?: boolean;
}

function hazardsFor(kind: StageKind, d: number): number {
  const normal = Math.round(14 + 34 * d);
  if (kind === 'boss') return Math.min(60, Math.round(normal * 1.4));
  if (kind === 'bonus') return 12 + Math.round(4 * d);
  return normal;
}

/** Coin-rich bonus, sparse boss; normal stages get fewer pickups as d rises. */
function pickupRateFor(kind: StageKind, d: number): number {
  if (kind === 'bonus') return 0.8;
  if (kind === 'boss') return 0.1;
  return round2(0.3 - 0.15 * d);
}

/** Turns a stage's place on the curve into a full StageDef. */
export function designStage(s: StageShape): StageDef {
  const intro = s.kind === 'normal' && !s.unlockedOnly ? introMove(s.n) : undefined;
  const chosen = movesFor(s.n, s.kind, intro);
  const levelWeights = weightsFor(chosen, s.d, s.kind, intro);
  const mix = mixFor(chosen, s.d, s.chapter >= 5, intro);
  return {
    id: s.id, world: s.world, chapter: s.chapter, variant: s.variant, kind: s.kind, index: s.index, name: s.name,
    moves: movesForMix(levelWeights, mix),
    bpm: Math.min(150, Math.round(88 + 62 * s.d)),
    hazardBeats: hazardsFor(s.kind, s.d),
    seed: s.seed,
    levelWeights,
    mix,
    sections: SECTIONS[s.kind],
    pickupRate: pickupRateFor(s.kind, s.d),
  };
}

export function buildCampaign(chapters: readonly ChapterMeta[]): StageDef[] {
  return Array.from({ length: chapters.length * 10 }, (_, i) => {
    const n = i + 1;
    const chapter = chapters[Math.floor(i / 10)];
    const id = `w${chapter.id + 1}-s${(i % 10) + 1}`;
    return designStage({
      id, name: nameFor(n), n, chapter: chapter.id, index: i % 10, kind: kindFor(n),
      world: chapter.theme, variant: chapter.variant, d: curveD(n), seed: hashString(`laserescape:${id}`),
    });
  });
}

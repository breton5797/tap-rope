/**
 * The 100-stage campaign as a formula (GDD v3 §15–§17). Stage number n = chapter·10 + index + 1.
 * - kind: n % 10 == 5 → bonus, n % 10 == 0 → boss, otherwise normal.
 * - rope mode: hand-made rows for chapters 1–3 (they carry the §16 intro schedule),
 *   then two mirrored rows alternate; no row/boundary ever has 3 stages of one mode in a row.
 * - difficulty d(n) = 0.80·(n−1)/99 + 0.20·index/9, then boss +0.08, bonus −0.25,
 *   first-introduction stage −0.04, moon chapters +MOON_BUMP (low gravity spreads beats out).
 *   The generator's random slack shrinks continuously with tempo; bosses run with none.
 *   A chapter's first stage is automatically easier than the previous boss.
 * - mapping: bpm = 88 + 62·d (≤ 150); hazards = 14 + 34·d (boss ×1.4 ≤ 60, bonus 12–16);
 *   level weights and mix values grow with d, restricted to the stage's moves.
 * - moves: intro stage = jump + 이단 (once unlocked) + the new move; every other normal stage and
 *   every boss = all unlocked moves its rope allows (variety comes from the rope-mode rotation;
 *   seeded subsets made neighbouring stages swing too much in difficulty); bonus = jump (+ double).
 * - pickups: bonus 0.8 (coin-rich), boss 0.1, normal 0.3 − 0.15·d.
 */
import type { ChapterMeta, MoveId, RopeMode, StageDef, StageKind, WorldId } from '../types';
import { MOVE_ORDER, movesForMix } from './moves';
import { hashString } from './rng';

export const INTRO_STAGE: Readonly<Record<MoveId, number>> = {
  jump: 1, double: 4, side: 6, bird: 8, tumble: 11, cross: 13, triple: 16, back: 21, dd: 24,
};
const HURDLE_INTRO = 2;
const COMBO_FROM = 9;
const MOON_BUMP = 0.06;
const LONG_ONLY: readonly MoveId[] = ['tumble', 'dd'];
const SOLO_ONLY: readonly MoveId[] = ['cross', 'back'];
const INTRO_FOCUS: Partial<Record<MoveId, number>> = {
  bird: 0.35, dd: 0.5, side: 0.4, tumble: 0.35, cross: 0.5, back: 0.6,
};

const MODE_ROWS: readonly string[] = ['LLSSLLSLSL', 'LSSLSLSLSL', 'SLSLSLLSLS'];
const MODE_A = 'LSLSLLSLSL';
const MODE_B = 'SLSLSSLSLS';

/** 8 normal names (index 0–3, 5–8), then the bonus and boss suffixes, per chapter */
const NAMES: readonly (readonly string[])[] = [
  ['첫 점프', '폴짝 허들', '혼자 콩콩', '혼자서 이단뛰기', '데굴데굴 공 피하기', '미끄럼틀 리듬', '참새가 날아와요', '그네 옆 박자', '사탕 비', '놀이터 대장'],
  ['무지개 덤블링', '모래성 콩콩', '엇걸어 콩콩', '갈매기 피하기', '세 번 콩콩콩', '파도 타기', '소라 껍데기 길', '노을 산책', '조개 줍기', '노을의 파도왕'],
  ['거꾸로 빙글', '네온 산책', '뒤로 엇걸어', '네온 더블더치', '전광판 계단', '빌딩 숲 리듬', '야경 질주', '신호등 박자', '네온 코인', '네온 마스터'],
  ['둥실 첫걸음', '분화구 점프', '운석 소나기', '달토끼 콩콩', '무중력 계단', '우주 정거장', '달빛 산책', '지구돋이', '별가루', '달의 챔피언'],
  ['별빛 점프', '가로등 리듬', '반딧불 콩콩', '한밤의 허들', '부엉이 조심', '달그림자 점프', '꿈나라 계단', '은하수 건너기', '별사탕', '한밤의 대장'],
  ['낙엽 밟기', '도토리 데굴', '단풍 콩콩', '가을바람 콩콩', '허수아비 넘기', '코스모스 리듬', '은행잎 소나기', '다람쥐 질주', '군밤 줍기', '가을 축제'],
  ['달빛 파도', '등대 불빛', '밤갈매기', '반짝 물결', '해파리 둥실', '밤배 리듬', '고래 노래', '파도 거품', '진주 줍기', '밤바다의 왕'],
  ['빗방울 점프', '우산 돌리기', '물웅덩이 콩콩', '젖은 네온', '번개 계단', '빗줄기 리듬', '네온 우산길', '폭우 질주', '빗속 코인', '폭풍의 네온'],
  ['붉은 달', '코로나 점프', '그림자 계단', '일식 산책', '붉은 운석', '어둠 속 점프', '개기일식', '다시 뜨는 해', '금빛 별', '일식의 지배자'],
  ['무지개 첫걸음', '일곱 빛깔 리듬', '구름 위 콩콩', '무지개 다리', '파스텔 계단', '반짝 별길', '하늘 끝 질주', '마지막 리허설', '무지개 보물', '무지개 피날레'],
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

export function ropeModeFor(n: number): RopeMode {
  const c = Math.floor((n - 1) / 10);
  const row = c < MODE_ROWS.length ? MODE_ROWS[c] : c % 2 === 1 ? MODE_A : MODE_B;
  return row[(n - 1) % 10] === 'L' ? 'long' : 'solo';
}

const introMove = (n: number): MoveId | undefined => MOVE_ORDER.find((m) => INTRO_STAGE[m] === n);
const fitsMode = (m: MoveId, mode: RopeMode) => !(mode === 'solo' ? LONG_ONLY : SOLO_ONLY).includes(m);

function nameFor(n: number): string {
  const c = Math.floor((n - 1) / 10);
  const i = (n - 1) % 10;
  const names = NAMES[c];
  if (i === 4) return `보너스 ${names[8]}`;
  if (i === 9) return `보스 ${names[9]}`;
  return names[i < 4 ? i : i - 1];
}

export function curveD(n: number, moon: boolean): number {
  const index = (n - 1) % 10;
  const kind = kindFor(n);
  const base = 0.8 * ((n - 1) / 99) + 0.2 * (index / 9);
  const bump = (kind === 'boss' ? 0.08 : kind === 'bonus' ? -0.25 : 0)
    + (introMove(n) ? -0.04 : 0) + (moon ? MOON_BUMP : 0);
  return clamp01(base + bump);
}

export function movesFor(n: number, mode: RopeMode, kind: StageKind): MoveId[] {
  const unlocked = MOVE_ORDER.filter((m) => INTRO_STAGE[m] <= n && fitsMode(m, mode));
  const intro = introMove(n);
  if (kind === 'bonus') return unlocked.filter((m) => m === 'jump' || m === 'double');
  if (intro) return MOVE_ORDER.filter((m) => m === 'jump' || m === intro || (m === 'double' && unlocked.includes(m)));
  return unlocked;
}

function weightsFor(moves: readonly MoveId[], d: number, kind: StageKind, intro?: MoveId): Weights {
  const w2 = !moves.includes('double') ? 0 : intro === 'double' ? 0.35 : kind === 'bonus' ? 0.15 : 0.2 + 0.25 * d;
  const w3 = !moves.includes('triple') ? 0 : intro === 'triple' ? 0.4 : 0.08 + 0.27 * d;
  return [round2(1 - w2 - w3), round2(w2), round2(w3)];
}

function mixFor(moves: readonly MoveId[], mode: RopeMode, n: number, d: number, intro?: MoveId): Mix {
  const kind = kindFor(n);
  const feature = (m: MoveId, normal: number) =>
    !moves.includes(m) ? 0 : round2(intro === m ? (INTRO_FOCUS[m] ?? normal) : normal);
  const busy = kind !== 'bonus' && !intro;
  return {
    hurdle: mode === 'long' && n >= HURDLE_INTRO && kind !== 'bonus' ? round2(n === HURDLE_INTRO ? 0.4 : 0.1 + 0.15 * d) : 0,
    bird: feature('bird', 0.1 + 0.15 * d),
    combo: busy && n >= COMBO_FROM ? round2(0.05 + 0.45 * d) : 0,
    doubleDutch: feature('dd', 0.25 + 0.25 * d),
    ball: feature('side', 0.15 + 0.15 * d),
    ring: feature('tumble', 0.12 + 0.15 * d),
    cross: feature('cross', 0.25 + 0.3 * d),
    back: feature('back', 0.3 + 0.3 * d),
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
  readonly ropeMode: RopeMode;
  readonly d: number;
  readonly seed: number;
}

function hazardsFor(kind: StageKind, d: number): number {
  const normal = Math.round(14 + 34 * d);
  if (kind === 'boss') return Math.min(60, Math.round(normal * 1.4));
  if (kind === 'bonus') return 12 + Math.round(4 * d);
  return normal;
}

/** Coin-rich bonus, sparse boss; normal stages get fewer pickups (more breathing room lost) as d rises. */
function pickupRateFor(kind: StageKind, d: number): number {
  if (kind === 'bonus') return 0.8;
  if (kind === 'boss') return 0.1;
  return round2(0.3 - 0.15 * d);
}

/** Turns a stage's place on the curve into a full StageDef. */
export function designStage(s: StageShape): StageDef {
  const intro = s.kind === 'normal' ? introMove(s.n) : undefined;
  const chosen = movesFor(s.n, s.ropeMode, s.kind);
  const levelWeights = weightsFor(chosen, s.d, s.kind, intro);
  const mix = mixFor(chosen, s.ropeMode, s.n, s.d, intro);
  return {
    id: s.id, world: s.world, chapter: s.chapter, variant: s.variant, kind: s.kind, index: s.index,
    name: s.name, ropeMode: s.ropeMode,
    moves: movesForMix(s.ropeMode, levelWeights, mix),
    bpm: Math.min(150, Math.round(88 + 62 * s.d)),
    hazardBeats: hazardsFor(s.kind, s.d),
    seed: s.seed,
    levelWeights,
    mix,
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
      world: chapter.theme, variant: chapter.variant, ropeMode: ropeModeFor(n),
      d: curveD(n, chapter.theme === 3), seed: hashString(`taprope:${id}`),
    });
  });
}

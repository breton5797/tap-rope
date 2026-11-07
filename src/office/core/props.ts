/**
 * Office attack props (office spec §5, §6; part 2 spec §1): what each superior throws for each attack kind,
 * the callout it shouts, the sprite it is drawn with, and the fail tip built from it. Re-exported by events.ts.
 * - A prop id is either a sprite (OFFICE_PROPS: public-office/art/prop-<id>.webp) or a callout-only alias drawn
 *   with a part-1 sprite (PROP_ALIASES), so a superior can shout its own attack with shared art.
 * - PART2_PROPS are new sprites for the part-2 superiors; until a file lands the renderer draws
 *   PROP_FALLBACK's part-1 sprite (propSprite returns both).
 * - ATTACK_PROPS is keyed by v8 slot; STAGE_PROPS by "<stage>:<slot>" for the part-2 rematches (박과장 on 7,
 *   윤이사 on 9, 최팀장 / 한전무 on 10), which otherwise would throw their part-1 props. Each row aims for one
 *   distinct prop per attack kind so every move reads as its own shape.
 */
import type { BossAttackKind, BossId, MoveId } from '../../types';
import { superiorAt } from './boss';

export const PART1_PROPS = [
  'postit', 'papers', 'coffee-tray', 'paper-plane', 'clipboard', 'paper-jam', 'door', 'whiteboard', 'pointer', 'golf',
  'latte-bubble', 'elevator', 'doc-tornado', 'necktie', 'corp-card', 'ceo-screen', 'revolving-door', 'envelope', 'cart', 'robot',
] as const;

/** part-2 sprites (ART): 강차장, 문상무, 회장님 and the commute rematches */
export const PART2_PROPS = [
  'sign-stand', 'survey', 'magnifier', 'receipts', 'receipt', 'cane', 'rice-cake', 'gold-badge', 'megaphone',
  'taxi', 'laptop', 'mic-stand', 'skewer', 'video-call', 'smartphone',
  // playtest round 2: own shapes for 문상무's 계산기, 윤이사's 탬버린 and 최팀장's "진짜 5분" bubble
  'calculator', 'tambourine', 'call-bubble',
  // quality round 4: the former callout-only aliases get their own shapes
  'survey-box', 'sign-board', 'pen', 'audit-board', 'taxi-receipt', 'excel-sheet', 'skewer-tray', 'mic', 'home-clipboard',
] as const;

/** every prop sprite (public-office/art/prop-<id>.webp) */
export const OFFICE_PROPS = [...PART1_PROPS, ...PART2_PROPS] as const;
export type OfficePropId = (typeof OFFICE_PROPS)[number];
type Part1Prop = (typeof PART1_PROPS)[number];
type Part2Prop = (typeof PART2_PROPS)[number];

/** callout-only props: their own name, a part-1 sprite (none left since round 4; kept for the lookup) */
export const PROP_ALIASES = {} as const satisfies Readonly<Record<string, Part1Prop>>;
export type AttackPropId = OfficePropId | keyof typeof PROP_ALIASES;

/** the part-1 sprite drawn for a part-2 sprite that has not landed yet (same attack footprint) */
export const PROP_FALLBACK: Readonly<Record<Part2Prop, Part1Prop>> = {
  'sign-stand': 'whiteboard', survey: 'paper-plane', magnifier: 'door', receipts: 'papers', receipt: 'paper-plane',
  cane: 'revolving-door', 'rice-cake': 'envelope', 'gold-badge': 'envelope', megaphone: 'ceo-screen',
  taxi: 'cart', laptop: 'papers', 'mic-stand': 'corp-card', skewer: 'necktie', 'video-call': 'ceo-screen', smartphone: 'pointer',
  calculator: 'corp-card', tambourine: 'necktie', 'call-bubble': 'latte-bubble',
  'survey-box': 'papers', 'sign-board': 'clipboard', pen: 'pointer', 'audit-board': 'clipboard', 'taxi-receipt': 'paper-plane',
  'excel-sheet': 'paper-jam', 'skewer-tray': 'coffee-tray', mic: 'pointer', 'home-clipboard': 'clipboard',
};

/** what the superior shouts as the prop flies (the attack callout) */
export const PROP_CALLOUTS: Readonly<Record<string, string>> = {
  postit: '포스트잇 폭풍!', papers: '서류 더미!', 'coffee-tray': '커피 쟁반!', 'paper-plane': '종이비행기!',
  clipboard: '결재판 부메랑!', 'paper-jam': '용지 걸림!', door: '회의실 문 벌컥!', whiteboard: '화이트보드 돌진!',
  pointer: '레이저 포인터!', golf: '나이스 샷!', 'latte-bubble': '라떼는 말이야!', elevator: '엘리베이터 띵!',
  'doc-tornado': '서류 회오리!', necktie: '넥타이 채찍!', 'corp-card': '법인카드!', 'ceo-screen': '화상회의!',
  'revolving-door': '회전문 가속!', envelope: '금일봉 비!', cart: '카트 질주!', robot: '청소 로봇!',
  // 강차장 (인사팀 설문)
  'sign-stand': '서명 부스!', survey: '설문지 폭탄!', 'survey-box': '설문 응모함!', 'sign-board': '서명판 휘두르기!', pen: '볼펜 휙!',
  // 문상무 (감사팀)
  magnifier: '돋보기 "이건 뭐지?!"', receipts: '영수증 뭉치!', receipt: '영수증 날리기!', 'audit-board': '감사 서류판!', calculator: '계산기 탁탁!',
  // 회장님
  cane: '지팡이 휘두르기!', 'rice-cake': '창립기념 떡!', 'gold-badge': '금배지 휙!', megaphone: '훈화 말씀!',
  // rematches: 박과장 (택시), 윤이사 (먹자골목 2차), 최팀장 (영상통화), 한전무 (집 앞 결재)
  taxi: '택시 합승!', laptop: '노트북 펼치기!', 'taxi-receipt': '택시 영수증!', 'excel-sheet': '최종_v4 엑셀!',
  'mic-stand': '노래방 마이크!', skewer: '꼬치 세례!', 'skewer-tray': '꼬치 접시!', tambourine: '탬버린!', mic: '마이크 휙!',
  'video-call': '영상통화 5분만!', smartphone: '스마트폰 휙!', 'call-bubble': '"진짜 5분!"', 'home-clipboard': '집 앞 결재판!',
};

type KindProps = Readonly<Record<BossAttackKind, readonly AttackPropId[]>>;

/** BossAttackKind: lane = guard/drop/chaser, beam = beam or high (jump or slide), ceiling = slide, floor = jump, drone = stay low */
const GENERIC: KindProps = { lane: ['cart'], floor: ['papers'], beam: ['clipboard'], ceiling: ['pointer'], drone: ['paper-plane'] };

/** spec §5 per superior (v8 slot) and attack kind */
export const ATTACK_PROPS: Readonly<Partial<Record<BossId, KindProps>>> = {
  warden: { lane: ['postit'], floor: ['papers'], beam: ['papers', 'coffee-tray'], ceiling: ['coffee-tray'], drone: ['postit', 'paper-plane'] },
  'sewer-eye': { lane: ['paper-jam'], floor: ['papers', 'clipboard'], beam: ['clipboard', 'paper-plane'], ceiling: ['paper-plane'], drone: ['paper-plane'] },
  'lab-ai': { lane: ['door'], floor: ['whiteboard'], beam: ['whiteboard', 'pointer'], ceiling: ['pointer'], drone: ['pointer'] },
  core: { lane: ['elevator'], floor: ['golf'], beam: ['golf', 'latte-bubble'], ceiling: ['latte-bubble'], drone: ['latte-bubble', 'golf'] },
  jailer: { lane: ['doc-tornado'], floor: ['papers', 'doc-tornado'], beam: ['doc-tornado', 'clipboard'], ceiling: ['doc-tornado'], drone: ['doc-tornado'] },
  apc: { lane: ['corp-card'], floor: ['necktie'], beam: ['necktie', 'corp-card'], ceiling: ['necktie'], drone: ['corp-card', 'necktie'] },
  chimera: { lane: ['revolving-door'], floor: ['envelope'], beam: ['envelope', 'ceo-screen'], ceiling: ['ceo-screen'], drone: ['envelope'] },
  crane: { lane: ['sign-stand'], floor: ['survey-box'], beam: ['survey'], ceiling: ['sign-board'], drone: ['pen'] },
  sniper: { lane: ['magnifier'], floor: ['receipts'], beam: ['receipt'], ceiling: ['audit-board'], drone: ['calculator'] },
  gunship: { lane: ['cane'], floor: ['rice-cake'], beam: ['gold-badge'], ceiling: ['megaphone'], drone: ['envelope'] },
};

/** part-2 rematches, "<stage>:<slot>" (1-based stage) */
export const STAGE_PROPS: Readonly<Record<string, KindProps>> = {
  '7:sewer-eye': { lane: ['taxi'], floor: ['laptop'], beam: ['taxi-receipt'], ceiling: ['excel-sheet'], drone: ['paper-plane'] },
  '9:apc': { lane: ['mic-stand'], floor: ['skewer-tray'], beam: ['skewer'], ceiling: ['tambourine'], drone: ['mic'] },
  '10:lab-ai': { lane: ['video-call'], floor: ['laptop'], beam: ['smartphone'], ceiling: ['call-bubble'], drone: ['pointer'] },
  '10:jailer': { lane: ['doc-tornado'], floor: ['papers'], beam: ['home-clipboard'], ceiling: ['doc-tornado'], drone: ['clipboard'] },
};

/** the props a superior uses for `kind` on stage `stage` (1-based; omitted = its part-1 table) */
export function propsFor(slot: BossId, kind: BossAttackKind, stage?: number): readonly AttackPropId[] {
  const rematch = stage === undefined ? undefined : STAGE_PROPS[`${stage}:${slot}`];
  return rematch?.[kind] ?? ATTACK_PROPS[slot]?.[kind] ?? GENERIC[kind];
}

const isPart2 = (id: string): id is Part2Prop => (PART2_PROPS as readonly string[]).includes(id);

/** the sprite a prop id is drawn with, and the part-1 sprite to draw while a part-2 one is missing */
export function propSprite(id: string): { readonly sprite: OfficePropId; readonly fallback: OfficePropId | null } {
  const alias = (PROP_ALIASES as Readonly<Record<string, Part1Prop>>)[id];
  if (alias) return { sprite: alias, fallback: null };
  if (isPart2(id)) return { sprite: id, fallback: PROP_FALLBACK[id] };
  return (OFFICE_PROPS as readonly string[]).includes(id) ? { sprite: id as OfficePropId, fallback: null } : { sprite: 'papers', fallback: null };
}

/** the attack kind a move is delivered as (boss.ts attackKind) */
const MOVE_KIND: Readonly<Record<MoveId, BossAttackKind>> = {
  jump: 'floor', pulse: 'floor', beam: 'beam', double: 'beam', triple: 'beam', rear: 'beam', high: 'beam', slide: 'ceiling',
  drone: 'drone', gate: 'drone', lane: 'lane', drop: 'lane', chaser: 'lane', lanejump: 'lane',
};

/** what to do about a move, in plain kid-friendly words (the half after the arrow of a fail tip) */
const MOVE_ACTION: Readonly<Record<MoveId, string>> = {
  jump: '발 앞에 오기 직전 탭',
  beam: '개수만큼 탭',
  double: '점프 꼭대기에서 한 번 더 탭',
  triple: '박자에 맞춰 탭 세 번',
  slide: '오른쪽을 아래로 밀어 숙이기',
  high: '점프 말고 숙이기',
  drone: '2단 점프 금지, 탭 한 번만',
  gate: '1단 점프만 (탭 한 번)',
  rear: '뒤 경고 표식을 보고 박자에 탭',
  pulse: '박자마다 짧게 연속 탭',
  lane: '왼쪽 위·아래로 밀어 옆으로 비키기',
  drop: '경고등 자리에서 미리 옆으로 비키기',
  chaser: '표식 자리에서 옆으로 비키기',
  lanejump: '옆으로 먼저 비키고 바로 탭',
};

/** "<the stage superior's prop> → <what to do>" for the move that cost the heart (1-based stage, section 0..2) */
export function failTipFor(stage: number, move: MoveId, section = 0): string {
  const boss = superiorAt(stage, section);
  const prop = boss ? propsFor(boss.slot, MOVE_KIND[move], stage)[0] : GENERIC[MOVE_KIND[move]][0];
  const label = (PROP_CALLOUTS[prop] ?? '').replace(/["!]/g, '').trim();
  return `${label} → ${MOVE_ACTION[move]}`;
}

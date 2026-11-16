// Office live events: the UI copy (Korean). Office-only screens render it, so it lives here instead of COPY
// (v8 never shows any of it). `{x}` placeholders are filled with fillLive.

export const LIVE_COPY = {
  dailyButton: '오늘의 미션',
  dailyBoss: '오늘의 상사: {boss}',
  dailyDone: '완료 ✓ · 다시 하기 자유',
  dailyLocked: '1단계를 깨면 열려요',
  newBadge: 'NEW',
  cardChip: '출근 카드 {n}/7',
  goalHead: '이번 주 · {theme}',
  goalDone: '달성!',
  mallButton: '사원 복지몰',
  mallNew: '새 꾸미기 {n}',
  newDay: '새 날이에요! 오늘의 미션이 바뀌었어요',

  cardTitle: '주간 출근 카드',
  cardHint: '오늘의 미션을 깬 날마다 도장 하나. 빠진 날이 있어도 잃는 건 없어요.',
  cardWeek: '{from} ~ {to}',
  milestone: '도장 {n}개',
  milestoneDone: '받음',
  rewardPoints: '₵{n}',
  rewardBadge: '개근 배지',
  historyTitle: '출근 기록부',
  historyRow: '{from} 주',
  historyStamps: '도장 {n}개',
  historyEmpty: '지난 주 기록이 여기에 쌓여요.',
  playDaily: '오늘의 미션 하러 가기',

  mallTitle: '사원 복지몰',
  mallHint: '칼퇴 포인트로 정해진 가격에 바꿔요. 확률은 없어요. 꾸미기는 실력에 영향이 없어요.',
  mallCollection: '도감 {n}/{total}',
  buy: '{price}',
  buyAria: '{name} 칼퇴 포인트 {price}로 교환',
  equip: '장착',
  unequip: '해제',
  equipped: '장착 중',
  poor: '포인트가 모자라요',
  notYet: '{theme} 이벤트 상품 · 다음 주부터 살 수 있어요',
  exchange: '교환하기 (₵{price})',
  bought: '{name} 교환 완료!',
  saveFailed: '저장할 수 없어요. 저장 공간을 확인해 주세요.',
  themeItem: '테마',

  resultDaily: '오늘의 미션 완료!',
  resultStamp: '출근 도장 쾅!',
  resultCosmetic: '새 꾸미기: {name}',
  resultBadge: '개근 배지!',
  resultGoal: '주간 목표 달성!',
  resultGoalGain: '주간 목표 · {label} +{gain} {where}',
  resultNoReward: '자동 플레이 · 보상 없음',
} as const;

export const WEEKDAYS: readonly string[] = ['월', '화', '수', '목', '금', '토', '일'];

export const CATEGORY_NAMES = {
  trail: '발자국',
  jump: '점프 효과',
  stamp: '결과 도장',
  cardTheme: '출근 카드',
} as const;

export function fillLive(text: string, vars: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** "2026-11-16" → "11.16" */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}.${Number(d)}`;
}

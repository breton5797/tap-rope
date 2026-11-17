/** player-facing words for the rewarded bonus and the 칼퇴 패스 (family tone: no urgency, no loss framing — P4) */
export const MON_COPY = {
  adStage: '광고 보고 +₵{points} 더 받기',
  adDaily: '광고 보고 미션 포인트 +₵{points} 한 번 더',
  passStage: '칼퇴 패스 보너스 +₵{points} 받기',
  passDaily: '칼퇴 패스 보너스 +₵{points} 한 번 더',
  todayCount: '오늘 {used}/{limit}',
  loading: '광고 불러오는 중…',
  granted: '보너스 +₵{points} 받았어요!',
  skipped: '광고를 끝까지 보면 보너스를 받아요',
  unavailable: '지금은 볼 수 있는 광고가 없어요. 보너스 없이도 그대로 진행돼요',
  limit: '오늘 받을 수 있는 광고 보너스를 모두 받았어요',
  saveFailed: '저장하지 못했어요. 저장 공간을 확인해 주세요',
  passTitle: '칼퇴 패스',
  passBody: '한 번 구매하면 계속 쓸 수 있어요.',
  passTerms: '1회 구매 · 구매 즉시 적용되는 디지털 상품이라 혜택을 쓴 뒤에는 청약철회가 제한될 수 있어요. 미성년자는 보호자 동의 없이 한 구매를 취소할 수 있어요. 결제·환불은 스토어 절차를 따라요.',
  passPerks: ['광고 없이 결과 화면 보너스를 바로 받아요 (받는 양과 횟수는 같아요)', '패스 전용 「칼퇴 패스 도장」'],
  passBuy: '{price} 구매',
  passStoreOffline: '지금은 스토어에 연결할 수 없어요. 잠시 후 다시 열어 주세요',
  passOwned: '사용 중',
  passRestore: '구매 복원',
  passBought: '칼퇴 패스를 사용할 수 있어요. 고마워요!',
  passPending: '결제가 확인되면 칼퇴 패스가 켜져요',
  passCancelled: '구매를 취소했어요',
  passFailed: '구매하지 못했어요. 잠시 후 다시 시도해 주세요',
  passRestored: '칼퇴 패스를 복원했어요',
  passNotFound: '이 계정에서 칼퇴 패스 구매 기록을 찾지 못했어요',
  privacy: '광고 개인정보 설정',
} as const;

export function fillMon(s: string, vars: Readonly<Record<string, string | number>>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

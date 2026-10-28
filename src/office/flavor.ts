/**
 * Office build flavour (칼퇴근 대작전), swapped in for src/flavor.ts by build/office-swaps.ts: offline, its own
 * save prefix (never mixes with v8 saves on the same origin), a character pick on a fresh save, and a fresh
 * seed per run, and the comic office copy (spec §4, §7).
 * Imports of '../flavor' from here reach the real v8 module (the swap skips its own replacement).
 */
import type { StageDef } from '../types';
import { V8_COPY, fillCopy, stageVars, type CopyKey, type Features } from '../flavor';

export { V8_COPY, fillCopy, stageVars, type CopyKey, type Features };

export const FEATURES: Features = {
  online: false, endless: false, daily: false, shop: false, leaderboard: false, transfer: false, firstRunPick: true,
};

export const SAVE_PREFIX = 'officeescape';

/** comic office voice (spec §4, §7): no spy words; `{zone}` is the next stage number */
export const COPY: Readonly<Record<CopyKey, string>> = {
  // title
  titleLogoAria: '칼퇴근 대작전 CLOCK OUT',
  titleLogoCode: '야근상사 12F · 17:30',
  // big Korean headline, CLOCK OUT as the small sub-line
  titleLogoWord1: '칼퇴근',
  titleLogoWord2: '대작전',
  titleLogoKo: 'CLOCK OUT',
  titleGuide: '퇴근 요령',
  titleStart: '퇴근 시작!',
  titleShop: '사원 선택',
  // loading
  loadKicker: 'CLOCK-IN · 야근상사',
  loadLogo: 'CLOCK OUT',
  loadSub: '칼퇴근 대작전',
  loadStep0: '출입증 찍는 중',
  loadStep1: '층별 안내도 펼치는 중',
  loadStep2: '가방 몰래 싸는 중',
  loadStep3: '퇴근 준비 완료',
  // briefing
  briefPhotoTag: '{zone}',
  briefStamp: '정시 퇴근',
  briefKicker: '퇴근 브리핑',
  briefPart1: '퇴근 30분 전',
  briefPart2: '마지막 관문',
  briefFrom: '퇴근 시계 {sub}',
  // HUD + pickups
  hudArmor: '체력',
  hudFever: '칼퇴 모드',
  hudShield: '노캔',
  hudSlow: '각성',
  pickupShield: '노캔 이어폰 · 못 들은 척 1회',
  pickupSlow: '아이스 아메리카노 · 각성!',
  pickupHeart: '삼각김밥 · 체력 +1',
  // overlays: pause + first-run tutorial cards (김대리 explains, deadpan)
  pauseKicker: 'COFFEE BREAK',
  pauseTitle: '잠깐 숨 고르기',
  pauseText: '상사 시선 피하는 중. 준비되면 다시 달린다.',
  pauseResume: '다시 달리기',
  pauseQuit: '자리로 복귀',
  pauseRetry: '처음부터 다시',
  tutJumpKicker: '김대리: 서류 더미 조심~',
  tutJumpHint: '점프는 오른쪽 화면 탭!',
  tutSlideKicker: '김대리: 커피 쟁반 날아간다~',
  tutSlideHint: '숙이기는 오른쪽을 아래로 쓱!',
  tutLaneKicker: '김대리: 어디 가?',
  tutLaneHint: '피하기는 왼쪽을 위아래로 쓱!',
  // result
  resultKicker: '퇴근 보고서 · 야근상사',
  resultAria: '퇴근 보고서',
  resultWinStatus: '퇴근 성공!',
  resultWinTitle: '오늘도 칼퇴 각!',
  // the fail headline is a big red rubber stamp (office.css)
  resultFailStatus: '야근 확정',
  resultFailTitle: '상사한테 딱 걸렸다…',
  // shown after stage 5 (w5-s10): the ending
  resultStoryRescue: '칼퇴 성공! 18:00:00 — 타임카드 쾅!',
  resultStoryEnd: '칼퇴 성공! 18:00:00 — 타임카드 쾅!',
  resultStoryNext: '한 층 내려왔다! {n}단계 개방',
  resultNext: '다음 층으로',
  resultRetry: '내일은 꼭…!',
  resultReplay: '한 번 더!',
  resultMap: '층별 안내도',
  resultDetails: '퇴근 기록 상세',
  resultScore: '점수',
  resultRank: '직급 평가',
  resultNewRecord: '최고 기록!',
  resultEarlier: '이전 퇴근 기록으로 받은 보상',
  cutSkip: '건너뛰기 ▸▸',
  // character room + first-run picker
  shopKicker: '오늘의 칼퇴 사원',
  shopSelect: '선택',
  shopSelected: '근무 중',
  pickKicker: '입사 3개월 차',
  pickTitle: '오늘 칼퇴할 사원은?',
  pickHint: '나중에 사원 선택에서 언제든 바꿀 수 있어요.',
  // stage select, guide, archive, settings, share card, result rewards
  stageAriaPrefix: '퇴근길',
  stagesLocked: '윗층 상사를 따돌리면 열림',
  guideKicker: '신입 사원 매뉴얼',
  guideLead: '왼손: 레인 이동. 오른손: 점프·숙이기. 칼퇴 기술 {n}가지.',
  guideStagePrefix: '단계',
  archiveLead: '본 장면만 다시 볼 수 있어요. 나머지는 퇴근길에 하나씩 열려요.',
  settingsMusicDesc: '퇴근 박자에 맞춘 경쾌한 사무실 펑크',
  creditsLogo: 'CLOCK OUT · 칼퇴근 대작전',
  creditsLine: '야근상사는 가상의 회사입니다. 소리는 전부 절차 합성, 그림은 생성 이미지 기반.',
  creditsSmall: '오늘도 수고하셨습니다. 내일 출근 09:00.',
  shareName: '칼퇴근 대작전',
  shareCardKicker: 'CLOCK OUT · 퇴근 보고서',
  resultBossBanner: '상사 따돌림!',
  resultBossCode: '“{code}”',
  rewardBossClear: '상사 따돌림',
  rewardFirst: '첫 칼퇴 보너스',
  // labels: one stage per floor, so a stage is just "N단계"
  stageTag: '{chapter}단계',
  stageNum: '{chapter}',
  nodeBoss: '상사',
  nodeBonus: '간식',
  zoneTag: '{n}단계',
  bossPhase: '{n}차 공격 · {n}/3',
  bossPhaseAria: '{n}차 공격',
};

/** a fresh uniform uint32 for every run start (P3: chosen once, kept on the run, never steered by input) */
export function runSeedFor(_stage: StageDef): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

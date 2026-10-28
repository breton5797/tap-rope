/**
 * Build flavour seams (office spec §10): the few things a re-skinned build changes without touching v8
 * code paths — player-facing copy on the title / briefing / HUD / overlays / loading / result screens, which
 * features are offered, the localStorage key prefix and the per-run seed. This file is the v8 flavour;
 * the office build swaps in src/office/flavor.ts (build/office-swaps.ts), which keeps the same exports.
 */
import type { StageDef } from './types';

export interface Features {
  /** server runs / device identity (also needs VITE_SUPABASE_URL) */
  readonly online: boolean;
  readonly endless: boolean;
  readonly daily: boolean;
  /** buying operators and cosmetics in the loadout room (the room itself stays for choosing a skin) */
  readonly shop: boolean;
  /** rankings and the call-sign card that comes with them */
  readonly leaderboard: boolean;
  /** device transfer in settings */
  readonly transfer: boolean;
  /** a character picker before the first cutscene of a fresh save */
  readonly firstRunPick: boolean;
}

export const FEATURES: Features = {
  online: true, endless: true, daily: true, shop: true, leaderboard: true, transfer: true, firstRunPick: false,
};

/** save / device / queue keys are `${SAVE_PREFIX}.…` */
export const SAVE_PREFIX = 'laserescape';

/** v8 copy, exactly as the screens used to inline it. `{zone}` is filled by the caller. */
export const V8_COPY = {
  // title
  titleLogoAria: 'LASER ESCAPE 레이저 탈출작전',
  titleLogoCode: 'OP. LE-06 // CLASSIFIED',
  titleLogoWord1: 'LASER',
  titleLogoWord2: 'ESCAPE',
  titleLogoKo: '레이저 탈출작전',
  titleGuide: '작전 교범',
  titleStart: '작전 개시',
  titleShop: '장비실',
  // loading
  loadKicker: 'SYSTEM BOOT // LE-06',
  loadLogo: 'LASER ESCAPE',
  loadSub: '레이저 탈출작전',
  loadStep0: '보안망 접속 중',
  loadStep1: '시설 도면 수신 중',
  loadStep2: '장비 점검 중',
  loadStep3: '접속 완료',
  // briefing
  briefTag: 'SURVEILLANCE',
  briefStamp: 'TOP SECRET',
  briefKicker: 'CLASSIFIED',
  briefPart1: 'PHASE 1 · 구출',
  briefPart2: 'PHASE 2 · 탈출',
  briefFrom: '발신: 작전 본부',
  // HUD
  hudArmor: '방어구',
  hudFever: '오버드라이브',
  hudShield: 'SHIELD',
  hudSlow: 'SLOW',
  pickupShield: '방탄 실드 확보',
  pickupSlow: '시간 감속',
  pickupHeart: '방탄판 +1',
  // overlays: pause + first-run tutorial cards
  pauseKicker: 'OPERATION HOLD',
  pauseTitle: '작전 일시정지',
  pauseText: '통신 유지 중. 준비되면 재개.',
  pauseResume: '작전 재개',
  pauseQuit: '작전 중단',
  pauseRetry: '재투입',
  tutJumpKicker: '바닥 레이저',
  tutJumpHint: '오른쪽을 탭해 점프',
  tutSlideKicker: '천장 레이저',
  tutSlideHint: '오른쪽을 아래로 밀어 슬라이딩',
  tutLaneKicker: '경비 로봇',
  tutLaneHint: '왼쪽을 밀어 레인 이동',
  // result
  resultKicker: 'OPERATION REPORT // 작전 보고서',
  resultAria: '작전 보고서',
  resultWinStatus: 'MISSION COMPLETE',
  resultWinTitle: '임무 완료',
  resultFailStatus: 'MISSION FAILED',
  resultFailTitle: '임무 실패 — 재투입?',
  resultStoryRescue: '포로 확보. 2단계 탈출 작전 개시 — ZONE 06',
  resultStoryEnd: '탈출 성공. 전 작전 종료.',
  resultStoryNext: '거점 제압. ZONE {zone} 개방',
  resultNext: '다음 작전',
  resultRetry: '재투입',
  resultReplay: '재투입',
  resultMap: '작전 지도',
  resultDetails: '작전 기록 상세',
  // loadout room, and the first-run character picker (builds with FEATURES.firstRunPick)
  shopKicker: 'DEPLOYED OPERATOR',
  shopSelect: '배치',
  shopSelected: '배치 중',
  pickKicker: 'OPERATIVE SELECT',
  pickTitle: '요원 선택',
  pickHint: '투입할 요원을 고른다.',
  // stage select, guide, archive, settings, share card, result rewards
  stageAriaPrefix: '작전',
  stagesLocked: '이전 구역 거점 제압 후 개방',
  guideKicker: 'FIELD MANUAL',
  guideLead: '왼손: 레인 이동. 오른손: 점프·슬라이딩. 기본 기술 {n}종.',
  guideStagePrefix: 'OP',
  archiveLead: '열람한 작전 기록만 재생 가능. 미확인 기록은 작전 진행 시 해제.',
  settingsMusicDesc: '작전 박자에 맞춘 신스 트랙',
  creditsLogo: 'LASER ESCAPE // 레이저 탈출작전',
  creditsLine: 'v8 · 사운드 전량 절차 합성. 아트는 생성 이미지 기반.',
  creditsSmall: '통신 종료. 무사 귀환 바람.',
  shareName: '레이저 탈출작전',
  shareCardKicker: 'LASER ESCAPE // OPERATION REPORT',
  resultBossBanner: '거점 제압',
  rewardBossClear: '거점 제압',
  rewardFirst: '첫 임무 보상 → 장비실',
} as const;

export type CopyKey = keyof typeof V8_COPY;

export const COPY: Readonly<Record<CopyKey, string>> = V8_COPY;

/** v8: a stage plays its fixed designed seed (stars and replays depend on it) */
export function runSeedFor(stage: StageDef): number {
  return stage.seed;
}

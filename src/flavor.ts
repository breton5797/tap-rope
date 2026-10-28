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
  // overlays: pause + first-run tutorial cards
  pauseKicker: 'OPERATION HOLD',
  pauseTitle: '작전 일시정지',
  pauseText: '통신 유지 중. 준비되면 재개.',
  pauseResume: '작전 재개',
  pauseQuit: '작전 중단',
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
  resultMap: '작전 지도',
  resultDetails: '작전 기록 상세',
} as const;

export type CopyKey = keyof typeof V8_COPY;

export const COPY: Readonly<Record<CopyKey, string>> = V8_COPY;

/** v8: a stage plays its fixed designed seed (stars and replays depend on it) */
export function runSeedFor(stage: StageDef): number {
  return stage.seed;
}

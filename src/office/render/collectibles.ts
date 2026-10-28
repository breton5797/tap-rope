// Office feel pack F7 (v2 spec §4): which sprite a pickup is drawn with. Coins in a "collect" mission part
// become that stage's collectible (커피 쿠폰, 최종_v3 서류 …); every other pickup gets its office sprite
// (pickup-coin = 칼퇴 포인트, -shield = 노캔 이어폰, -slow = 아이스 아메리카노, -heart = 삼각김밥). The renderer
// falls back to the v8 icons while a sprite is missing.
import type { Beat, ObstacleKind } from '../../types';
import { STAGE_MISSIONS } from '../core/missions';

/** the collectible id of mission part `part` on stage `stageIndex` (STAGE_MISSIONS), or null when it has none */
export function collectibleFor(stageIndex: number, part: number | undefined): string | null {
  if (part === undefined) return null;
  return STAGE_MISSIONS[`w${stageIndex + 1}-s10`]?.[part]?.collectible ?? null;
}

/** the mission part a beat belongs to (Beat.part from the office stage composer; absent = none) */
export const partOf = (beat: Beat | undefined): number | undefined => beat?.part;

/** sprite name for a pickup obstacle on `beat` */
export function pickupSprite(kind: ObstacleKind, beat: Beat | undefined, stageIndex: number): string {
  if (kind === 'coin') {
    const c = collectibleFor(stageIndex, partOf(beat));
    if (c) return `collect-${c}`;
  }
  return `pickup-${kind}`;
}

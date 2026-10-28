// Office feel pack F7 (v2 spec §4): which sprite a pickup is drawn with. Coins in a "collect" mission part
// become that stage's collectible (커피 쿠폰, 최종_v3 서류 …); every other pickup gets its office sprite
// (pickup-coin = 칼퇴 포인트, -shield = 노캔 이어폰, -slow = 아이스 아메리카노, -heart = 삼각김밥). The renderer
// falls back to the v8 icons while a sprite is missing.
import type { Beat, ObstacleKind } from '../../types';

/**
 * The collectible id of mission part `part` on stage `stageIndex`, or null when that part is not a collect
 * mission. Adapter over src/office/core/missions.ts (STAGE_MISSIONS[stage id][part].collectible): until the
 * mission composer lands, no part collects.
 */
export function collectibleFor(_stageIndex: number, _part: number | undefined): string | null {
  return null;
}

/** the mission part a beat belongs to (Beat.part from the office stage composer; absent = none) */
export const partOf = (beat: Beat | undefined): number | undefined => (beat as { readonly part?: number } | undefined)?.part;

/** sprite name for a pickup obstacle on `beat` */
export function pickupSprite(kind: ObstacleKind, beat: Beat | undefined, stageIndex: number): string {
  if (kind === 'coin') {
    const c = collectibleFor(stageIndex, partOf(beat));
    if (c) return `collect-${c}`;
  }
  return `pickup-${kind}`;
}

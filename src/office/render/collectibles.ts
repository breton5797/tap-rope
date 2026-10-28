// Office feel pack F7 (v2 spec §4): which sprite a pickup is drawn with. Coins in a "collect" mission part
// become that stage's collectible (커피 쿠폰, 최종_v3 서류 …); every other pickup gets its office sprite
// (pickup-coin = 칼퇴 포인트, -shield = 노캔 이어폰, -slow = 아이스 아메리카노, -heart = 삼각김밥). The renderer
// falls back to the v8 icons while a sprite is missing.
import type { Beat, ObstacleKind } from '../../types';
import { STAGE_MISSIONS } from '../core/missions';

/** the collectible id of mission part `part` on stage `stageIndex` (STAGE_MISSIONS), or null when it has none */
export function collectibleFor(stageIndex: number, part: number | undefined): string | null {
  if (part === undefined) return null;
  return STAGE_MISSIONS[STAGE_IDS[stageIndex] ?? `w${stageIndex + 1}-s10`]?.[part]?.collectible ?? null;
}

/** the mission part a beat belongs to (Beat.part from the office stage composer; absent = none) */
export const partOf = (beat: Beat | undefined): number | undefined => beat?.part;

const STAGE_IDS: readonly string[] = [0, 1, 2, 3, 4].map((i) => `w${i + 1}-s10`);
/** sprite names per (stage, part, kind), built once (no string building per pickup per frame) */
const NAMES = new Map<number, string>();
const KINDS: readonly ObstacleKind[] = ['coin', 'shield', 'slow', 'heart'];

/** sprite name for a pickup obstacle on `beat` */
export function pickupSprite(kind: ObstacleKind, beat: Beat | undefined, stageIndex: number): string {
  const part = kind === 'coin' ? partOf(beat) ?? -1 : -1;
  const key = (stageIndex * 4 + (part + 1)) * KINDS.length + Math.max(0, KINDS.indexOf(kind));
  let name = NAMES.get(key);
  if (!name) {
    const c = kind === 'coin' ? collectibleFor(stageIndex, part < 0 ? undefined : part) : null;
    name = c ? `collect-${c}` : `pickup-${kind}`;
    NAMES.set(key, name);
  }
  return name;
}

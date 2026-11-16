// Office feel pack F7 (v2 spec §4): which sprite a pickup is drawn with. Coins in a "collect" mission part
// become that stage's collectible (커피 쿠폰, 최종_v3 서류 …); every other pickup gets its office sprite
// (pickup-coin = 칼퇴 포인트, -shield = 노캔 이어폰, -slow = 아이스 아메리카노, -heart = 삼각김밥). The renderer
// falls back to the v8 icons while a sprite is missing.
import type { Beat, ObstacleKind } from '../../types';
import { STAGES } from '../core/content';
import { missionsOf } from '../core/stage-missions';

/** a run's stage: its id (any office stage, the daily included), or a campaign stage index (chapter) */
export type StageKey = string | number;

const idOf = (stage: StageKey): string => (typeof stage === 'string' ? stage : STAGE_IDS[stage] ?? `w${stage + 1}-s10`);

/** the collectible id of mission part `part` of the stage (missionsOf), or null when it has none */
export function collectibleFor(stage: StageKey, part: number | undefined): string | null {
  if (part === undefined) return null;
  return missionsOf(idOf(stage))?.[part]?.collectible ?? null;
}

/** the stage's mission collectible (any part), for a collect mission whose part has none on record */
export function stageCollectible(stage: StageKey): string | null {
  for (const p of missionsOf(idOf(stage)) ?? []) if (p.collectible) return p.collectible;
  return null;
}

/** the mission part a beat belongs to (Beat.part from the office stage composer; absent = none) */
export const partOf = (beat: Beat | undefined): number | undefined => beat?.part;

const STAGE_IDS: readonly string[] = STAGES.map((s) => s.id);
/** sprite names per stage id, then per (part, kind) slot, built once (no string building per pickup per frame) */
const NAMES = new Map<string, string[]>();
const KINDS: readonly ObstacleKind[] = ['coin', 'shield', 'slow', 'heart'];

/** sprite name for a pickup obstacle on `beat` */
export function pickupSprite(kind: ObstacleKind, beat: Beat | undefined, stage: StageKey): string {
  const part = kind === 'coin' ? partOf(beat) ?? -1 : -1;
  const id = idOf(stage);
  let names = NAMES.get(id);
  if (!names) {
    names = [];
    NAMES.set(id, names);
  }
  const slot = (part + 1) * KINDS.length + Math.max(0, KINDS.indexOf(kind));
  let name = names[slot];
  if (!name) {
    const c = kind === 'coin' ? collectibleFor(id, part < 0 ? undefined : part) : null;
    name = c ? `collect-${c}` : `pickup-${kind}`;
    names[slot] = name;
  }
  return name;
}

/**
 * Mission seam (office v2). v8 has no missions: every call is a no-op and the app, HUD, renderer and result
 * card see `null` / `undefined`. The office build swaps in src/office/game/missions.ts (same exports).
 */
import type { Beat, MissionOutcome, MissionView, StageDef } from '../types';
import type { GameEvent } from './session';

/** opaque per-run mission state (v8: never created) */
export type MissionRun = never;

export interface MissionSession {
  readonly beats: readonly Beat[];
  readonly section: number;
  readonly time: number;
}

export interface MissionCard {
  readonly index: number;
  readonly total: number;
  readonly kind: MissionView['kind'];
  readonly title: string;
  readonly target: number;
  readonly line: string;
  readonly superior: string;
}

export function startMissions(_stage: StageDef | null, _beats: readonly Beat[]): MissionRun | null {
  return null;
}

export function trackMissions(_run: MissionRun | null, _s: MissionSession, _events: readonly GameEvent[]): MissionRun | null {
  return null;
}

export function missionView(_run: MissionRun | null, _time: number): MissionView | undefined {
  return undefined;
}

export function commitMissions(_run: MissionRun | null, _cleared: boolean, _record: boolean): MissionOutcome | null {
  return null;
}

export function loadStamps(): Record<string, boolean[]> {
  return {};
}

export function missionCardFor(_stage: StageDef, _section: number): MissionCard | null {
  return null;
}

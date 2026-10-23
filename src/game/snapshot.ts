/** Builds the renderer/HUD view-models from a Session. */
import type { HudState, RenderSnapshot, SkinId } from '../types';
import { SCROLL_SPEED } from '../types';
import { laneItems, visibleObstacles } from '../core/timeline';
import { CHAPTERS } from '../core/content';
import { MAX_HEARTS, sessionProgress, type Session } from './session';

/** Part 2 (escape) zones: the rescued prisoner runs behind the agent. */
export function hasEscort(s: Session): boolean {
  if (s.mode === 'endless') return false;
  return (CHAPTERS[s.stage.chapter]?.part ?? 1) === 2;
}

export interface SnapshotOpts {
  readonly realTime: number;
  readonly reducedMotion: boolean;
  /** menus: the agent idles and the corridor stands still */
  readonly running: boolean;
}

export function toSnapshot(s: Session, skin: SkinId, o: SnapshotOpts): RenderSnapshot {
  return {
    time: s.time,
    realTime: o.realTime,
    world: s.world,
    variant: s.variant,
    player: s.player,
    skin,
    obstacles: visibleObstacles(s.beats, s.time),
    lane: laneItems(s.beats, s.time),
    escort: hasEscort(s),
    fever: s.score.feverTime > 0,
    feverGauge: s.score.feverGauge,
    invulnerable: s.invulnTime > 0,
    shield: s.shield,
    slowMo: s.slowTime > 0,
    mood: s.mood,
    reducedMotion: o.reducedMotion,
    scroll: s.time * SCROLL_SPEED,
    running: o.running,
  };
}

/** "7-3 · 이름" for campaign stages, mode names otherwise. */
export function runTitle(s: Session): string {
  if (s.mode === 'endless') return '무한 탈출';
  if (s.mode === 'daily') return '오늘의 작전';
  return `${s.stage.chapter + 1}-${s.stage.index + 1} · ${s.stage.name}`;
}

export function toHud(s: Session): HudState {
  return {
    hearts: s.hearts,
    maxHearts: MAX_HEARTS,
    score: s.score.score,
    combo: s.score.combo,
    progress: sessionProgress(s),
    feverGauge: s.score.feverTime > 0 ? 1 : s.score.feverGauge,
    fever: s.score.feverTime > 0,
    shield: s.shield,
    slowMo: s.slowTime > 0,
    title: runTitle(s),
    coins: s.score.coins,
    sliding: s.player.sliding,
  };
}

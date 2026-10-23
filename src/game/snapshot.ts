/** Builds the renderer/HUD view-models from a Session. */
import type { HudState, RenderSnapshot, SkinId } from '../types';
import { laneItems, ropeState, visibleObstacles } from '../core/timeline';
import { MAX_HEARTS, sessionProgress, type Session } from './session';

export function toSnapshot(s: Session, skin: SkinId, realTime: number, reducedMotion: boolean): RenderSnapshot {
  return {
    time: s.time,
    realTime,
    world: s.world,
    variant: s.variant,
    player: s.player,
    skin,
    rope: ropeState(s.beats, s.time, s.ropeMode),
    obstacles: visibleObstacles(s.beats, s.time),
    lane: laneItems(s.beats, s.time),
    fever: s.score.feverTime > 0,
    feverGauge: s.score.feverGauge,
    invulnerable: s.invulnTime > 0,
    shield: s.shield,
    slowMo: s.slowTime > 0,
    mood: s.mood,
    reducedMotion,
    showTurners: true,
  };
}

/** "7-3 · 이름" for campaign stages, mode names otherwise. */
export function runTitle(s: Session): string {
  if (s.mode === 'endless') return '엔드리스';
  if (s.mode === 'daily') return '오늘의 도전';
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
    ropeMode: s.ropeMode,
    backward: s.ropeMode === 'solo' && s.player.backward,
  };
}

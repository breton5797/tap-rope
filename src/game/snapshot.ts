/** Builds the renderer/HUD view-models from a Session. */
import type { HudState, RenderSnapshot, SkinId } from '../types';
import { laneItems, ropeState, visibleObstacles } from '../core/timeline';
import { MAX_HEARTS, sessionProgress, type Session } from './session';

export function toSnapshot(s: Session, skin: SkinId, realTime: number, reducedMotion: boolean): RenderSnapshot {
  return {
    time: s.time,
    realTime,
    world: s.world,
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
    title: s.mode === 'stage' ? s.stage.name : s.mode === 'endless' ? '엔드리스' : '오늘의 도전',
    coins: s.score.coins,
    ropeMode: s.ropeMode,
    backward: s.ropeMode === 'solo' && s.player.backward,
  };
}

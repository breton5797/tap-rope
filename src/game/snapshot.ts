/** Builds the renderer/HUD view-models from a Session. */
import type { BossView, CosmeticLook, HudState, RenderSnapshot, SkinId } from '../types';
import { SCROLL_SPEED } from '../types';
import { laneItems, visibleDoors, visibleObstacles } from '../core/timeline';
import { CHAPTERS } from '../core/content';
import { bossForSection, bossView } from '../core/boss';
import { MAX_HEARTS, sessionProgress, type Session } from './session';

/** Part 2 (escape) zones: the rescued prisoner runs behind the agent. */
export function hasEscort(s: Session): boolean {
  if (s.mode === 'endless') return false;
  return (CHAPTERS[s.stage.chapter]?.part ?? 1) === 2;
}

/** v7: the zone boss as seen at the session's current time (null off boss stages). */
export function sessionBoss(s: Session): BossView | null {
  if (s.mode !== 'stage') return null;
  return bossView(s.stage, s.beats, s.doors, s.time, s.hazardDone, s.hazardTotal);
}

export interface SnapshotOpts {
  readonly realTime: number;
  readonly reducedMotion: boolean;
  /** menus: the agent idles and the corridor stands still */
  readonly running: boolean;
  /** v8 (A3): seconds since the boss finisher landing, < 0 = none */
  readonly bossFinish?: number;
  /** v8 (A5): equipped cosmetic colours */
  readonly cosmetics?: CosmeticLook;
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
    doors: visibleDoors(s.doors, s.time),
    boss: sessionBoss(s),
    bossFinish: o.bossFinish ?? -1,
    cosmetics: o.cosmetics,
  };
}

function bossHud(s: Session): HudState['boss'] {
  const meta = s.mode === 'stage' ? bossForSection(s.stage, s.section) : null;
  if (!meta) return null;
  // the gauge the boss view shows (office stage 5: the current section's superior only)
  const hp = sessionBoss(s)?.hp ?? (s.hazardTotal > 0 ? Math.max(0, 1 - s.hazardDone / s.hazardTotal) : 1);
  return { name: meta.name, codename: meta.codename, hp, phase: s.section };
}

/** "7-3 · 이름" for campaign stages, mode names otherwise. */
export function runTitle(s: Session): string {
  if (s.mode === 'endless') return '무한 침투';
  if (s.mode === 'daily') return '일일 작전';
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
    section: s.section,
    sections: s.mode === 'endless' ? 1 : s.stage.sections,
    boss: bossHud(s),
  };
}

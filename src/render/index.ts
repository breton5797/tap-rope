// LASER ESCAPE canvas renderer (v5, 2.5D three-lane corridor). Public entry: createRenderer(canvas).
// Painter's order: background (+ door transition) → door back → for each lane far→near:
// [sheet half behind the lane centre, lane hazards, pickups/drones, escort, agent, sheet half in
// front] → door front → fog/alarm → "!" warnings → effects → rhythm lane HUD.
import {
  GROUND_Y, LOGICAL_H, LOGICAL_W, PLAYER_X, SCROLL_SPEED, type EffectsApi, type PlayerState, type Renderer, type RenderSnapshot,
} from '../types';
import { AgentPainter } from './agent';
import { Corridor } from './corridor';
import { alarmWash, Darkness, fog, sirens, steamPuffs } from './corridor-fx';
import { activeTransition, drawBackground, drawDoorBack, drawDoorFront, drawDoorSign, nextDoor, wantedScenes } from './doors';
import { Effects } from './effects';
import { EscortPainter } from './escort';
import { drawGadgets } from './gadgets';
import { drawLaneHazards } from './hazards';
import { drawLane } from './lane';
import { drawLaserSeg, drawLaserWarnings } from './lasers';
import { AGENT_SCALE, depthScale, laneLean, laneY, projX, visualLane } from './layout';
import { Overlays } from './overlays';
import { SpriteCache } from './sprites';
import type { Ctx } from './util';
import { computeView, type View } from './view';
import { drawWarnings } from './warnings';

class CanvasRenderer implements Renderer {
  private readonly ctx: Ctx;
  private view: View;
  private readonly sprites = new SpriteCache();
  private readonly corridor = new Corridor();
  private readonly darkness = new Darkness();
  private readonly effects = new Effects();
  private readonly agent = new AgentPainter();
  private readonly escort = new EscortPainter();
  private readonly overlays = new Overlays();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('LASER ESCAPE renderer: 2D canvas context unavailable');
    this.ctx = ctx;
    this.view = computeView(canvas.clientWidth || LOGICAL_W, canvas.clientHeight || LOGICAL_H, 1);
    this.applyView();
  }

  get fx(): EffectsApi {
    return this.effects;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.view = computeView(cssWidth, cssHeight, dpr);
    this.applyView();
  }

  /** Debug: backing-store bytes of the main canvas and every cache (preview harness / QA). */
  memoryBytes(): { main: number; corridor: number; sprites: number; other: number } {
    return {
      main: this.canvas.width * this.canvas.height * 4,
      corridor: this.corridor.bytes(),
      sprites: this.sprites.bytes(),
      other: this.darkness.bytes() + this.overlays.bytes(),
    };
  }

  render(snap: RenderSnapshot): void {
    const { ctx, view: v, effects: fx } = this;
    const p = snap.player;
    const lane = visualLane(p);
    const depth = depthScale(lane);
    fx.reduced = snap.reducedMotion;
    fx.anchorX = PLAYER_X;
    fx.feetY = laneY(lane) - p.height * depth;
    fx.bodyLift = (p.sliding ? 14 : 34) * depth;
    const k = v.k;
    const tx = v.ox * v.dpr;
    const ty = v.oy * v.dpr;
    ctx.setTransform(k, 0, 0, k, tx + fx.shakeX() * k, ty + fx.shakeY() * k);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.drawWorld(ctx, v, snap, lane);
    fx.drawWorld(ctx);
    if (snap.fever) this.overlays.fever(ctx, v, snap.realTime, snap.reducedMotion);
    if (snap.slowMo) this.overlays.slowMo(ctx, v, snap.realTime);
    ctx.setTransform(k, 0, 0, k, tx, ty);
    drawLane(ctx, snap.lane, snap.realTime, this.sprites);
    fx.drawFlash(ctx, v);
  }

  private drawWorld(ctx: Ctx, v: View, snap: RenderSnapshot, lane: number): void {
    const t = snap.realTime;
    const variant = snap.variant ?? 'base';
    const reduced = snap.reducedMotion;
    const doors = snap.doors ?? [];
    const scene = { world: snap.world, variant };
    const next = nextDoor(doors);
    this.corridor.sync(v, wantedScenes(scene, doors), snap.scroll + (next ? next.timeUntil * SCROLL_SPEED : 0));
    // reduced motion freezes decorative corridor animation (top-band fans, status LEDs)
    const off = drawBackground(ctx, v, this.corridor, scene, doors, snap.scroll, reduced ? 0 : t, reduced);
    this.corridor.endFrame();
    const tr = activeTransition(doors);
    // variant layers belong to the incoming scene: fade them in with the transition
    ctx.globalAlpha = tr ? tr.p : 1;
    if (variant === 'alarm' && !reduced) sirens(ctx, v, snap.scroll, t);
    if (variant === 'steam') {
      fog(ctx, v, snap.scroll, t, this.sprites, 0.34);
      steamPuffs(ctx, v, snap.scroll, t, this.sprites, reduced);
    }
    ctx.globalAlpha = 1;
    ctx.globalAlpha = tr ? tr.p : 1;
    if (variant === 'dark') this.darkness.draw(ctx, v, GROUND_Y - (laneY(lane) - snap.player.height * depthScale(lane)));
    ctx.globalAlpha = 1;
    for (const d of doors) drawDoorBack(ctx, d, off);
    this.drawLanes(ctx, v, snap, lane);
    for (const d of doors) drawDoorFront(ctx, d, reduced ? 0 : t, off);
    if (variant === 'steam') fog(ctx, v, snap.scroll * 1.3, t * 1.4, this.sprites, 0.12);
    if (variant === 'alarm') alarmWash(ctx, v, reduced ? 0 : t);
    drawLaserWarnings(ctx, v, snap.obstacles, t, snap.fever, reduced, Math.round(lane));
    drawWarnings(ctx, v, snap.obstacles, lane, t, this.sprites, reduced);
    for (const d of doors) drawDoorSign(ctx, v, d, reduced ? 0 : t);
  }

  /** Far lane first; each lane: sheets behind its centre, figures, sheets in front of it. */
  private drawLanes(ctx: Ctx, v: View, snap: RenderSnapshot, lane: number): void {
    const t = snap.realTime;
    const reduced = snap.reducedMotion;
    const escortState = snap.escort ? this.escort.update(snap.player, t, snap.time) : null;
    const escortLane = escortState ? Math.round(visualLane(escortState)) : -1;
    const agentLane = Math.round(lane);
    for (let l = 0; l < 3; l++) {
      drawLaserSeg(ctx, v, snap.obstacles, t, snap.fever, this.sprites, reduced, l === 0 ? -1 : l - 0.5, l);
      drawLaneHazards(ctx, v, snap.obstacles, l, t, this.sprites, reduced);
      drawGadgets(ctx, snap.obstacles, t, this.sprites, l);
      if (escortState && escortLane === l) this.escort.draw(ctx, escortState, t, snap.scroll, snap.running);
      if (agentLane === l) this.drawAgent(ctx, snap, lane, snap.variant === 'dark');
      drawLaserSeg(ctx, v, snap.obstacles, t, snap.fever, this.sprites, reduced, l, l === 2 ? 3 : l + 0.5);
    }
  }

  private drawAgent(ctx: Ctx, snap: RenderSnapshot, lane: number, torch: boolean): void {
    const p: PlayerState = snap.player;
    const depth = depthScale(lane);
    const floorY = laneY(lane);
    const x = projX(PLAYER_X, lane);
    this.agent.shadow(ctx, x, floorY, p.height, p.sliding, AGENT_SCALE * depth);
    this.agent.draw(ctx, {
      x, id: snap.skin, p, mood: snap.mood, t: snap.realTime, scroll: snap.scroll,
      running: snap.running, blink: snap.invulnerable, torch, scale: AGENT_SCALE * depth, floorY, depth,
      lean: snap.reducedMotion ? 0 : laneLean(p),
    });
    if (snap.shield) {
      this.overlays.shield(ctx, x, floorY - p.height * depth - (p.sliding ? 18 : 34) * depth, snap.realTime);
    }
  }

  private applyView(): void {
    const v = this.view;
    this.canvas.width = Math.max(1, Math.round(v.cssW * v.dpr));
    this.canvas.height = Math.max(1, Math.round(v.cssH * v.dpr));
    this.canvas.style.width = `${v.cssW}px`;
    this.canvas.style.height = `${v.cssH}px`;
    this.sprites.setScale(v.k);
  }
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  return new CanvasRenderer(canvas);
}

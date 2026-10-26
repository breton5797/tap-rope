// LASER ESCAPE canvas renderer (v5, 2.5D three-lane corridor). Public entry: createRenderer(canvas).
// Painter's order: background (+ door transition) → door back → for each lane far→near:
// [sheet half behind the lane centre, lane hazards, pickups/drones, escort, agent, sheet half in
// front] → door front → fog/alarm → "!" warnings → effects → rhythm lane HUD.
import {
  GROUND_Y, LOGICAL_H, LOGICAL_W, PLAYER_X, SCROLL_SPEED, type EffectsApi, type PlayerState, type Renderer, type RenderSnapshot,
  type Variant,
} from '../types';
import { AgentPainter } from './agent';
import { Corridor } from './corridor';
import { alarmWash, Darkness, fog, sirens, steamPuffs } from './corridor-fx';
import {
  activeTransition, doorScene, drawBackground, drawDoorBack, drawDoorFront, drawDoorSign, nextDoor, transitionEase,
} from './doors';
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

const STOP_ESCORT = 3;
const STOP_AGENT = 4;

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
    const next = nextDoor(doors);
    this.corridor.sync(v, snap, doorScene(doors), snap.scroll + (next ? next.timeUntil * SCROLL_SPEED : 0));
    // reduced motion freezes decorative corridor animation (top-band fans, status LEDs)
    const off = drawBackground(ctx, v, this.corridor, snap, doors, snap.scroll, reduced ? 0 : t, reduced);
    this.corridor.endFrame();
    // variant layers: during a door transition the old look's fade out while the new look's fade in
    const tr = activeTransition(doors);
    const e = tr ? transitionEase(tr.p) : 1;
    const lift = GROUND_Y - (laneY(lane) - snap.player.height * depthScale(lane));
    if (tr && tr.door.from.variant !== variant) this.backFx(ctx, v, snap, tr.door.from.variant, 1 - e, lift);
    this.backFx(ctx, v, snap, variant, tr && tr.door.from.variant !== variant ? e : 1, lift);
    for (const d of doors) drawDoorBack(ctx, d, off);
    this.drawLanes(ctx, v, snap, lane);
    for (const d of doors) drawDoorFront(ctx, d, reduced ? 0 : t, off);
    if (tr && tr.door.from.variant !== variant) this.frontFx(ctx, v, snap, tr.door.from.variant, 1 - e);
    this.frontFx(ctx, v, snap, variant, tr && tr.door.from.variant !== variant ? e : 1);
    drawLaserWarnings(ctx, v, snap.obstacles, t, snap.fever, reduced, Math.round(lane));
    drawWarnings(ctx, v, snap.obstacles, lane, t, this.sprites, reduced);
    for (const d of doors) drawDoorSign(ctx, v, d, reduced ? 0 : t);
  }

  /** Variant layers behind the gameplay (sirens, steam, darkness) at opacity `fade`. */
  private backFx(ctx: Ctx, v: View, snap: RenderSnapshot, variant: Variant, fade: number, lift: number): void {
    if (fade <= 0.01) return;
    const t = snap.realTime;
    const reduced = snap.reducedMotion;
    ctx.globalAlpha = fade;
    if (variant === 'alarm' && !reduced) sirens(ctx, v, snap.scroll, t);
    if (variant === 'dark') this.darkness.draw(ctx, v, lift);
    ctx.globalAlpha = 1;
    if (variant === 'steam') {
      fog(ctx, v, snap.scroll, t, this.sprites, 0.34 * fade);
      steamPuffs(ctx, v, snap.scroll, t, this.sprites, reduced, fade);
    }
    ctx.globalAlpha = 1;
  }

  /** Variant layers over the gameplay (front fog, alarm wash) at opacity `fade`. */
  private frontFx(ctx: Ctx, v: View, snap: RenderSnapshot, variant: Variant, fade: number): void {
    if (fade <= 0.01) return;
    const t = snap.realTime;
    if (variant === 'steam') fog(ctx, v, snap.scroll * 1.3, t * 1.4, this.sprites, 0.12 * fade);
    if (variant === 'alarm') {
      ctx.globalAlpha = fade;
      alarmWash(ctx, v, snap.reducedMotion ? 0 : t);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Painter's order by real depth: lane stops (hazards, pickups, drones) at 0 / 1 / 2 and the
   * escort and agent at their (possibly fractional, mid lane switch) depths, sorted far → near;
   * laser sheets are drawn in the depth slices between consecutive stops.
   */
  private drawLanes(ctx: Ctx, v: View, snap: RenderSnapshot, lane: number): void {
    const t = snap.realTime;
    const reduced = snap.reducedMotion;
    const escortState = snap.escort ? this.escort.update(snap.player, t, snap.time) : null;
    let n = this.addStop(0, 0, 0);
    n = this.addStop(n, 1, 1);
    n = this.addStop(n, 2, 2);
    if (escortState) n = this.addStop(n, visualLane(escortState), STOP_ESCORT);
    n = this.addStop(n, lane, STOP_AGENT);
    const d = this.stopD;
    const k = this.stopK;
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (d[i] > prev) {
        drawLaserSeg(ctx, v, snap.obstacles, t, snap.fever, this.sprites, reduced, prev, d[i]);
        prev = d[i];
      }
      const kind = k[i];
      if (kind === STOP_AGENT) this.drawAgent(ctx, snap, lane, snap.variant === 'dark');
      else if (kind === STOP_ESCORT && escortState) this.escort.draw(ctx, escortState, t, snap.scroll, snap.running);
      else {
        drawLaneHazards(ctx, v, snap.obstacles, kind, t, this.sprites, reduced);
        drawGadgets(ctx, snap.obstacles, t, this.sprites, kind);
      }
    }
    drawLaserSeg(ctx, v, snap.obstacles, t, snap.fever, this.sprites, reduced, prev, 3);
  }

  /** Insertion sort into the stop list: by depth, then lanes (0..2) < escort < agent at equal depth. */
  private addStop(n: number, depth: number, kind: number): number {
    const d = this.stopD;
    const k = this.stopK;
    let i = n;
    while (i > 0 && (d[i - 1] > depth || (d[i - 1] === depth && k[i - 1] > kind))) {
      d[i] = d[i - 1];
      k[i] = k[i - 1];
      i--;
    }
    d[i] = depth;
    k[i] = kind;
    return n + 1;
  }

  private readonly stopD = new Float64Array(5);
  private readonly stopK = new Int8Array(5);

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

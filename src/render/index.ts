// LASER ESCAPE canvas renderer (v5, 2.5D three-lane corridor). Public entry: createRenderer(canvas).
// Painter's order: background (+ door transition) → door back → for each lane far→near:
// [sheet half behind the lane centre, lane hazards, pickups/drones, escort, agent, sheet half in
// front] → door front → fog/alarm → "!" warnings → effects → rhythm lane HUD.
import {
  GROUND_Y, LOGICAL_H, LOGICAL_W, PLAYER_X, type EffectsApi, type PlayerState, type Renderer, type RenderSnapshot,
  type Variant,
} from '../types';
import { AgentPainter } from './agent';
import { drawBoss, drawBossFront } from './boss';
import { ArtStore } from './art';
import { Corridor } from './corridor';
import { alarmWash, Darkness, fog, sirens, steamPuffs } from './corridor-fx';
import {
  activeTransition, doorScene, drawBackground, drawDoorBack, drawDoorFront, drawDoorSign, transitionEase,
} from './doors';
import { Effects } from './effects';
import { EscortPainter } from './escort';
import { drawGadgets } from './gadgets';
import { drawLaneHazards } from './hazards';
import { drawLane } from './lane';
import { drawLaserSeg, drawLaserWarnings, laserContact } from './lasers';
import { AGENT_SCALE, depthScale, laneLean, laneY, projX, visualLane } from './layout';
import { Overlays } from './overlays';
import { Post } from './post';
import { SpriteCache } from './sprites';
import type { Ctx } from './util';
import { computeView, type View } from './view';
import { drawWarnings } from './warnings';

/** rim light per scene variant (teal practicals, red alarm, warm dawn) */
const RIM: Readonly<Record<Variant, string>> = {
  base: 'rgba(140,215,210,0.5)',
  alarm: 'rgba(255,80,90,0.6)',
  dark: 'rgba(110,200,200,0.4)',
  steam: 'rgba(210,225,230,0.5)',
  night: 'rgba(130,160,230,0.5)',
  dawn: 'rgba(255,175,105,0.6)',
};

function rimColor(v: Variant): string {
  return RIM[v] ?? RIM.base;
}

const STOP_ESCORT = 3;
const STOP_AGENT = 4;

class CanvasRenderer implements Renderer {
  private readonly ctx: Ctx;
  private view: View;
  private readonly sprites = new SpriteCache();
  private readonly art = new ArtStore();
  private readonly corridor = new Corridor(this.art);
  private readonly darkness = new Darkness();
  private readonly effects = new Effects();
  private readonly agent = new AgentPainter();
  private readonly escort = new EscortPainter();
  private readonly overlays = new Overlays();
  private readonly post = new Post();
  private lastTime = 0;
  private lastRunning = false;
  private lastTransition = false;

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

  /** Fetch the photo art; never rejects (missing files keep the procedural look). */
  load(onProgress?: (done: number, total: number) => void): Promise<void> {
    return this.art.load(onProgress).catch(() => undefined);
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.view = computeView(cssWidth, cssHeight, dpr);
    this.applyView();
  }

  /** Debug: backing-store bytes of the main canvas and every cache (preview harness / QA). */
  memoryBytes(): { main: number; corridor: number; sprites: number; other: number; photos: number } {
    return {
      main: this.canvas.width * this.canvas.height * 4,
      corridor: this.corridor.bytes(),
      sprites: this.sprites.bytes(),
      other: this.darkness.bytes() + this.overlays.bytes() + this.post.bytes(),
      photos: this.art.bytes(),
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
    fx.bodyLift = (p.sliding ? 18 : 48) * depth;
    const c = laserContact(snap.obstacles, lane, p.height);
    fx.contactX = c ? c.x : -1;
    fx.contactY = c ? c.y : 0;
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
    this.post.finish(ctx, v, snap.reducedMotion);
    this.post.hitEdge(ctx, v, fx.hitAge, snap.reducedMotion);
    drawLane(ctx, snap.lane, snap.realTime, this.sprites);
    fx.drawFlash(ctx, v);
  }

  private drawWorld(ctx: Ctx, v: View, snap: RenderSnapshot, lane: number): void {
    const t = snap.realTime;
    const variant = snap.variant ?? 'base';
    const reduced = snap.reducedMotion;
    const doors = snap.doors ?? [];
    // stage start (time jumps back / running starts) and doors are where a late scene may swap to photos
    // edge-triggered: once when a door transition starts (not every frame of it), so a late
    // scene's wait cap still counts frames during the transition
    const inTransition = activeTransition(doors) !== null;
    if (snap.time < this.lastTime - 0.25 || snap.running !== this.lastRunning || (inTransition && !this.lastTransition)) {
      this.corridor.boundary();
    }
    this.lastTransition = inTransition;
    this.lastTime = snap.time;
    this.lastRunning = snap.running;
    this.corridor.sync(v, snap, doorScene(doors));
    // reduced motion freezes decorative corridor animation (top-band fans, status LEDs)
    const off = drawBackground(ctx, v, this.corridor, snap, doors, snap.scroll, reduced ? 0 : t, reduced);
    this.corridor.endFrame();
    // variant layers: during a door transition the old look's fade out while the new look's fade in
    const tr = activeTransition(doors);
    const e = tr ? transitionEase(tr.p) : 1;
    const lift = GROUND_Y - (laneY(lane) - snap.player.height * depthScale(lane));
    if (tr && tr.door.from.variant !== variant) this.backFx(ctx, v, snap, tr.door.from.variant, 1 - e, lift);
    this.backFx(ctx, v, snap, variant, tr && tr.door.from.variant !== variant ? e : 1, lift);
    if (snap.boss) drawBoss(ctx, v, snap, t, this.sprites);
    for (const d of doors) drawDoorBack(ctx, d, off, reduced ? 0 : t, this.sprites, reduced);
    this.drawLanes(ctx, v, snap, lane);
    for (const d of doors) drawDoorFront(ctx, d, reduced ? 0 : t, off);
    // one grade over the whole world (corridor, hazards, characters) so nothing sits un-graded on
    // top, then the lamp light shafts falling over everything
    this.post.gradeWorld(ctx, v, variant, tr ? e : 1);
    if (tr) this.post.gradeWorld(ctx, v, tr.door.from.variant, 1 - e);
    this.post.shafts(ctx, v, variant, snap.scroll, tr ? e : 1, this.corridor.shaftRig(snap));
    if (tr) this.post.shafts(ctx, v, tr.door.from.variant, snap.scroll, 1 - e, this.corridor.shaftRig(tr.door.from));
    if (tr && tr.door.from.variant !== variant) this.frontFx(ctx, v, snap, tr.door.from.variant, 1 - e);
    this.frontFx(ctx, v, snap, variant, tr && tr.door.from.variant !== variant ? e : 1);
    if (snap.boss) drawBossFront(ctx, v, snap, t, this.sprites);
    this.post.dust(ctx, v, t, snap.scroll, reduced);
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
    if (variant === 'alarm') alarmWash(ctx, v, reduced ? 0 : t);
    if (variant === 'alarm' && !reduced) sirens(ctx, v, snap.scroll, t, this.sprites);
    if (variant === 'dark') this.darkness.draw(ctx, v, lift);
    ctx.globalAlpha = 1;
    if (variant === 'steam') {
      fog(ctx, v, snap.scroll, t, this.sprites, 0.18 * fade);
      steamPuffs(ctx, v, snap.scroll, t, this.sprites, reduced, fade);
    }
    ctx.globalAlpha = 1;
  }

  /** Variant layers over the gameplay (front fog, alarm wash) at opacity `fade`. */
  private frontFx(ctx: Ctx, v: View, snap: RenderSnapshot, variant: Variant, fade: number): void {
    if (fade <= 0.01) return;
    const t = snap.realTime;
    if (variant === 'steam') fog(ctx, v, snap.scroll * 1.3, t * 1.4, this.sprites, 0.08 * fade);
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
        drawLaserSeg(ctx, v, snap.obstacles, t, snap.fever, this.sprites, reduced, prev, d[i], lane);
        prev = d[i];
      }
      const kind = k[i];
      if (kind === STOP_AGENT) this.drawAgent(ctx, snap, lane, snap.variant === 'dark');
      else if (kind === STOP_ESCORT && escortState) this.escort.draw(ctx, escortState, t, snap.scroll, snap.running, rimColor(snap.variant), snap.mood === 'hurt');
      else {
        drawLaneHazards(ctx, v, snap.obstacles, kind, t, this.sprites, reduced);
        drawGadgets(ctx, snap.obstacles, t, this.sprites, kind);
      }
    }
    drawLaserSeg(ctx, v, snap.obstacles, t, snap.fever, this.sprites, reduced, prev, 3, lane);
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
      lean: snap.reducedMotion ? 0 : laneLean(p), rim: rimColor(snap.variant),
    });
    if (snap.shield) {
      this.overlays.shield(ctx, x, floorY - p.height * depth - (p.sliding ? 20 : 46) * depth, snap.realTime);
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
  const r = new CanvasRenderer(canvas);
  // QA: ?memdebug exposes the canvas memory report (used by the device-budget checks)
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('memdebug')) {
    (window as unknown as { __mem: () => unknown }).__mem = () => r.memoryBytes();
  }
  return r;
}

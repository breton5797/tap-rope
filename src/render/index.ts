// LASER ESCAPE canvas renderer (v4, side-scrolling corridor). Public entry: createRenderer(canvas).
import { GROUND_Y, LOGICAL_H, LOGICAL_W, PLAYER_X, type EffectsApi, type Renderer, type RenderSnapshot } from '../types';
import { AgentPainter } from './agent';
import { Corridor } from './corridor';
import { AGENT_SCALE } from './layout';
import { alarmWash, Darkness, fog, sirens, steamPuffs } from './corridor-fx';
import { Effects } from './effects';
import { EscortPainter } from './escort';
import { drawGadgets } from './gadgets';
import { drawLane } from './lane';
import { drawLasers } from './lasers';
import { Overlays } from './overlays';
import { SpriteCache } from './sprites';
import type { Ctx } from './util';
import { computeView, type View } from './view';

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

  render(snap: RenderSnapshot): void {
    const { ctx, view: v, effects: fx } = this;
    fx.reduced = snap.reducedMotion;
    fx.anchorX = PLAYER_X;
    fx.feetY = GROUND_Y - snap.player.height;
    fx.bodyLift = snap.player.sliding ? 14 : 34;
    const k = v.k;
    const tx = v.ox * v.dpr;
    const ty = v.oy * v.dpr;
    ctx.setTransform(k, 0, 0, k, tx + fx.shakeX() * k, ty + fx.shakeY() * k);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.drawWorld(ctx, v, snap);
    fx.drawWorld(ctx);
    if (snap.fever) this.overlays.fever(ctx, v, snap.realTime, snap.reducedMotion);
    if (snap.slowMo) this.overlays.slowMo(ctx, v, snap.realTime);
    ctx.setTransform(k, 0, 0, k, tx, ty);
    drawLane(ctx, snap.lane, snap.realTime, this.sprites);
    fx.drawFlash(ctx, v);
  }

  private drawWorld(ctx: Ctx, v: View, snap: RenderSnapshot): void {
    const t = snap.realTime;
    const variant = snap.variant ?? 'base';
    const reduced = snap.reducedMotion;
    // reduced motion freezes decorative corridor animation (top-band fans, status LEDs)
    this.corridor.draw(ctx, v, snap.world, variant, snap.scroll, reduced ? 0 : t);
    if (variant === 'alarm' && !reduced) sirens(ctx, v, snap.scroll, t);
    if (variant === 'steam') {
      fog(ctx, v, snap.scroll, t, this.sprites, 0.34);
      steamPuffs(ctx, v, snap.scroll, t, this.sprites, reduced);
    }
    if (variant === 'dark') this.darkness.draw(ctx, v, snap.player.height);
    drawLasers(ctx, v, snap.obstacles, t, snap.fever, this.sprites, reduced);
    drawGadgets(ctx, snap.obstacles, t, this.sprites);
    if (snap.escort) this.escort.draw(ctx, snap.player, t, snap.time, snap.scroll, snap.running);
    this.drawAgent(ctx, snap, variant === 'dark');
    if (variant === 'steam') fog(ctx, v, snap.scroll * 1.3, t * 1.4, this.sprites, 0.12);
    if (variant === 'alarm') alarmWash(ctx, v, reduced ? 0 : t);
  }

  private drawAgent(ctx: Ctx, snap: RenderSnapshot, torch: boolean): void {
    const p = snap.player;
    this.agent.shadow(ctx, PLAYER_X, p.height, p.sliding, AGENT_SCALE);
    this.agent.draw(ctx, {
      x: PLAYER_X, id: snap.skin, p, mood: snap.mood, t: snap.realTime, scroll: snap.scroll,
      running: snap.running, blink: snap.invulnerable, torch, scale: AGENT_SCALE, yOff: 0,
    });
    if (snap.shield) this.overlays.shield(ctx, PLAYER_X, GROUND_Y - p.height - (p.sliding ? 18 : 34), snap.realTime);
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

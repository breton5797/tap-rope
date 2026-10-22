// TAP ROPE canvas renderer. Public entry: createRenderer(canvas).
import { LOGICAL_H, LOGICAL_W, type EffectsApi, type Renderer, type RenderSnapshot } from '../types';
import { Background } from './background';
import { Effects } from './effects';
import { drawLane } from './lane';
import { drawFloaters, drawHurdles } from './obstacles';
import { Overlays } from './overlays';
import { PlayerPainter } from './player';
import { drawRopePass, isFront, randomRopePoint, ROPE_STYLES } from './rope';
import { SpriteCache } from './sprites';
import { drawTurnerHands, drawTurners } from './turners';
import type { Ctx } from './util';
import { computeView, type View } from './view';

class CanvasRenderer implements Renderer {
  private readonly ctx: Ctx;
  private view: View;
  private readonly sprites = new SpriteCache();
  private readonly bg = new Background();
  private readonly effects = new Effects();
  private readonly player = new PlayerPainter();
  private readonly overlays = new Overlays();
  private readonly pt = new Float32Array(2);

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('TAP ROPE renderer: 2D canvas context unavailable');
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
    fx.playerHeight = snap.player.height;
    const k = v.k;
    const tx = v.ox * v.dpr;
    const ty = v.oy * v.dpr;
    ctx.setTransform(k, 0, 0, k, tx + fx.shakeX() * k, ty + fx.shakeY() * k);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.bg.draw(ctx, v, snap.world, snap.realTime, this.sprites);
    this.drawStage(ctx, snap);
    fx.drawWorld(ctx);
    if (snap.fever) this.overlays.fever(ctx, v, snap.realTime, snap.reducedMotion);
    if (snap.slowMo) this.overlays.slowMo(ctx, v, snap.realTime);
    ctx.setTransform(k, 0, 0, k, tx, ty);
    drawLane(ctx, snap.lane, snap.realTime, this.sprites);
    fx.drawFlash(ctx, v);
  }

  private drawStage(ctx: Ctx, snap: RenderSnapshot): void {
    const { rope } = snap;
    const t = snap.realTime;
    const turners = snap.showTurners;
    const reduced = snap.reducedMotion;
    const [ropeA, ropeB] = ROPE_STYLES[snap.world] ?? ROPE_STYLES[0];
    this.player.drawShadow(ctx, snap.player.height);
    if (turners) {
      drawTurners(ctx, rope.phaseA, t, snap.player.height);
      if (rope.phaseB !== null) drawRopePass(ctx, rope.phaseB, rope.speed, false, ropeB, snap.fever, t, reduced);
      drawRopePass(ctx, rope.phaseA, rope.speed, false, ropeA, snap.fever, t, reduced);
    }
    drawHurdles(ctx, snap.obstacles, this.sprites);
    this.player.draw(ctx, snap);
    if (turners) {
      drawRopePass(ctx, rope.phaseA, rope.speed, true, ropeA, snap.fever, t, reduced);
      if (rope.phaseB !== null) drawRopePass(ctx, rope.phaseB, rope.speed, true, ropeB, snap.fever, t, reduced);
      drawTurnerHands(ctx, rope.phaseA);
      if (snap.fever && !reduced) this.feverTrail(rope.phaseA);
    }
    drawFloaters(ctx, snap.obstacles, t, this.sprites);
  }

  private feverTrail(phase: number): void {
    if (!isFront(phase) && Math.random() < 0.5) return;
    randomRopePoint(phase, 0.1 + Math.random() * 0.8, this.pt);
    this.effects.sparkleAt(this.pt[0], this.pt[1]);
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

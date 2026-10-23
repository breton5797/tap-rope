// TAP ROPE canvas renderer (v2, oblique top-down camera). Public entry: createRenderer(canvas).
import { LOGICAL_H, LOGICAL_W, type EffectsApi, type Renderer, type RenderSnapshot } from '../types';
import { Background } from './background';
import { Effects } from './effects';
import { drawLane } from './lane';
import { drawObstacles, drawObstacleShadows } from './obstacles';
import { Overlays } from './overlays';
import { PlayerPainter } from './player';
import { project } from './projection';
import {
  drawRopePass, handPos, isFront, ropePoint, RopeRig, ROPE_STYLES, setLongRig, setSoloRig, type RopeStyle,
} from './rope';
import { SpriteCache } from './sprites';
import { drawTurnerHands, drawTurners } from './turners';
import type { Ctx } from './util';
import { computeView, type View } from './view';

/** obstacles farther than this are drawn behind the back half of the rope */
const ROPE_DEPTH = 70;

class CanvasRenderer implements Renderer {
  private readonly ctx: Ctx;
  private view: View;
  private readonly sprites = new SpriteCache();
  private readonly bg = new Background();
  private readonly effects = new Effects();
  private readonly player = new PlayerPainter();
  private readonly overlays = new Overlays();
  private readonly rigA = new RopeRig();
  private readonly rigB = setLongRig(new RopeRig());
  private readonly pt = new Float32Array(3);
  private readonly hp = new Float32Array(3);

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
    const k = v.k;
    const tx = v.ox * v.dpr;
    const ty = v.oy * v.dpr;
    ctx.setTransform(k, 0, 0, k, tx + fx.shakeX() * k, ty + fx.shakeY() * k);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const variant = snap.variant ?? 'base';
    this.bg.draw(ctx, v, snap.world, variant, snap.realTime, this.sprites, snap.reducedMotion);
    this.drawStage(ctx, snap);
    this.bg.overlay(ctx, v, snap.world, variant, snap.realTime, snap.reducedMotion);
    fx.anchorX = this.player.feetX;
    fx.feetY = this.player.feetY;
    fx.drawWorld(ctx);
    if (snap.fever) this.overlays.fever(ctx, v, snap.realTime, snap.reducedMotion);
    if (snap.slowMo) this.overlays.slowMo(ctx, v, snap.realTime);
    ctx.setTransform(k, 0, 0, k, tx, ty);
    drawLane(ctx, snap.lane, snap.realTime, this.sprites);
    fx.drawFlash(ctx, v);
  }

  private setupRigs(snap: RenderSnapshot): void {
    const p = snap.player;
    if (snap.rope.mode === 'solo') {
      setSoloRig(this.rigA, p.laneX, p.height, p.backward, p.cross);
      this.rigA.floor = 0;
      for (let i = 0; i < 2; i++) {
        handPos(this.rigA, snap.rope.phaseA, i === 0 ? -1 : 1, this.hp);
        project(this.hp[0], this.hp[1], this.hp[2], this.pt);
        this.player.hands[i * 2] = this.pt[0];
        this.player.hands[i * 2 + 1] = this.pt[1];
      }
    } else {
      setLongRig(this.rigA);
      this.player.hands[0] = Number.NaN;
    }
  }

  private ropes(ctx: Ctx, snap: RenderSnapshot, front: boolean, a: RopeStyle, b: RopeStyle): void {
    const { rope } = snap;
    const t = snap.realTime;
    const solo = rope.mode === 'solo';
    if (!solo && rope.phaseB !== null) {
      drawRopePass(ctx, this.rigB, rope.phaseB, rope.speed, front, b, snap.fever, t, snap.reducedMotion);
    }
    drawRopePass(ctx, this.rigA, rope.phaseA, rope.speed, front, a, snap.fever, t, snap.reducedMotion);
  }

  private drawStage(ctx: Ctx, snap: RenderSnapshot): void {
    const t = snap.realTime;
    const p = snap.player;
    const long = snap.rope.mode === 'long' && snap.showTurners;
    const solo = snap.rope.mode === 'solo';
    const showRope = long || solo;
    const [a, b] = ROPE_STYLES[snap.world] ?? ROPE_STYLES[0];
    this.setupRigs(snap);
    drawObstacleShadows(ctx, snap.obstacles);
    this.player.drawShadow(ctx, p.laneX, p.height);
    drawObstacles(ctx, snap.obstacles, ROPE_DEPTH, Number.POSITIVE_INFINITY, t, this.sprites);
    if (long) drawTurners(ctx, snap.rope.phaseA, t, p.height);
    if (showRope) this.ropes(ctx, snap, false, a, b);
    drawObstacles(ctx, snap.obstacles, 0, ROPE_DEPTH, t, this.sprites);
    this.player.draw(ctx, snap);
    if (showRope) this.ropes(ctx, snap, true, a, b);
    if (long) drawTurnerHands(ctx, snap.rope.phaseA);
    if (solo && p.cross) this.player.drawCrossX(ctx, a.main, a.dark);
    if (solo) this.player.drawHandsOver(ctx, snap.skin);
    if (showRope && snap.fever && !snap.reducedMotion) this.feverTrail(snap.rope.phaseA);
    drawObstacles(ctx, snap.obstacles, Number.NEGATIVE_INFINITY, 0, t, this.sprites);
  }

  private feverTrail(phase: number): void {
    if (!isFront(phase, this.rigA.sign) && Math.random() < 0.5) return;
    ropePoint(this.rigA, phase, 0.1 + Math.random() * 0.8, this.pt);
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

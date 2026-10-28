// Office build stand-in for src/render/index.ts (build/office-swaps.ts): the v8 renderer draws the scene
// (with the office hero, prop and boss-rig modules swapped in), then this layer adds the office extras:
// the 0.15 s zoom/shake kick when a superior telegraphs an attack, the surprise events (blackout with
// hazard outlines, fire-drill flash, high five, broadcast), speech bubbles (catchphrase at the intro, exit
// line when the gauge runs out) and the clock. Missing art or a missing run never throws: it draws less.
import type { BossView, EffectsApi, Renderer, RenderRun, RenderSnapshot } from '../../types';
import { LOGICAL_H, LOGICAL_W, PLAYER_X } from '../../types';
import { createRenderer as createV8Renderer } from '../../render/index';
import { FLOOR_FRONT, depthScale, laneY, visualLane } from '../../render/layout';
import { drawLaserWarnings } from '../../render/lasers';
import { SpriteCache } from '../../render/sprites';
import { computeView, type View } from '../../render/view';
import { drawWarnings } from '../../render/warnings';
import { OFFICE_CLOCK } from '../core/content';
import { OFFICE_BOSSES } from '../core/boss';
import { cartProp, planEvents, type OfficeEvent } from '../core/events';
import { BROADCAST_LINE } from '../game/boss-lines';
import { drawClock, laneTopY } from './clock';
import { hudBand } from './hud-band';
import { OFFICE_ART, OFFICE_EXTRA_ART, loadImages, preloadImages } from './images';
import { setPropFrame } from './props';
import { blackoutAlpha, surpriseKick, type Rect } from './surprise';
import { drawBlackout, drawBossBubble, drawBroadcast, drawConfetti, drawFireDrill, drawHighFive } from './surprise-fx';
import { setBossPose } from './boss-art';
import { setThrowFrame } from './boss-throw';
import { drawApronFlow, drawSpeedLines, speedLineCount } from './floor-flow';
import { setPickupFrame } from './gadgets';

export * from '../../render/index';

/** the boss shows its -attack frame until the thrown prop is this close (s) */
const THROW_POSE_END = 0.5;

/** the office sprites may hold the loading screen this long, then arrive late */
const ART_TIMEOUT = 4000;

/** how long the exit line stays up after the gauge runs out */
const EXIT_LINE_TIME = 2.4;

interface Plan {
  beats: RenderRun['beats'];
  seed: number;
  events: readonly OfficeEvent[];
  carts: ReadonlyMap<number, string>;
}

function planFor(run: RenderRun): Plan {
  const events = planEvents(run.beats, run.seed, run.stageIndex);
  const carts = new Map(events.filter((e) => e.kind === 'cart').map((e) => [e.beatIndex, cartProp(run.seed, e.beatIndex)]));
  return { beats: run.beats, seed: run.seed, events, carts };
}

const activeAt = (events: readonly OfficeEvent[], kind: OfficeEvent['kind'], t: number): OfficeEvent | null =>
  events.find((e) => e.kind === kind && t >= e.time && t <= e.time + e.duration + 0.2) ?? null;

/** an overlay error is reported once per session */
let overlayWarned = false;

const superiorOf = (id: BossView['id']) => OFFICE_BOSSES.find((b) => b.slot === id) ?? null;

class OfficeRenderer implements Renderer {
  private readonly inner: Renderer;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly sprites = new SpriteCache();
  private view: View;
  private plan: Plan | null = null;
  private prevAttack: BossView['attack'] = null;
  private kickAt = Number.NEGATIVE_INFINITY;
  /** realTime the gauge of superior `exitId` ran out (its exit line shows for EXIT_LINE_TIME) */
  private exitAt = Number.NEGATIVE_INFINITY;
  private exitId: BossView['id'] | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.inner = createV8Renderer(canvas);
    this.ctx = canvas.getContext('2d');
    this.view = computeView(canvas.clientWidth || LOGICAL_W, canvas.clientHeight || LOGICAL_H, 1);
    this.sprites.setScale(this.view.k);
    preloadImages(OFFICE_ART);
    preloadImages(OFFICE_EXTRA_ART);
  }

  get fx(): EffectsApi {
    return this.inner.fx;
  }

  /** the v8 corridor art and the office sprites (sprites give up after ART_TIMEOUT; never rejects) */
  load(onProgress?: (done: number, total: number) => void): Promise<void> {
    return Promise.all([this.inner.load(onProgress), loadImages([...OFFICE_ART, ...OFFICE_EXTRA_ART], ART_TIMEOUT)]).then(() => undefined, () => undefined);
  }

  resize(cssWidth: number, cssHeight: number, dpr: number, safeBottom = 0): void {
    this.inner.resize(cssWidth, cssHeight, dpr, safeBottom);
    this.view = computeView(cssWidth, cssHeight, dpr, safeBottom);
    this.sprites.setScale(this.view.k);
  }

  render(snap: RenderSnapshot): void {
    const run = snap.run;
    if (run && (!this.plan || this.plan.beats !== run.beats || this.plan.seed !== run.seed)) this.plan = planFor(run);
    const plan = run ? this.plan : null;
    const fallback = OFFICE_BOSSES.find((b) => b.stage === (run?.stageIndex ?? 0) + 1)?.slot ?? 'warden';
    setPropFrame(snap.boss?.id ?? fallback, run?.seed ?? 1, plan?.carts);
    this.feelFrame(snap, run);
    this.inner.render(snap);
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      this.overlay(ctx, snap, plan, run);
    } catch (e) {
      // presentation only: a failed extra must never stop the game frame (dev builds surface it)
      if (import.meta.env.DEV) throw e;
      if (!overlayWarned) {
        overlayWarned = true;
        console.warn('office overlay failed; extras skipped this frame', e);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  /** v2 feel pack context for the swapped draw modules: throws, pickup sprites, boss pose */
  private feelFrame(snap: RenderSnapshot, run: RenderRun | undefined): void {
    const b = snap.boss;
    setThrowFrame(snap.running && b !== null && b.state !== 'defeated', this.view);
    if (run) setPickupFrame(run.beats, run.stageIndex);
    // tired once this superior's own gauge is empty (stage 5: per section, so it never carries over)
    if (!b) setBossPose('idle');
    else if (b.hp <= 0 || b.state === 'defeated') setBossPose('tired');
    else setBossPose(b.state === 'fight' && b.attack && b.attack.timeUntil > THROW_POSE_END ? 'attack' : 'idle');
  }

  private overlay(ctx: CanvasRenderingContext2D, snap: RenderSnapshot, plan: Plan | null, run: RenderRun | undefined): void {
    const v = this.view;
    const t = snap.time;
    const band = hudBand(this.canvas, v, snap.realTime);
    ctx.setTransform(v.k, 0, 0, v.k, v.ox * v.dpr, v.oy * v.dpr);
    // F1: the apron flows with the floor; fever speed lines
    if (snap.running) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(v.x0, FLOOR_FRONT, v.w, laneTopY(v) - FLOOR_FRONT);
      ctx.clip();
      drawApronFlow(ctx, v, snap.scroll, laneTopY(v));
      ctx.restore();
      drawSpeedLines(ctx, v, snap.realTime, speedLineCount(snap.fever, snap.reducedMotion));
    }
    this.kick(ctx, snap);
    ctx.setTransform(v.k, 0, 0, v.k, v.ox * v.dpr, v.oy * v.dpr);
    const events = snap.running && plan ? plan.events : [];
    const lane = visualLane(snap.player);
    const blackout = activeAt(events, 'blackout', t);
    if (blackout) {
      const a = blackoutAlpha(t, blackout);
      if (a.scene > 0) {
        drawBlackout(ctx, v, snap.obstacles, a.scene, a.outline);
        drawLaserWarnings(ctx, v, snap.obstacles, snap.realTime, snap.fever, snap.reducedMotion, Math.round(lane));
        drawWarnings(ctx, v, snap.obstacles, lane, snap.realTime, this.sprites, snap.reducedMotion);
      }
    }
    const drill = activeAt(events, 'fire-drill', t);
    if (drill) drawFireDrill(ctx, v, t - drill.time, snap.reducedMotion);
    const five = activeAt(events, 'highfive', t);
    if (five) drawHighFive(ctx, v, PLAYER_X, laneY(lane) - snap.player.height * depthScale(lane) - 120, t - five.time, band.top);
    const broadcast = activeAt(events, 'broadcast', t);
    if (broadcast) drawBroadcast(ctx, v);
    this.bubble(ctx, v, snap, broadcast !== null, Math.max(band.top, band.line), band.countdown);
    const stampAt = (snap as { readonly mission?: { readonly stampAt?: number } }).mission?.stampAt;
    if (stampAt !== undefined && !snap.reducedMotion) drawConfetti(ctx, v, t - stampAt, Math.max(v.y0, band.top));
    if (run && snap.running) drawClock(ctx, v, OFFICE_CLOCK(run.stageIndex, run.progress), run.stageIndex >= 4 && run.progress > 0.8);
    ctx.globalAlpha = 1;
  }

  /** 0.15 s punch-in + shake when a superior starts telegraphing an attack (skipped under reduced motion) */
  private kick(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    const a = snap.boss?.attack ?? null;
    const p = this.prevAttack;
    if (a && (!p || a.timeUntil > p.timeUntil + 1e-6)) this.kickAt = snap.realTime;
    this.prevAttack = a;
    if (snap.reducedMotion || !snap.running) return;
    const k = surpriseKick(snap.realTime, this.kickAt);
    if (k.zoom === 1 && k.shake === 0) return;
    const c = this.canvas;
    const sx = Math.sin(snap.realTime * 90) * k.shake * this.view.k;
    const sy = Math.cos(snap.realTime * 77) * k.shake * this.view.k;
    const w = c.width * k.zoom;
    const h = c.height * k.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(c, (c.width - w) / 2 + sx, (c.height - h) / 2 + sy, w, h);
  }

  /** catchphrase while the superior walks in, exit line once its gauge runs out */
  private bubble(ctx: CanvasRenderingContext2D, v: View, snap: RenderSnapshot, broadcast: boolean, below: number, avoid: Rect | null): void {
    const b = snap.boss;
    if (!b || !snap.running) return;
    const who = superiorOf(b.id);
    if (!who) return;
    if (b.hp <= 0 && this.exitId !== b.id) {
      this.exitId = b.id;
      this.exitAt = snap.realTime;
    }
    if (b.hp > 0 && this.exitId === b.id) this.exitId = null; // a retry refills the gauge
    let text: string | null = null;
    if (this.exitId === b.id && snap.realTime - this.exitAt < EXIT_LINE_TIME) text = who.exitLine;
    else if (b.state === 'intro') text = who.catchphrase;
    else if (broadcast) text = BROADCAST_LINE;
    if (text && broadcast && text !== who.exitLine) text = BROADCAST_LINE;
    if (text) drawBossBubble(ctx, v, text, below, avoid);
  }
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  return new OfficeRenderer(canvas);
}

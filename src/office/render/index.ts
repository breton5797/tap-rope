// Office build stand-in for src/render/index.ts (build/office-swaps.ts): the v8 renderer draws the scene
// (with the office hero, prop and boss-rig modules swapped in), then this layer adds the office extras:
// the 0.15 s zoom/shake kick when a superior telegraphs an attack, the surprise events (blackout with
// hazard outlines, fire-drill flash, high five, broadcast), speech bubbles (catchphrase at the intro, exit
// line when the gauge runs out) and the clock. Missing art or a missing run never throws: it draws less.
import type { Beat, BossView, EffectsApi, Renderer, RenderRun, RenderSnapshot, VisibleObstacle } from '../../types';
import { HAZARD_KINDS, LOGICAL_H, LOGICAL_W, PLAYER_X } from '../../types';
import { createRenderer as createV8Renderer } from '../../render/index';
import { BEAM_H, FLOOR_FRONT, depthScale, fixedX, laneY, projX, projY, setLaneSwitchTime, visualLane } from '../../render/layout';
import { drawLaserWarnings } from '../../render/lasers';
import { SpriteCache } from '../../render/sprites';
import { computeView, type View } from '../../render/view';
import { drawWarnings } from '../../render/warnings';
import { OFFICE_CLOCK } from '../core/content';
import { OFFICE_BOSSES } from '../core/boss';
import { cartProp, planEvents, type OfficeEvent } from '../core/events';
import { broadcastLine } from '../game/boss-lines';
import { clockUrgent, drawClock, laneTopY } from './clock';
import { CalloutHold } from './callout-hold';
import { superiorOnStage } from './superior';
import { TipRunner } from './move-tip';
import { COPY } from '../../flavor';
import { overlayState } from '../ui/mission';
import { SIGN_LEAD, beatHint, chevronPlan, rearArrow, safeArrow, safeArrowX, safeLanes, scanSigns, stayLowBand } from './readability';
import { hudBand, lastHudBand, setCalloutBottom } from './hud-band';
import { OFFICE_ART, OFFICE_EXTRA_ART, loadImages, preloadImages } from './images';
import {
  actionCue, beatIdOf, drawRecordedSilhouettes, propIdFor, recordOverflowed, propImage, setFocusLane, setPropFrame, startPropRecord, stopPropRecord, stagePropIds, warmStep,
} from './props';
import { KICK_TIME, blackoutAlpha, kickKeyframes, surpriseKick, type Rect } from './surprise';
import {
  drawAttackCallout, drawBlackout, drawMoveTip, warmCallouts, drawColleague, drawBossBubble, drawBroadcast, drawConfetti, drawFireDrill, drawHighFive,
} from './surprise-fx';
import { prepareBosses, setBossPose, type BossPose } from './boss-art';
import { STEP_HZ, bossExit } from './boss-rigs';
import { RELEASE, bossThrowFrame, launchFor, propVisibleFrom, setThrowFrame } from './boss-throw';
import { drawApronFlow, drawSpeedLines, speedLineCount } from './floor-flow';
import { setHeroShield, setHeroStageProgress } from './agent';
import { warmHeroSets } from './hero-scale';
import { warmPopups } from './popups';
import { frameLaneSwitch } from './hero-style';
import { laneCollectibleArt, setPickupFrame } from './gadgets';
import { laneArt } from '../../render/lane';
import { escortLook } from '../../render/escort';

/** the escort's opacity while a rear attack is on its way */
const ESCORT_FADE = 0.4;
import { JuiceFx } from './juice-fx';

export * from '../../render/index';

const NO_BEATS: readonly Beat[] = [];
const REST_KICK = { zoom: 1, shake: 0 } as const;
/** bot runs (?autoplay=1, QA / e2e) never show the one-time tips (they would be used up) — unless ?tips=1 asks */
const QUERY = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const AUTOPLAY = QUERY !== null && QUERY.has('autoplay') && !QUERY.has('tips');
/** keyframes per kick animation (~1 per 12 ms of its 150 ms) */
const KICK_STEPS = 12;
/** prop outline bakes per frame while warming, and the run progress until which warming continues */
const WARM_PER_FRAME = 2;
const WARM_UNTIL = 0.03;

/** a tutorial stop (the frozen world's hand prompt, DOM) is on screen */
const stopUp = (): boolean => typeof document !== 'undefined' && document.querySelector('.tstop') !== null;

/** a transparent canvas laid over the game canvas (same box, no input), or null without a DOM */
function overlayCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || !canvas.parentElement) return null;
  const top = document.createElement('canvas');
  top.className = 'game-overlay';
  top.setAttribute('aria-hidden', 'true');
  Object.assign(top.style, { position: 'absolute', inset: '0', pointerEvents: 'none', display: 'block' });
  canvas.after(top);
  // the kick changes the game canvas's transform every frame: keep it on its own compositor layer
  canvas.style.willChange = 'transform';
  return top;
}
const BLOCKED: number[] = [];
/** per-frame chevron positions of the lane beats ahead (reused) */
const CHEVRONS: { x: number; tu: number }[] = [];
const BEAT: VisibleObstacle[] = [];

/** the hazards of beat `id` on screen (a shared array: read it before the next call) */
function beatOf(snap: RenderSnapshot, id: number): readonly VisibleObstacle[] {
  BEAT.length = 0;
  for (const x of snap.obstacles) if (beatIdOf(x) === id && HAZARD_KINDS.includes(x.kind)) BEAT.push(x);
  return BEAT;
}


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
  prepareBosses(OFFICE_BOSSES.filter((b) => b.stage === run.stageIndex + 1).map((b) => b.slot));
  const events = planEvents(run.beats, run.seed, run.stageIndex);
  const carts = new Map(events.filter((e) => e.kind === 'cart').map((e) => [e.beatIndex, cartProp(run.seed, e.beatIndex, run.stageIndex)]));
  return { beats: run.beats, seed: run.seed, events, carts };
}

const activeAt = (events: readonly OfficeEvent[], kind: OfficeEvent['kind'], t: number): OfficeEvent | null =>
  events.find((e) => e.kind === kind && t >= e.time && t <= e.time + e.duration + 0.2) ?? null;

/** an overlay error is reported once per session */
let overlayWarned = false;

/**
 * An obstacle of the boss's next attack (the hazard beat nearest ahead, matched by beat id) that passes
 * `test`, or undefined.
 */
function attackObstacle(snap: RenderSnapshot, test: (o: VisibleObstacle) => boolean): VisibleObstacle | undefined {
  let beat = -1;
  let best = Number.POSITIVE_INFINITY;
  for (const o of snap.obstacles) {
    if (!HAZARD_KINDS.includes(o.kind) || o.timeUntil < -1e-6 || o.timeUntil >= best) continue;
    best = o.timeUntil;
    beat = beatIdOf(o);
  }
  if (beat < 0) return undefined;
  return snap.obstacles.find((o) => beatIdOf(o) === beat && test(o));
}

const isThrown = (o: VisibleObstacle): boolean => launchFor(o.kind, o.from) !== null;
const isHazard = (o: VisibleObstacle): boolean => HAZARD_KINDS.includes(o.kind);

/** the throw frame for the boss's next attack, when that attack is thrown (not rear / chaser / drop) */
function throwPose(b: BossView, snap: RenderSnapshot): BossPose | null {
  if (b.state === 'defeated') return null;
  // driven by the next hazard beat itself (BossView.attack only starts at ATTACK_LEAD): the wind-up begins
  // as soon as the prop shows in the hand
  const o = attackObstacle(snap, isThrown);
  if (!o) return null;
  const f = bossThrowFrame(o.timeUntil, RELEASE, propVisibleFrom(o.kind));
  if (f > 0) return THROW_FRAMES[f - 1];
  return o.timeUntil > THROW_POSE_END ? 'throw6' : null; // follow-through while it flies
}

const THROW_FRAMES: readonly BossPose[] = ['throw1', 'throw2', 'throw3', 'throw4', 'throw5', 'throw6'];

/** tired once this superior's own gauge is empty (stage 5: per section, so it never carries over) */
function bossPoseFor(b: BossView | null, snap: RenderSnapshot): BossPose {
  if (!b) return 'idle';
  if (b.hp <= 0 || b.state === 'defeated') return 'tired';
  return throwPose(b, snap) ?? (Math.sin(snap.realTime * Math.PI * STEP_HZ) < 0 ? 'idle2' : 'idle');
}

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
  private readonly calloutHold = new CalloutHold();
  /** R4 one-time move tips (a new runner per run) */
  private tips = new TipRunner();

  /**
   * perf r4: the overlay layer (callouts, signs, banners, clock, juice) on its own transparent canvas above the
   * game canvas, so the attack kick zooms the game canvas on the compositor (CSS transform) instead of copying
   * the whole frame onto itself — the overlay stays unzoomed exactly as before. Null without a DOM: then the
   * overlay draws on the game canvas and the kick falls back to the self-copy.
   */
  private readonly top: HTMLCanvasElement | null;
  private readonly topCtx: CanvasRenderingContext2D | null;
  /** the running kick animation on the game canvas (one Web Animation per kick) */
  private kickAnim: Animation | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.inner = createV8Renderer(canvas);
    this.ctx = canvas.getContext('2d');
    this.top = overlayCanvas(canvas);
    this.topCtx = this.top?.getContext('2d') ?? null;
    this.view = computeView(canvas.clientWidth || LOGICAL_W, canvas.clientHeight || LOGICAL_H, 1);
    this.sprites.setScale(this.view.k);
    preloadImages(OFFICE_ART);
    preloadImages(OFFICE_EXTRA_ART);
  }

  /** v8 effects + the office pickup / action juice (v2.1) */
  get fx(): EffectsApi {
    if (!this.fxApi) this.fxApi = this.juice.wrap(this.inner.fx);
    return this.fxApi;
  }

  private readonly juice = new JuiceFx();
  private scan: ReturnType<typeof scanSigns> | null = null;
  private fxApi: EffectsApi | null = null;

  /** the v8 corridor art and the office sprites (sprites give up after ART_TIMEOUT; never rejects) */
  load(onProgress?: (done: number, total: number) => void): Promise<void> {
    return Promise.all([this.inner.load(onProgress), loadImages([...OFFICE_ART, ...OFFICE_EXTRA_ART], ART_TIMEOUT)]).then(() => undefined, () => undefined);
  }

  resize(cssWidth: number, cssHeight: number, dpr: number, safeBottom = 0): void {
    this.inner.resize(cssWidth, cssHeight, dpr, safeBottom);
    this.view = computeView(cssWidth, cssHeight, dpr, safeBottom);
    this.sprites.setScale(this.view.k);
    if (this.top) {
      this.top.width = this.canvas.width;
      this.top.height = this.canvas.height;
      this.top.style.width = this.canvas.style.width;
      this.top.style.height = this.canvas.style.height;
    }
  }

  render(snap: RenderSnapshot): void {
    const run = snap.run;
    if (run && (!this.plan || this.plan.beats !== run.beats || this.plan.seed !== run.seed)) {
      this.plan = planFor(run);
      this.tips = new TipRunner();
    }
    const plan = run ? this.plan : null;
    const fallback = OFFICE_BOSSES.find((b) => b.stage === (run?.stageIndex ?? 0) + 1)?.slot ?? 'warden';
    setPropFrame(snap.boss?.id ?? fallback, run?.seed ?? 1, plan?.carts, run?.stageIndex ?? -1);
    this.feelFrame(snap, run);
    // perf r4: bake the stage's prop outlines during the countdown / intro, not on each prop's first frame
    if (run && (!snap.running || run.progress < WARM_UNTIL || snap.boss?.state === 'intro')) {
      // one hero frame set per frame first (its scans are the biggest), then the prop outlines
      if (!warmHeroSets(snap.skin) && !(this.ctx && warmPopups(this.ctx, this.view.k))) {
        if (this.ctx) warmCallouts(this.ctx, stagePropIds(run.stageIndex));
        warmStep(run.stageIndex, WARM_PER_FRAME);
      }
    }
    setHeroStageProgress(run?.progress ?? 0);
    setHeroShield(snap.shield);
    setLaneSwitchTime(frameLaneSwitch(snap.skin, snap.running));
    // the sign scan runs before the v8 frame so its "!" pass knows which rear hazards get the arrow instead
    this.scan = scanSigns(snap.obstacles);
    // round 2 #9: the judgement popups (drawn inside the v8 frame) clear a callout that starts this frame too
    this.predictCallout(snap);
    // polish P2: the colleague running behind fades while an attack comes from behind (it hid rear props on iPad)
    escortLook.alpha = this.scan.rearHeights.length > 0 ? ESCORT_FADE : 1;
    // during a blackout, record every prop the v8 frame draws (replayed as silhouettes over the darkness)
    const dark = this.blackoutOn(snap, plan);
    if (dark) startPropRecord();
    this.inner.render(snap);
    if (dark) stopPropRecord();
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.topCtx && this.top) {
      this.topCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.topCtx.clearRect(0, 0, this.top.width, this.top.height);
    }
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

  private blackoutOn(snap: RenderSnapshot, plan: Plan | null): boolean {
    if (!snap.running || !plan) return false;
    const e = activeAt(plan.events, 'blackout', snap.time);
    return e !== null && blackoutAlpha(snap.time, e).scene > 0;
  }

  /** v2 feel pack context for the swapped draw modules: throws, pickup sprites, boss pose */
  private feelFrame(snap: RenderSnapshot, run: RenderRun | undefined): void {
    const b = snap.boss;
    setThrowFrame(snap.running && b !== null && b.state !== 'defeated', this.view);
    setFocusLane(visualLane(snap.player));
    // menus / demo without a run: no stale beats for the pickup sprites
    setPickupFrame(run ? run.beats : NO_BEATS, run ? run.stageIndex : 0);
    // F9: the gauge ran out → the superior is overtaken (slides out left, tired); a refilled gauge resets it
    if (b && b.hp <= 0 && this.exitId !== b.id) {
      this.exitId = b.id;
      this.exitAt = snap.realTime;
    }
    if (!b || b.hp > 0) this.exitId = null;
    bossExit.at = b && this.exitId === b.id ? this.exitAt : Number.NEGATIVE_INFINITY;
    setBossPose(bossPoseFor(b, snap));
  }

  private overlay(world: CanvasRenderingContext2D, snap: RenderSnapshot, plan: Plan | null, run: RenderRun | undefined): void {
    const v = this.view;
    const t = snap.time;
    // the untransformed layer: the game canvas's rect moves while it is kicked
    const band = hudBand(this.top ?? this.canvas, v, snap.realTime);
    let ctx = world;
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
    // everything after the kick is the overlay layer (unzoomed by the kick, as before)
    ctx = this.topCtx ?? world;
    ctx.setTransform(v.k, 0, 0, v.k, v.ox * v.dpr, v.oy * v.dpr);
    const events = snap.running && plan ? plan.events : [];
    const lane = visualLane(snap.player);
    const blackout = activeAt(events, 'blackout', t);
    if (blackout) {
      const a = blackoutAlpha(t, blackout);
      // the record overflowed: skip the darkness this frame rather than hide a hazard
      if (a.scene > 0 && !recordOverflowed()) {
        drawBlackout(ctx, v, a.scene);
        // every hazard on screen comes back as a glowing silhouette of its own prop (held, thrown or on path)
        drawRecordedSilhouettes(ctx, a.outline);
        ctx.setTransform(v.k, 0, 0, v.k, v.ox * v.dpr, v.oy * v.dpr);
        drawLaserWarnings(ctx, v, snap.obstacles, snap.realTime, snap.fever, snap.reducedMotion, Math.round(lane));
        drawWarnings(ctx, v, snap.obstacles, lane, snap.realTime, this.sprites, snap.reducedMotion);
      }
    }
    const drill = activeAt(events, 'fire-drill', t);
    const stage = run?.stageIndex ?? 0;
    if (drill) drawFireDrill(ctx, v, t - drill.time, snap.reducedMotion, stage);
    const five = activeAt(events, 'highfive', t);
    if (five) {
      drawColleague(ctx, lane, t - five.time);
      drawHighFive(ctx, v, PLAYER_X, laneY(lane) - snap.player.height * depthScale(lane) - 120, t - five.time, band.top, stage);
    }
    const broadcast = activeAt(events, 'broadcast', t);
    if (broadcast) drawBroadcast(ctx, v, stage);
    setCalloutBottom(Number.NEGATIVE_INFINITY);
    // one callout at a time: the fire-drill banner already says where the attack comes from
    this.bubble(ctx, v, snap, broadcast !== null, Math.max(band.top, band.line), band.countdown, drill !== null);
    const stampAt = snap.mission?.stampAt;
    if (snap.running) this.juice.frame(ctx, v, snap, band);
    if (snap.running) this.signs(ctx, v, snap);
    // R4: the one-time move tip (part 2's first lane hazard, stage 7's first lanejump) — real stage runs only
    if (snap.running && run && snap.mission && !AUTOPLAY) {
      const tip = this.tips.frame(run.stageIndex, snap.obstacles, snap.realTime, overlayState.card || drill !== null || broadcast !== null);
      if (tip) drawMoveTip(ctx, v, tip.id === 'lanejump' ? COPY.tipLanejump : COPY.tipLane2, tip.id === 'lanejump', snap.realTime - this.tips.since, snap.reducedMotion);
    }
    if (stampAt !== undefined && !snap.reducedMotion) drawConfetti(ctx, v, t - stampAt, Math.max(v.y0, band.top));
    if (run && snap.running) drawClock(ctx, v, OFFICE_CLOCK(run.stageIndex, run.progress), clockUrgent(run.stageIndex, run.progress));
    ctx.globalAlpha = 1;
  }

  /** 0.15 s punch-in + shake when a superior starts telegraphing an attack (skipped under reduced motion) */
  private kick(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    const a = snap.boss?.attack ?? null;
    const p = this.prevAttack;
    const started = a !== null && (!p || a.timeUntil > p.timeUntil + 1e-6);
    if (started) this.kickAt = snap.realTime;
    this.prevAttack = a;
    const still = snap.reducedMotion || !snap.running;
    if (this.top && typeof this.canvas.animate === 'function') {
      // the compositor zooms / shakes the game canvas (one animation per kick, no per-frame style write);
      // the overlay canvas above it stays put
      if (still && this.kickAnim) {
        this.kickAnim.cancel();
        this.kickAnim = null;
      }
      if (started && !still) {
        this.kickAnim?.cancel();
        const v = this.view;
        this.kickAnim = this.canvas.animate(kickKeyframes(snap.realTime, v.cssW, v.cssH, v.s, KICK_STEPS), { duration: KICK_TIME * 1000, easing: 'linear' });
      }
      return;
    }
    const k = still ? REST_KICK : surpriseKick(snap.realTime, this.kickAt);
    if (k.zoom === 1 && k.shake === 0) return;
    const c = this.canvas;
    const sx = Math.sin(snap.realTime * 90) * k.shake * this.view.k;
    const sy = Math.cos(snap.realTime * 77) * k.shake * this.view.k;
    const w = c.width * k.zoom;
    const h = c.height * k.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(c, (c.width - w) / 2 + sx, (c.height - h) / 2 + sy, w, h);
  }

  /**
   * One sign per attack (ambiguity audit): a pulsing red arrow at the left edge when the next attack comes from
   * behind, and green chevrons on the lanes a lane attack leaves open.
   */
  private signs(ctx: CanvasRenderingContext2D, v: View, snap: RenderSnapshot): void {
    // every hazard ahead within SIGN_LEAD, not just the nearest beat (a rear attack behind a nearer front one
    // is marked as early as v8's "!", which warnings.ts suppresses for exactly these obstacles)
    const scan = this.scan ?? scanSigns(snap.obstacles);
    const lane = visualLane(snap.player);
    for (const h of scan.rearHeights) rearArrow(ctx, v.x0 + 6, projY(lane, h), snap.realTime, snap.reducedMotion);
    if (scan.drone) {
      // stay low: the dashed purple band at 2단 height in the hero's lane, wherever the drone prop is
      const x = projX(PLAYER_X + Math.max(40, scan.droneTu * 160), lane);
      stayLowBand(ctx, x, projY(lane, BEAM_H[1]), 70 * depthScale(lane), depthScale(lane));
    }
    // safe-lane chevrons for the lane-change beats ahead: where each set goes, then the plan (nearest beat full,
    // later ones faded and never stacked on another set)
    CHEVRONS.length = 0;
    for (const o of scan.laneBeats) {
      const beat = beatIdOf(o);
      let combo = false;
      for (const x of snap.obstacles) if (beatIdOf(x) === beat && HAZARD_KINDS.includes(x.kind) && !x.lanes) combo = true;
      // beside the lane attack itself (its own x on the open lanes), so they never read as a drone / jump sign;
      // a combo beat's full-width prop stands on the open lanes there, so the chevron moves past it
      CHEVRONS.push({ x: safeArrowX(o.kind === 'chaser' ? PLAYER_X + 40 : Math.max(PLAYER_X + 30, fixedX(o.timeUntil)), combo), tu: o.timeUntil });
    }
    for (const p of chevronPlan(CHEVRONS)) {
      const o = scan.laneBeats[p.index];
      const beat = beatIdOf(o);
      BLOCKED.length = 0;
      for (const x of snap.obstacles) if (beatIdOf(x) === beat && x.lanes && HAZARD_KINDS.includes(x.kind)) for (const l of x.lanes) BLOCKED.push(l);
      const x = CHEVRONS[p.index].x;
      const a = p.alpha * Math.min(1, (SIGN_LEAD - o.timeUntil) / 0.3);
      for (const l of safeLanes(BLOCKED)) safeArrow(ctx, projX(x, l), laneY(l), depthScale(l), a);
    }
  }




  /** catchphrase while the superior walks in, exit line once its gauge runs out */
  /** the callout's bottom last time one was drawn (it sits at a near-constant height) */
  private lastCallout = Number.NEGATIVE_INFINITY;

  /** before the v8 frame: a callout about to appear this frame lends the popups its last known bottom */
  private predictCallout(snap: RenderSnapshot): void {
    const band = lastHudBand();
    if (Number.isFinite(band.callout)) {
      this.lastCallout = band.callout;
      return;
    }
    const b = snap.boss;
    if (!b || !snap.running || !b.attack || b.state !== 'fight' || !Number.isFinite(this.lastCallout)) return;
    const o = attackObstacle(snap, isHazard);
    if (o && this.calloutHold.peek(beatIdOf(o), o.timeUntil, snap.realTime)) setCalloutBottom(this.lastCallout);
  }

  private bubble(
    ctx: CanvasRenderingContext2D, v: View, snap: RenderSnapshot, broadcast: boolean, below: number, avoid: Rect | null, noCallout = false,
  ): void {
    const b = snap.boss;
    if (!b || !snap.running) return;
    const who = superiorOnStage(snap.run?.stageIndex ?? -1, b.phase);
    if (!who) return;
    // (exitId / exitAt are tracked in feelFrame)
    let text: string | null = null;
    if (this.exitId === b.id && snap.realTime - this.exitAt < EXIT_LINE_TIME) text = who.exitLine;
    // the mission card already quotes the superior's line, and a tutorial stop's prompt owns the screen:
    // no catchphrase bubble meanwhile
    else if (b.state === 'intro' && !overlayState.card && !stopUp()) text = who.catchphrase;
    else if (broadcast) text = broadcastLine(snap.run?.stageIndex ?? 0);
    if (text && broadcast && text !== who.exitLine) text = broadcastLine(snap.run?.stageIndex ?? 0);
    if (text) {
      setCalloutBottom(drawBossBubble(ctx, v, text, below, avoid));
      return;
    }
    // F10: the attack telegraph as a callout — prop icon, action colour, attack name
    const a = b.attack;
    if (noCallout || !a || b.state !== 'fight') return;
    const o = attackObstacle(snap, isHazard);
    // starts ≥ CALLOUT_END before its beat, then holds ≥ CALLOUT_MIN (dense stages no longer flash it)
    if (!o || !this.calloutHold.show(beatIdOf(o), o.timeUntil, snap.realTime)) return;
    // the whole beat's moves: 「뒤에서! 옆으로! + 숙여!」 for a lane + rear head-height combo
    const hint = beatHint(beatOf(snap, beatIdOf(o)));
    setCalloutBottom(drawAttackCallout(ctx, v, propImage(o), propIdFor(o), actionCue(o.kind), hint, below, avoid));
  }
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  laneArt.pickup = laneCollectibleArt;
  return new OfficeRenderer(canvas);
}

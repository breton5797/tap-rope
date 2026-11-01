// Office v2.1: when the pickup / action FX fire. The office renderer hands the game a wrapped EffectsApi: every
// call goes to the v8 effects unchanged and is also queued here (coin / power-up pickups, jump / boost / land /
// lane / slide impacts); the next overlay frame turns the queue into juice at the hero's position. Shield,
// slow-mo and the mission counter are read from the snapshot (on/off edges). Nothing is allocated per frame.
import type { BurstKind as V8BurstKind, EffectsApi, ImpactKind, ImpactOpts, PopupStyle, RenderSnapshot } from '../../types';
import { depthScale, laneY, visualLane } from '../../render/layout';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';
import { PLAYER_X } from '../../types';
import { collectibleFor, stageCollectible } from './collectibles';
import { officeImage } from './images';
import { JUMP_RING_COLORS, Juice, pickupFromPopup, takeoffRing, type PowerUp } from './juice';

type Cue =
  | { kind: 'coin' } | { kind: 'power'; what: PowerUp } | { kind: 'jump'; level: number } | { kind: 'land' }
  | { kind: 'lane'; dir: number } | { kind: 'slide' };

const QUEUE = 16;
/** a frame gap longer than this (s of real time) is a pause / menu: start fresh */
const STALE = 0.5;
const COLLECT_COLOR = '#2FD2A0';
const COIN_COLOR = '#FFD54A';
const SPARKLE_RATE = 30; // per second while a 3단 jump is in the air
const HEEL_RATE = 18; // per second while sliding

export interface HudTargets {
  /** logical points of the coin counter and the mission chip (NaN when not on screen) */
  readonly coin: { x: number; y: number };
  readonly chip: { x: number; y: number };
}

export class JuiceFx {
  private readonly juice = new Juice();
  private readonly queue: Cue[] = [];
  private lastReal = Number.NaN;
  private prevShield = false;
  private prevMission = { index: -1, value: 0, complete: false };
  private sparkleAcc = 0;
  private heelAcc = 0;
  private readonly hero = { x: 0, y: 0 };
  private readonly plus = { text: '', x: 0, y: 0, age: 9 };

  /** the EffectsApi the game talks to: v8 effects + this queue */
  wrap(inner: EffectsApi): EffectsApi {
    const push = (c: Cue) => {
      if (this.queue.length < QUEUE) this.queue.push(c);
    };
    return {
      burst: (kind: V8BurstKind, x?: number, y?: number) => {
        if (kind === 'coin') push({ kind: 'coin' });
        if (kind === 'dust') return; // the grey v8 landing dust read as a hit; the hero painter draws a light one
        inner.burst(kind, x, y);
      },
      popup: (text: string, style: PopupStyle) => {
        const what = pickupFromPopup(text);
        if (what) push({ kind: 'power', what });
        inner.popup(text, style);
      },
      shake: (i: number) => inner.shake(i),
      flash: (c: string) => inner.flash(c),
      impact: (kind: ImpactKind, opts?: ImpactOpts) => {
        if (kind === 'jump' || kind === 'boost') push({ kind: 'jump', level: opts?.level ?? 1 });
        else if (kind === 'land') push({ kind: 'land' });
        else if (kind === 'lane') push({ kind: 'lane', dir: opts?.dir ?? 1 });
        else if (kind === 'slide') push({ kind: 'slide' });
        inner.impact(kind, opts);
      },
      update: (dt: number) => inner.update(dt),
    };
  }

  /** advance and draw (logical transform set by the caller) */
  frame(ctx: Ctx, v: View, snap: RenderSnapshot, hud: HudTargets): void {
    const gap = snap.realTime - this.lastReal;
    const run = snap.run;
    // a new run (retry / quit) or a long pause: old edges and queued cues belong to another moment
    const newRun = run?.seed !== this.runSeed || run?.stageIndex !== this.runStage;
    if (!Number.isFinite(gap) || gap > STALE || gap < 0 || newRun) {
      // a hitch / pause keeps the queued cues (a coin picked just before it still sparkles); a new run drops them
      this.reset(snap, newRun && Number.isFinite(this.lastReal));
    }
    const dt = Number.isFinite(gap) && gap <= STALE ? Math.min(0.1, Math.max(0, gap)) : 0;
    this.lastReal = snap.realTime;
    const reduced = snap.reducedMotion;
    const p = snap.player;
    const lane = visualLane(p);
    this.hero.x = PLAYER_X;
    this.hero.y = laneY(lane) - p.height * depthScale(lane);
    const floorY = laneY(lane);
    this.lastHud = hud;
    const collecting = snap.mission?.kind === 'collect';
    for (const c of this.queue) this.cue(c, floorY, hud, reduced, collecting);
    this.queue.length = 0;
    this.edges(snap, hud, reduced);
    this.streams(snap, dt, floorY, reduced);
    this.juice.update(dt);
    this.aura(ctx, v, snap);
    this.juice.draw(ctx, officeImage);
    this.drawPlus(ctx, dt);
  }

  private runSeed: number | undefined = undefined;
  private runStage: number | undefined = undefined;

  /** forget edges and live FX (and the queued cues, unless this is the very first frame); the snapshot is the new baseline */
  private reset(snap: RenderSnapshot, dropQueue: boolean): void {
    if (dropQueue) this.queue.length = 0;
    this.juice.clear();
    this.prevShield = snap.shield;
    const m = snap.mission;
    this.prevMission.index = m ? m.index : -1;
    this.prevMission.value = m ? m.value : 0;
    this.prevMission.complete = m ? m.complete : false;
    this.sparkleAcc = 0;
    this.heelAcc = 0;
    this.plus.age = 9;
    this.pulse.age = 9;
    this.runSeed = snap.run?.seed;
    this.runStage = snap.run?.stageIndex;
  }

  private cue(c: Cue, floorY: number, hud: HudTargets, reduced: boolean, collecting: boolean): void {
    const { x, y } = this.hero;
    switch (c.kind) {
      case 'coin':
        // a bright gold ring + white flash on the coin; in a collect section the mission edge flies the icon
        this.juice.burst('coin', x, y - 40, reduced);
        this.juice.ring(x, y - 40, 20, 3, 0.3, COIN_COLOR);
        this.flashAt(x, y - 40);
        if (collecting) this.pulseAt(hud.coin, COIN_COLOR);
        else if (Number.isFinite(hud.coin.x)) this.juice.fly('pickup-coin', { x, y: y - 40 }, hud.coin, 'coin', this.onCoin);
        return;
      case 'power':
        if (c.what === 'heart') this.juice.burst('heart', x, y - 50, reduced);
        // slow (iced coffee) is frost, never hearts (hearts are the heal only)
        else this.juice.burst(c.what === 'shield' ? 'pop' : 'frost', x, y - 45, reduced);
        return;
      case 'jump': {
        const level = Math.min(3, Math.max(1, c.level));
        const r = takeoffRing(level);
        // one ring per level, each a beat later and wider: white, cyan, gold
        for (let i = 0; i < level; i++) this.juice.ring(x, floorY, r.radius * (1 + i * 0.35), r.width + 0.6, r.life, JUMP_RING_COLORS[i], i * 0.07);
        if (level >= 3) this.juice.burst('sparkle', x, floorY - 10, reduced);
        return;
      }
      case 'land':
        return; // the hero painter draws the (small, light) landing dust
      case 'lane':
        if (!reduced) this.juice.burst('streak', x - 18, y - 40, reduced, -c.dir);
        return;
      case 'slide':
        this.juice.burst('heel', x - 14, floorY - 2, reduced);
    }
  }

  private readonly onCoin = (): void => this.pulseAt(this.lastHud.coin, COIN_COLOR);
  private readonly onChip = (): void => this.pulseAt(this.lastHud.chip, COLLECT_COLOR);
  private lastHud: HudTargets = { coin: { x: Number.NaN, y: Number.NaN }, chip: { x: Number.NaN, y: Number.NaN } };
  private readonly pulse = { x: 0, y: 0, age: 9, color: COIN_COLOR };
  private readonly flash = { x: 0, y: 0, age: 9 };

  /** the counter the icon reached pulses (a 1.2× ring over it) */
  private pulseAt(p: { x: number; y: number }, color: string): void {
    if (!Number.isFinite(p.x)) return;
    this.pulse.x = p.x;
    this.pulse.y = p.y;
    this.pulse.age = 0;
    this.pulse.color = color;
  }

  private flashAt(x: number, y: number): void {
    this.flash.x = x;
    this.flash.y = y;
    this.flash.age = 0;
  }

  /** snapshot edges: shield on/off (pop), mission collectible counter (+1, star burst on the target) */
  private edges(snap: RenderSnapshot, hud: HudTargets, reduced: boolean): void {
    const { x, y } = this.hero;
    if (this.prevShield && !snap.shield) {
      this.juice.burst('pop', x, y - 45, reduced);
      this.juice.ring(x, y - 45, 34, 2.5, 0.3);
    }
    this.prevShield = snap.shield;
    const m = snap.mission;
    const pm = this.prevMission;
    if (!m) {
      pm.index = -1;
      return;
    }
    if (m.index === pm.index && m.kind === 'collect' && m.value > pm.value) {
      // a collect mission always flies its collectible (never the clock coin)
      const id = collectibleFor(snap.run?.stageIndex ?? 0, m.index) ?? stageCollectible(snap.run?.stageIndex ?? 0);
      this.juice.burst('coin', x, y - 40, reduced);
      if (Number.isFinite(hud.chip.x)) this.juice.fly(id ? `collect-${id}` : 'pickup-coin', { x, y: y - 40 }, hud.chip, 'chip', this.onChip);
      this.plus.text = '+1';
      this.plus.x = x + 22;
      this.plus.y = y - 76;
      this.plus.age = 0;
      if (m.complete && !pm.complete) this.juice.burst('star', x, y - 60, reduced);
    }
    pm.index = m.index;
    pm.value = m.value;
    pm.complete = m.complete;
  }

  /** continuous: 3단 sparkle trail, heel sparks while sliding */
  private streams(snap: RenderSnapshot, dt: number, floorY: number, reduced: boolean): void {
    const p = snap.player;
    const { x, y } = this.hero;
    if (!p.grounded && p.level >= 3 && !reduced) {
      this.sparkleAcc += dt * SPARKLE_RATE;
      for (; this.sparkleAcc >= 1; this.sparkleAcc--) this.juice.burst('sparkle', x - 10, y - 30, reduced);
    } else this.sparkleAcc = 0;
    if (p.sliding && !reduced) {
      this.heelAcc += dt * HEEL_RATE;
      for (; this.heelAcc >= 1; this.heelAcc--) this.juice.burst('heel', x - 6, floorY - 2, reduced);
    } else this.heelAcc = 0;
  }

  /** shield bubble around the hero, iced-coffee tint + cup pulse while slowed */
  private aura(ctx: Ctx, v: View, snap: RenderSnapshot): void {
    const { x, y } = this.hero;
    const t = snap.realTime;
    if (snap.shield) {
      const pulse = snap.reducedMotion ? 0 : Math.sin(t * 5) * 2;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#9BE7FF';
      ctx.beginPath();
      ctx.ellipse(x, y - 46, 34 + pulse, 50 + pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#7FDBFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (snap.slowMo) {
      ctx.save();
      ctx.fillStyle = this.iceTint(ctx, v);
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      const cup = officeImage('pickup-slow');
      if (cup) {
        const s = 22 * (1 + (snap.reducedMotion ? 0 : 0.12 * Math.sin(t * 8)));
        ctx.drawImage(cup, x + 20, y - 112, s, s);
      }
      ctx.restore();
    }
  }

  /** the slow-mo ice vignette, built once per view */
  private ice: { key: string; g: CanvasGradient } | null = null;

  private iceTint(ctx: Ctx, v: View): CanvasGradient {
    if (!this.ice || this.ice.key !== v.key) {
      const cx = v.x0 + v.w / 2;
      const cy = v.y0 + v.h / 2;
      const g = ctx.createRadialGradient(cx, cy, Math.min(v.w, v.h) * 0.35, cx, cy, Math.max(v.w, v.h) * 0.7);
      g.addColorStop(0, 'rgba(150,215,255,0)');
      g.addColorStop(1, 'rgba(150,215,255,0.35)');
      this.ice = { key: v.key, g };
    }
    return this.ice.g;
  }

  private drawPlus(ctx: Ctx, dt: number): void {
    this.drawPulse(ctx, dt);
    const p = this.plus;
    if (p.age > 0.8) return;
    p.age += dt;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p.age / 0.8);
    ctx.font = '900 29px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2E2433';
    ctx.strokeText(p.text, p.x, p.y - p.age * 30);
    ctx.fillStyle = COLLECT_COLOR;
    ctx.fillText(p.text, p.x, p.y - p.age * 30);
    ctx.restore();
  }

  /** the counter pulse (0.3 s, up to 1.2× a 16 px ring) and the white flash on a coin (0.12 s) */
  private drawPulse(ctx: Ctx, dt: number): void {
    const q = this.pulse;
    if (q.age < 0.3) {
      q.age += dt;
      const k = Math.min(1, q.age / 0.3);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = q.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 16 * (1 + 0.2 * Math.sin(k * Math.PI)) + 6 * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const f = this.flash;
    if (f.age < 0.12) {
      f.age += dt;
      ctx.save();
      ctx.globalAlpha = 0.85 * (1 - f.age / 0.12);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

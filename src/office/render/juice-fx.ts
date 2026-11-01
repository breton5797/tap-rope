// Office v2.1: when the pickup / action FX fire. The office renderer hands the game a wrapped EffectsApi: every
// call goes to the v8 effects unchanged and is also queued here (coin / power-up pickups, jump / boost / land /
// lane / slide impacts); the next overlay frame turns the queue into juice at the hero's position. Shield,
// slow-mo and the mission counter are read from the snapshot (on/off edges). Nothing is allocated per frame.
import type { BurstKind as V8BurstKind, EffectsApi, ImpactKind, ImpactOpts, PopupStyle, RenderSnapshot } from '../../types';
import { depthScale, laneY, visualLane } from '../../render/layout';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';
import { PLAYER_X } from '../../types';
import { collectibleFor } from './collectibles';
import { officeImage } from './images';
import { Juice, pickupFromPopup, takeoffRing, type PowerUp } from './juice';

type Cue =
  | { kind: 'coin' } | { kind: 'power'; what: PowerUp } | { kind: 'jump'; level: number } | { kind: 'land' }
  | { kind: 'lane'; dir: number } | { kind: 'slide' };

const QUEUE = 16;
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
    const dt = Number.isFinite(this.lastReal) ? Math.min(0.1, Math.max(0, snap.realTime - this.lastReal)) : 0;
    this.lastReal = snap.realTime;
    const reduced = snap.reducedMotion;
    const p = snap.player;
    const lane = visualLane(p);
    this.hero.x = PLAYER_X;
    this.hero.y = laneY(lane) - p.height * depthScale(lane);
    const floorY = laneY(lane);
    for (const c of this.queue) this.cue(c, floorY, hud, reduced);
    this.queue.length = 0;
    this.edges(snap, hud, reduced);
    this.streams(snap, dt, floorY, reduced);
    this.juice.update(dt);
    this.aura(ctx, v, snap);
    this.juice.draw(ctx, officeImage);
    this.drawPlus(ctx, dt);
  }

  private cue(c: Cue, floorY: number, hud: HudTargets, reduced: boolean): void {
    const { x, y } = this.hero;
    switch (c.kind) {
      case 'coin':
        this.juice.burst('coin', x, y - 40, reduced);
        if (Number.isFinite(hud.coin.x)) this.juice.fly('pickup-coin', { x, y: y - 40 }, hud.coin, 'coin', null);
        return;
      case 'power':
        if (c.what === 'heart') this.juice.burst('heart', x, y - 50, reduced);
        else this.juice.burst(c.what === 'shield' ? 'pop' : 'sparkle', x, y - 45, reduced);
        return;
      case 'jump': {
        const r = takeoffRing(c.level);
        this.juice.ring(x, floorY, r.radius, r.width, r.life);
        return;
      }
      case 'land':
        return; // the hero painter draws the (small, white) landing dust
      case 'lane':
        if (!reduced) this.juice.burst('streak', x - 18, y - 40, reduced, -c.dir);
        return;
      case 'slide':
        this.juice.burst('heel', x - 8, floorY - 2, reduced);
    }
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
      const id = collectibleFor(snap.run?.stageIndex ?? 0, m.index);
      if (Number.isFinite(hud.chip.x)) this.juice.fly(id ? `collect-${id}` : 'pickup-coin', { x, y: y - 40 }, hud.chip, 'chip', null);
      this.plus.text = '+1';
      this.plus.x = x + 18;
      this.plus.y = y - 70;
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
    const p = this.plus;
    if (p.age > 0.8) return;
    p.age += dt;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p.age / 0.8);
    ctx.font = '900 18px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2E2433';
    ctx.strokeText(p.text, p.x, p.y - p.age * 30);
    ctx.fillStyle = '#FFE45C';
    ctx.fillText(p.text, p.x, p.y - p.age * 30);
    ctx.restore();
  }
}

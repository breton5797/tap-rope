// Pooled particles (dust, sparks), impact rings, text popups, screen shake, flash and the hit
// timer the post pass uses for its red hit edge (GDD-v6 §4). No stars or confetti.
// v7.1 (GDD-v7.1 §3): agent impacts layer floor shockwaves, hot sparks, debris, shield shards,
// speed lines and glints on top (tuning in impact.ts, rings / streaks / glints in impact-fx.ts).
import { GROUND_Y, PLAYER_X, type BurstKind, type EffectsApi, type ImpactKind, type ImpactOpts, type PopupStyle } from '../types';
import { cueAge, pushCue, tickCues } from './cues';
import { planImpact, RingShape, scalePlan, slideActive, SLIDE_FX, sprayAngle, zoneOffset, type ImpactPlan } from './impact';
import { hexPath, ImpactLayer } from './impact-fx';
import { drawPopups, PopupPool } from './popups';
import { ZapPool } from './zaps';
import { clamp, TAU, type Ctx } from './util';
import type { View } from './view';

const CAP = 300;
const RING_CAP = 12;
/** Puff = soft dust; Spark = short additive streak along its velocity; Hot = thick bright streak;
 * Chunk = tumbling debris; Hex = spinning shield shard */
const Shape = { Puff: 0, Spark: 1, Hot: 2, Chunk: 3, Hex: 4 } as const;

const COLORS = ['#FFFFFF', '#FFD08A', '#FFB020', '#FF2A3A', '#FF8A3A', '#3FE0D0', '#8A857E', '#C8CED4', '#8FEAFF', '#3A3F46'];
const C = { white: 0, pale: 1, amber: 2, red: 3, orange: 4, teal: 5, dust: 6, steel: 7, cyan: 8, dark: 9 } as const;
const DUST_RING = '#D8D2C4';

export class Effects implements EffectsApi {
  reduced = false;
  /** screen position of the player's feet, updated by the renderer */
  anchorX = PLAYER_X;
  feetY = GROUND_Y;
  /** px from the feet up to the body centre */
  bodyLift = 34;
  /** where a full-width laser at the agent crosses its lane this frame (x < 0 = none) */
  contactX = -1;
  /** v8 (A5) cosmetics: landing-ring colour, null = default dust */
  landRing: string | null = null;
  contactY = 0;
  private n = 0;
  private readonly px = new Float32Array(CAP);
  private readonly py = new Float32Array(CAP);
  private readonly vx = new Float32Array(CAP);
  private readonly vy = new Float32Array(CAP);
  private readonly life = new Float32Array(CAP);
  private readonly max = new Float32Array(CAP);
  private readonly size = new Float32Array(CAP);
  private readonly rot = new Float32Array(CAP);
  private readonly vr = new Float32Array(CAP);
  private readonly grav = new Float32Array(CAP);
  private readonly shape = new Uint8Array(CAP);
  private readonly color = new Uint8Array(CAP);
  private readonly ring = new Float32Array(RING_CAP * 4); // x, y, age, maxR
  private readonly ringColor = new Uint8Array(RING_CAP);
  private ringNext = 0;
  private readonly popups = new PopupPool();
  private readonly zaps = new ZapPool();
  private shakeAmp = 0;
  private clock = 0;
  private flashColor = '#FFFFFF';
  private flashAlpha = 0;
  private readonly layer = new ImpactLayer();
  private slideSparks = 0;
  private slideDust = 0;

  burst(kind: BurstKind, x?: number, y?: number): void {
    const feetY = this.feetY;
    const bx = x ?? this.anchorX;
    const by = y ?? (kind === 'dust' ? feetY : feetY - this.bodyLift);
    const k = this.reduced ? 0.4 : 1;
    switch (kind) {
      case 'dust': return this.dust(bx, by, k);
      case 'sparkle': return this.radial(bx, by, Math.round(6 * k), Shape.Spark, C.teal, C.white, 80, 160, 0.3);
      case 'coin':
        this.ringAt(bx, by, 18, C.amber);
        return this.radial(bx, by, Math.round(6 * k), Shape.Spark, C.amber, C.pale, 60, 140, 0.3);
      case 'hit': {
        // sparks fly where the laser crosses the agent's lane (if one is there), else at the body
        const hx = x === undefined && this.contactX >= 0 ? this.contactX : bx;
        const hy = x === undefined && this.contactX >= 0 ? this.contactY : by;
        this.zaps.add(hx, hy);
        this.hitAge = 0;
        // a light full-screen tint only: the red edge (post.hitEdge) carries the hit (half with reduced motion)
        this.flashColor = '#FF2A3A';
        this.flashAlpha = Math.max(this.flashAlpha, this.reduced ? 0.06 : 0.12);
        this.ringAt(hx, hy, 30, C.red);
        return this.radial(hx, hy, Math.round(16 * k), Shape.Spark, C.orange, C.pale, 160, 360, 0.35, 500);
      }
      case 'powerup':
        this.ringAt(bx, by, 36, C.teal);
        return this.radial(bx, by, Math.round(10 * k), Shape.Spark, C.teal, C.white, 60, 140, 0.45, -60);
      case 'confetti': return this.shower(bx, by, Math.round(26 * k));
    }
  }

  /** seconds since the last hit burst (drives the post pass's red hit edge) */
  hitAge = 9;

  popup(text: string, style: PopupStyle): void {
    this.popups.add(text, style, this.feetY - 80);
  }

  shake(intensity: number): void {
    if (this.reduced) return;
    this.shakeAmp = Math.max(this.shakeAmp, clamp(intensity, 0, 1) * 9);
  }

  /** reduced motion: the same flash at half strength */
  flash(color: string): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, this.reduced ? 0.15 : 0.3);
  }

  /** v7.1: records the cue for the rig, then layers the impact's particles / rings / glints (GDD-v7.1 §3) */
  impact(kind: ImpactKind, opts: ImpactOpts = {}): void {
    pushCue(kind, opts);
    const p = scalePlan(planImpact(kind, opts), this.reduced);
    this.layer.intensity = this.reduced ? 0.5 : 1;
    if (p.shake > 0) this.shake(p.shake);
    switch (kind) {
      case 'jump': case 'boost': case 'land': case 'slide': return this.footImpact(kind, p, opts.level ?? 1);
      case 'lane': case 'bump': return this.sideImpact(kind, p, opts.dir ?? 1);
      case 'pass': case 'graze': return this.clearImpact(kind, p, opts.zone);
      case 'hit': case 'shield': return this.bodyImpact(kind, p);
    }
  }

  update(dt: number): void {
    const d = clamp(dt, 0, 0.1);
    tickCues(d);
    this.clock += d;
    this.hitAge += d;
    this.shakeAmp *= Math.exp(-d * 9);
    if (this.shakeAmp < 0.05) this.shakeAmp = 0;
    this.flashAlpha = Math.max(0, this.flashAlpha - d * 2.6);
    this.popups.update(d);
    this.stepParticles(d);
    for (let i = 0; i < RING_CAP; i++) this.ring[i * 4 + 2] += d;
    this.zaps.update(d);
    this.layer.update(d);
    this.slideStream(d);
  }

  shakeX(): number {
    return this.shakeAmp * Math.sin(this.clock * 73);
  }

  shakeY(): number {
    return this.shakeAmp * Math.cos(this.clock * 61);
  }

  drawWorld(ctx: Ctx): void {
    this.layer.drawUnder(ctx);
    this.drawRings(ctx);
    this.zaps.draw(ctx);
    this.drawParticles(ctx);
    this.layer.drawOver(ctx);
    drawPopups(ctx, this.popups);
  }

  drawFlash(ctx: Ctx, v: View): void {
    if (this.flashAlpha <= 0) return;
    ctx.globalAlpha = this.flashAlpha;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  /** jump / boost / land / slide: everything happens at the feet */
  private footImpact(kind: ImpactKind, p: ImpactPlan, level: number): void {
    const x = this.anchorX;
    const y = this.feetY;
    if (p.ring > 0) {
      const color = kind === 'boost' ? (level >= 3 ? '#BFF4FF' : '#FFB020') : kind === 'land' && this.landRing ? this.landRing : DUST_RING;
      this.layer.ring(x, y + 1, p.ring, p.ringWidth, p.ringLife, RingShape.Ground, color);
      if (p.echo > 0) this.layer.ring(x, y + 1, p.ring * 0.62, p.ringWidth * 0.7, p.ringLife, RingShape.Ground, '#FFFFFF', p.echo);
    }
    this.fan(x, y, p.dust, p.speed);
    if (kind === 'boost') {
      // thruster flare: hot sparks shooting down and back from the feet
      for (let i = 0; i < p.sparks; i++) {
        const a = Math.PI * 0.5 + 0.35 + (Math.random() - 0.5) * 1.1;
        const sp = p.speed * (0.5 + Math.random() * 0.6);
        const c = level >= 3 ? (i % 3 === 0 ? C.cyan : C.white) : i % 3 === 0 ? C.pale : C.amber;
        this.spawn(x + (Math.random() - 0.5) * 8, y - 4, Math.cos(a) * sp, Math.sin(a) * sp, 0.22 + Math.random() * 0.14, 1.8 + level * 0.4, Shape.Hot, c, 0);
      }
      if (p.glint > 0) this.layer.glint(x, y - 2, p.glint, '#E8FBFF');
      return;
    }
    // landing grit (level 3) / slide start: low sparks skidding out along the floor
    for (let i = 0; i < p.sparks; i++) {
      const dir = kind === 'slide' ? -1 : i % 2 === 0 ? -1 : 1;
      const sp = p.speed * (0.5 + Math.random() * 0.6);
      this.spawn(x + dir * 6, y - 1, dir * sp, -40 - Math.random() * 120, 0.25 + Math.random() * 0.15, 1.6 + Math.random(), Shape.Hot, i % 2 ? C.amber : C.pale, 700);
    }
  }

  /** lane change: speed lines along the move; bump: sparks against the edge it pushed into */
  private sideImpact(kind: ImpactKind, p: ImpactPlan, dir: -1 | 1): void {
    const x = this.anchorX;
    const y = this.feetY;
    if (kind === 'lane') {
      if (p.streaks > 0) this.layer.streaks(x, y, dir, p.streaks, this.bodyLift * 2);
      this.fan(x, y, p.dust, p.speed);
      return;
    }
    const ey = y - this.bodyLift + dir * 14;
    this.layer.ring(x, ey, p.ring, p.ringWidth, p.ringLife, RingShape.Round, '#FFD08A');
    this.spray(x, ey, p.sparks, dir < 0 ? -Math.PI / 2 : Math.PI / 2, 1.2, p.speed, Shape.Spark, C.pale, C.amber, 300);
    this.fan(x, y, p.dust, 60);
  }

  /** pass: a small spark where the obstacle went by; graze: a bright spray + glint where it skimmed the agent */
  private clearImpact(kind: ImpactKind, p: ImpactPlan, zone: ImpactOpts['zone']): void {
    const [ox, oy] = zoneOffset(zone, this.bodyLift);
    const useContact = zone !== 'side' && this.contactX >= 0;
    const x = useContact ? this.contactX : this.anchorX + ox;
    const y = useContact ? this.contactY : this.feetY + oy;
    const a = sprayAngle(zone);
    if (kind === 'pass') return this.spray(x, y, p.sparks, a, 1.4, p.speed, Shape.Spark, C.amber, C.pale, 300);
    this.spray(x, y, p.sparks, a, 1.3, p.speed, Shape.Hot, C.pale, C.orange, 500);
    this.spray(x, y, Math.round(p.sparks / 3), a + Math.PI, 0.8, p.speed * 0.5, Shape.Spark, C.red, C.white, 300);
    this.layer.ring(x, y, p.ring, p.ringWidth, p.ringLife, RingShape.Round, '#FF8A6A');
    this.layer.glint(x, y, p.glint, '#FFFFFF');
  }

  /** hit: debris + a big discharge over the body; shield: cyan hexagon shards + hex ring */
  private bodyImpact(kind: ImpactKind, p: ImpactPlan): void {
    const x = this.anchorX;
    const y = this.feetY - this.bodyLift;
    if (kind === 'hit') {
      this.hitAge = 0;
      this.zaps.add(x, y, 1.6);
      this.layer.ring(x, y, p.ring, p.ringWidth, p.ringLife, RingShape.Round, '#FF4A55');
      this.spray(x, y, p.debris, -Math.PI / 2, 2.6, p.speed * 0.8, Shape.Chunk, C.dark, C.steel, 900);
      this.spray(x, y, p.sparks, -Math.PI * 0.75, 2.2, p.speed, Shape.Hot, C.orange, C.white, 600);
      return;
    }
    this.layer.ring(x, y, p.ring, p.ringWidth, p.ringLife, RingShape.Hex, '#8FEAFF');
    if (p.echo > 0) this.layer.ring(x, y, p.ring * 1.35, p.ringWidth * 0.6, p.ringLife, RingShape.Hex, '#E8FBFF', p.echo);
    this.radial(x, y, p.shards, Shape.Hex, C.cyan, C.white, p.speed * 0.6, p.speed, 0.5, 260);
    this.layer.glint(x, y, p.glint, '#BFF4FF');
  }

  /** continuous floor friction while sliding: a spark stream and a dust tail behind the feet */
  private slideStream(d: number): void {
    if (!slideActive(cueAge('slide'), cueAge('jump'), cueAge('boost'), cueAge('hit'))) {
      this.slideSparks = 0;
      this.slideDust = 0;
      return;
    }
    const rate = this.reduced ? 0.4 : 1;
    const x = this.anchorX;
    const y = this.feetY;
    this.slideSparks += d * SLIDE_FX.sparksPerSec * rate;
    for (; this.slideSparks >= 1; this.slideSparks--) {
      const sp = 220 + Math.random() * 260;
      const c = Math.random() < 0.3 ? C.pale : Math.random() < 0.5 ? C.amber : C.orange;
      this.spawn(x - 4 + Math.random() * 12, y - 1, -sp, -30 - Math.random() * 150, 0.2 + Math.random() * 0.18, 1.4 + Math.random() * 1.2, Shape.Hot, c, 900);
    }
    this.slideDust += d * SLIDE_FX.dustPerSec * rate;
    for (; this.slideDust >= 1; this.slideDust--) {
      this.spawn(x - 10 - Math.random() * 8, y - 3, -140 - Math.random() * 120, -8 - Math.random() * 30, 0.4 + Math.random() * 0.2, 4 + Math.random() * 3, Shape.Puff, C.dust, -30);
    }
  }

  /** a flat fan of dust along the floor, both ways */
  private fan(x: number, y: number, n: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      const sp = speed * (0.45 + Math.random() * 0.75);
      this.spawn(x + dir * (3 + Math.random() * 8), y - 2, dir * sp, -6 - Math.random() * 30, 0.4 + Math.random() * 0.25, 3 + Math.random() * 3.5, Shape.Puff, C.dust, -20);
    }
  }

  /** a cone of particles around `angle` (± spread / 2) */
  private spray(x: number, y: number, n: number, angle: number, spread: number, speed: number, shape: number, c1: number, c2: number, g: number): void {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.45 + Math.random() * 0.75);
      const size = shape === Shape.Chunk ? 2 + Math.random() * 3 : 1.6 + Math.random() * 1.4;
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.28 + Math.random() * 0.22, size, shape, i % 3 === 0 ? c2 : c1, g);
    }
  }

  private dust(x: number, y: number, k: number): void {
    const n = Math.round(9 * k);
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      this.spawn(x + dir * (4 + Math.random() * 6), y - 2, dir * (40 + Math.random() * 90), -10 - Math.random() * 40, 0.45 + Math.random() * 0.2, 3 + Math.random() * 3, Shape.Puff, C.dust, -30);
    }
  }

  private radial(x: number, y: number, n: number, shape: number, c1: number, c2: number, s0: number, s1: number, life: number, g = 0): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.4;
      const sp = s0 + Math.random() * (s1 - s0);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, life * (0.7 + Math.random() * 0.5), 2 + Math.random() * 3, shape, i % 3 === 0 ? c2 : c1, g);
    }
  }

  /** Clear / celebration: a restrained shower of amber and teal sparks rising and falling. */
  private shower(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 180 + Math.random() * 220;
      this.spawn(x + (Math.random() - 0.5) * 50, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.8 + Math.random() * 0.5, 2, Shape.Spark, i % 2 ? C.amber : C.teal, 420);
    }
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, shape: number, color: number, g: number): void {
    const i = this.n < CAP ? this.n++ : Math.floor(Math.random() * CAP);
    this.px[i] = x;
    this.py[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.rot[i] = Math.random() * TAU;
    this.vr[i] = (Math.random() - 0.5) * 14;
    this.grav[i] = g;
    this.shape[i] = shape;
    this.color[i] = color;
  }

  private ringAt(x: number, y: number, r: number, color: number): void {
    const i = this.ringNext;
    this.ringNext = (i + 1) % RING_CAP;
    this.ring[i * 4] = x;
    this.ring[i * 4 + 1] = y;
    this.ring[i * 4 + 2] = 0;
    this.ring[i * 4 + 3] = r;
    this.ringColor[i] = color;
  }

  private stepParticles(d: number): void {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= d;
      if (this.life[i] <= 0) {
        this.n--;
        this.copy(this.n, i);
        continue;
      }
      this.vy[i] += this.grav[i] * d;
      const drag = this.shape[i] === Shape.Puff ? Math.exp(-d * 4) : Math.exp(-d * 1.2);
      this.vx[i] *= drag;
      this.vy[i] *= drag;
      this.px[i] += this.vx[i] * d;
      this.py[i] += this.vy[i] * d;
      this.rot[i] += this.vr[i] * d;
      i++;
    }
  }

  private copy(from: number, to: number): void {
    this.px[to] = this.px[from];
    this.py[to] = this.py[from];
    this.vx[to] = this.vx[from];
    this.vy[to] = this.vy[from];
    this.life[to] = this.life[from];
    this.max[to] = this.max[from];
    this.size[to] = this.size[from];
    this.rot[to] = this.rot[from];
    this.vr[to] = this.vr[from];
    this.grav[to] = this.grav[from];
    this.shape[to] = this.shape[from];
    this.color[to] = this.color[from];
  }

  private drawParticles(ctx: Ctx): void {
    for (let i = 0; i < this.n; i++) {
      const f = this.life[i] / this.max[i];
      const s = this.size[i];
      if (this.shape[i] === Shape.Puff) {
        ctx.fillStyle = COLORS[this.color[i]];
        ctx.globalAlpha = f * 0.45;
        ctx.beginPath();
        ctx.arc(this.px[i], this.py[i], s * (1.8 - f), 0, TAU);
        ctx.fill();
      } else if (this.shape[i] === Shape.Chunk) {
        const x = this.px[i];
        const y = this.py[i];
        const r = this.rot[i];
        ctx.fillStyle = COLORS[this.color[i]];
        ctx.globalAlpha = Math.min(1, f * 2);
        ctx.translate(x, y);
        ctx.rotate(r);
        ctx.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
        ctx.rotate(-r);
        ctx.translate(-x, -y);
      }
    }
    // sparks: additive streaks along their velocity
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < this.n; i++) {
      const shape = this.shape[i];
      if (shape === Shape.Puff || shape === Shape.Chunk) continue;
      const f = this.life[i] / this.max[i];
      ctx.strokeStyle = COLORS[this.color[i]];
      ctx.globalAlpha = Math.min(1, f * 1.5);
      ctx.beginPath();
      if (shape === Shape.Hex) {
        ctx.lineWidth = 1.4;
        hexPath(ctx, this.px[i], this.py[i], this.size[i] * 1.6, this.rot[i]);
      } else {
        // Hot: thicker and longer than a plain spark
        const hot = shape === Shape.Hot;
        const tail = hot ? 0.04 : 0.025;
        ctx.lineWidth = hot ? this.size[i] * (0.5 + 0.5 * f) : 1.2;
        ctx.moveTo(this.px[i], this.py[i]);
        ctx.lineTo(this.px[i] - this.vx[i] * tail, this.py[i] - this.vy[i] * tail);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private drawRings(ctx: Ctx): void {
    for (let i = 0; i < RING_CAP; i++) {
      const age = this.ring[i * 4 + 2];
      const maxR = this.ring[i * 4 + 3];
      if (maxR <= 0 || age > 0.45) continue;
      const f = age / 0.45;
      ctx.globalAlpha = (1 - f) * 0.9;
      ctx.strokeStyle = COLORS[this.ringColor[i]];
      ctx.lineWidth = 1.5 * (1 - f) + 0.5;
      ctx.beginPath();
      ctx.arc(this.ring[i * 4], this.ring[i * 4 + 1], 6 + maxR * Math.sqrt(f), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}


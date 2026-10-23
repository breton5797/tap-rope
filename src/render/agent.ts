// The chibi spy agent (side view, running right): run cycle, jump (2단 tuck, 3단 spin),
// dive (fast fall), slide (low lean-back + dust), land squash, idle, hurt. Also used for
// the escorted prisoner.
import { GROUND_Y, type Mood, type PlayerState } from '../types';
import { drawAgentHead } from './agent-heads';
import { lookFor, type AgentLook, type LookId } from './skins';
import { circle, clamp, oval, roundRect, TAU, vGrad, type Ctx } from './util';

const OUT = 'rgba(30,18,45,0.6)';
const BODY_CY = -24;
const SPIN_TIME = 0.5;
const STRIDE = 64;

export interface AgentFrame {
  readonly x: number;
  readonly id: LookId;
  readonly p: PlayerState;
  readonly mood: Mood;
  readonly t: number;
  readonly scroll: number;
  readonly running: boolean;
  readonly blink: boolean;
  readonly torch: boolean;
  readonly scale: number;
  /** small upward offset = further back (escort depth) */
  readonly yOff: number;
}

function limb(ctx: Ctx, color: string, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w + 1.6;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function boot(ctx: Ctx, L: AgentLook, x: number, y: number, rot: number): void {
  ctx.fillStyle = L.boot;
  oval(ctx, x + 2, y, 5, 3.2, rot);
  ctx.fill();
}

function hand(ctx: Ctx, L: AgentLook, x: number, y: number): void {
  ctx.fillStyle = L.hand;
  circle(ctx, x, y, 2.9);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function torso(ctx: Ctx, id: LookId, L: AgentLook): void {
  ctx.fillStyle = vGrad(ctx, -28, -11, [[0, L.suit], [1, L.suitDark]]);
  roundRect(ctx, -8, -28, 17, 17, 6);
  ctx.fill();
  if (L.stripes) {
    ctx.save();
    roundRect(ctx, -8, -28, 17, 17, 6);
    ctx.clip();
    ctx.fillStyle = L.accent;
    for (let y = -26; y < -11; y += 5) ctx.fillRect(-8, y, 17, 2.4);
    ctx.restore();
  }
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.2;
  roundRect(ctx, -8, -28, 17, 17, 6);
  ctx.stroke();
  if (id === 'kid' || id === 'cat') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(2, -28);
    ctx.lineTo(8.5, -28);
    ctx.lineTo(6, -20);
    ctx.fill();
    ctx.fillStyle = L.accent;
    ctx.fillRect(5.6, -27, 1.8, 7);
  } else if (id === 'astro') {
    ctx.fillStyle = L.accent;
    roundRect(ctx, -6, -25, 6, 6, 1.5);
    ctx.fill();
    roundRect(ctx, 1, -25, 6, 6, 1.5);
    ctx.fill();
  } else if (id === 'robot') {
    ctx.fillStyle = L.accent;
    circle(ctx, 2, -21, 2.4);
    ctx.fill();
  } else if (id === 'ninja') {
    ctx.fillStyle = L.accent;
    ctx.fillRect(-8, -15.5, 17, 3);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, -5.5, -26, 3.5, 10, 1.7);
  ctx.fill();
}

function tail(ctx: Ctx, t: number, flow: number): void {
  const w = Math.sin(t * 8) * 3;
  limb(ctx, '#D9701F', -7, -15, -18, -14 + w, -20 - flow * 4, -26 + w, 4);
  ctx.strokeStyle = '#FFAE52';
  ctx.lineWidth = 2.6;
  ctx.stroke();
}

export class AgentPainter {
  private prevLevel = 0;
  private spinStart = -1;

  shadow(ctx: Ctx, x: number, height: number, sliding: boolean, scale: number): void {
    const f = scale / (1 + height / 60);
    ctx.fillStyle = `rgba(5,4,12,${(0.38 * f).toFixed(3)})`;
    oval(ctx, x + (sliding ? -4 : 0), GROUND_Y + 9, (sliding ? 26 : 16) * f, 4.2 * f);
    ctx.fill();
  }

  draw(ctx: Ctx, f: AgentFrame): void {
    const { p, t } = f;
    if (p.level === 3 && this.prevLevel !== 3) this.spinStart = t;
    if (p.grounded) this.spinStart = -1;
    this.prevLevel = p.level;
    const L = lookFor(f.id);
    ctx.save();
    ctx.translate(f.x, GROUND_Y - p.height - f.yOff);
    ctx.scale(f.scale, f.scale);
    if (f.blink && Math.sin(t * 30) > 0) ctx.globalAlpha = 0.35;
    if (f.mood === 'hurt') ctx.translate(Math.sin(t * 70) * 1.5, 0);
    if (p.sliding) this.slide(ctx, f, L);
    else if (!p.grounded) this.air(ctx, f, L);
    else this.ground(ctx, f, L);
    ctx.restore();
  }

  private ground(ctx: Ctx, f: AgentFrame, L: AgentLook): void {
    const { p, t } = f;
    const q = p.landTimer < 0.14 ? 1 - p.landTimer / 0.14 : 0;
    const ph = f.running ? (f.scroll / STRIDE) * TAU : 0;
    const bob = f.running ? -Math.abs(Math.cos(ph)) * 2 : Math.sin(t * 3) * 0.6;
    ctx.translate(0, bob);
    ctx.scale(1 + 0.18 * q, 1 - 0.2 * q);
    if (f.running) ctx.rotate(0.08);
    if (f.id === 'cat') tail(ctx, t, f.running ? 1 : 0.2);
    for (let i = 0; i < 2; i++) {
      const s = f.running ? Math.sin(ph + i * Math.PI) : 0;
      const c = f.running ? Math.max(0, Math.cos(ph + i * Math.PI)) : 0;
      const hip = i === 0 ? -3 : 3;
      const fx = hip + s * 9 + (f.running ? 0 : (i === 0 ? -1 : 1));
      const fy = -1.5 - c * 6;
      if (i === 1) torso(ctx, f.id, L);
      limb(ctx, i === 0 ? L.suitDark : L.suit, hip, -12, hip + s * 4 + 4, -7 - c * 4, fx, fy, 5);
      boot(ctx, L, fx, fy, 0);
    }
    const sw = f.running ? Math.sin(ph) : 0;
    this.arms(ctx, f, L, -4 - sw * 9, -16 + Math.abs(sw) * 2, 6 + sw * 9, -16 + Math.abs(sw) * 2);
    this.head(ctx, f, f.running ? 0.7 : 0.1);
  }

  private air(ctx: Ctx, f: AgentFrame, L: AgentLook): void {
    const { p, t } = f;
    const dive = p.pendingSlide;
    const st = clamp(p.vy / 700, -1, 1);
    ctx.scale(1 - Math.abs(st) * 0.05, 1 + Math.abs(st) * 0.08);
    if (this.spinStart >= 0) {
      const k = clamp((t - this.spinStart) / SPIN_TIME, 0, 1);
      if (k < 1) {
        ctx.translate(0, BODY_CY);
        ctx.rotate(k * k * (3 - 2 * k) * TAU);
        ctx.translate(0, -BODY_CY);
      }
    }
    if (dive) ctx.rotate(0.22);
    if (f.id === 'cat') tail(ctx, t, 1);
    const tuck = dive ? 0 : p.level >= 2 ? 1 : 0.5;
    limb(ctx, L.suitDark, -3, -12, 2 + tuck * 4, -12 - tuck * 4, -4 + tuck * 2, -2 - tuck * 6, 5);
    boot(ctx, L, -4 + tuck * 2, -2 - tuck * 6, 0.3);
    torso(ctx, f.id, L);
    limb(ctx, L.suit, 3, -12, 10 + tuck * 3, -10 - tuck * 6, 6 + tuck * 2, -1 - tuck * 8, 5);
    boot(ctx, L, 6 + tuck * 2, -1 - tuck * 8, -0.2);
    if (dive) this.arms(ctx, f, L, -6, -44, 6, -44);
    else if (p.level === 1) this.arms(ctx, f, L, -11, -30, 9, -38);
    else if (p.level === 2) this.arms(ctx, f, L, 0, -12, 8, -13);
    else this.arms(ctx, f, L, -6, -46, 6, -46);
    this.head(ctx, f, 1);
    if (dive) this.streaks(ctx, t);
  }

  /** Low, long slide: legs out front, torso leaning far back, head tucked close, one arm back. */
  private slide(ctx: Ctx, f: AgentFrame, L: AgentLook): void {
    const { t } = f;
    this.dust(ctx, f.p.slideAge, t);
    this.speedLines(ctx, t);
    limb(ctx, L.suitDark, -12, -11, -26, -6, -38, -2, 4.2);
    hand(ctx, L, -38, -2);
    limb(ctx, L.suitDark, 2, -6, 10, -3, 18, -2, 5);
    boot(ctx, L, 18, -2, 0);
    ctx.save();
    ctx.translate(2, -6);
    ctx.rotate(-1.25);
    ctx.translate(0, 12);
    torso(ctx, f.id, L);
    ctx.restore();
    limb(ctx, L.suit, 2, -6, 12, -7, 23, -5, 5);
    boot(ctx, L, 23, -5, -0.15);
    limb(ctx, L.suit, -10, -13, -1, -9, 10, -10, 4.4);
    hand(ctx, L, 10, -10);
    ctx.save();
    ctx.translate(-18, 19);
    this.head(ctx, f, 1);
    ctx.restore();
  }

  private speedLines(ctx: Ctx, t: number): void {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const o = (t * 260 + i * 23) % 40;
      const x = -40 - o;
      const y = -8 - i * 9;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 14 - i * 4, y);
    }
    ctx.stroke();
  }

  private arms(ctx: Ctx, f: AgentFrame, L: AgentLook, bx: number, by: number, fx: number, fy: number): void {
    limb(ctx, L.suitDark, -3, -24, (bx - 3) / 2 - 2, (by - 24) / 2, bx, by, 4.4);
    hand(ctx, L, bx, by);
    limb(ctx, L.suit, 3, -24, (fx + 3) / 2 + 2, (fy - 24) / 2, fx, fy, 4.4);
    hand(ctx, L, fx, fy);
    if (f.torch) this.torch(ctx, fx, fy);
  }

  private torch(ctx: Ctx, x: number, y: number): void {
    ctx.fillStyle = '#3A3F52';
    roundRect(ctx, x - 1, y - 3, 10, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#FFF6C8';
    circle(ctx, x + 9.5, y - 0.5, 2.6);
    ctx.fill();
  }

  private head(ctx: Ctx, f: AgentFrame, flow: number): void {
    drawAgentHead(ctx, f.id, f.mood, f.t, flow);
  }

  private dust(ctx: Ctx, age: number, t: number): void {
    ctx.fillStyle = 'rgba(220,214,230,0.5)';
    for (let i = 0; i < 6; i++) {
      const k = (t * 3 + i / 6) % 1;
      ctx.globalAlpha = (1 - k) * 0.6 * clamp(age * 6, 0, 1);
      circle(ctx, -30 - k * 40, -1 - k * 3 - (i % 2) * 2, 2 + k * 4);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private streaks(ctx: Ctx, t: number): void {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = -8 + i * 8;
      const o = (t * 120 + i * 9) % 18;
      ctx.moveTo(x, -62 - o);
      ctx.lineTo(x, -76 - o);
    }
    ctx.stroke();
  }
}

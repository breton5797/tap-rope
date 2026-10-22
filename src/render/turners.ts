// The two friends turning the rope. Body is drawn behind the rope, hands after it.
import { groundY, HEIGHT_K, project, screenX } from './projection';
import { handPos, RopeRig, setLongRig, TURNER_X } from './rope';
import { circle, clamp, oval, radGrad, roundRect, vGrad, type Ctx } from './util';

interface TurnerLook {
  readonly shirt: string;
  readonly shirtDark: string;
  readonly pants: string;
  readonly hair: string;
  readonly hairDark: string;
  readonly accent: string;
  readonly girl: boolean;
}

const LEFT: TurnerLook = {
  shirt: '#2EC4B6', shirtDark: '#1A8F86', pants: '#FF7AA2', hair: '#3B2A4A', hairDark: '#22172D', accent: '#FF5E8E', girl: true,
};
const RIGHT: TurnerLook = {
  shirt: '#8E6CFF', shirtDark: '#5F43CC', pants: '#2F3B66', hair: '#6B3E22', hairDark: '#43240F', accent: '#FFB627', girl: false,
};
const SKIN = '#FFD8B8';
const SKIN_SHADE = '#F2B48F';
const OUTLINE = 'rgba(45,25,60,0.55)';
const HEAD_Y = -74;
const HEAD_R = 19;

function bob(phase: number): number {
  return -1.6 * Math.abs(Math.sin(phase));
}

function legs(ctx: Ctx, look: TurnerLook): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = look.pants;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-5, -26);
  ctx.lineTo(-6, -5);
  ctx.moveTo(5, -26);
  ctx.lineTo(6, -5);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  for (const sx of [-6, 6]) {
    oval(ctx, sx + 2, -3, 6.5, 3.6);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function torso(ctx: Ctx, look: TurnerLook): void {
  ctx.fillStyle = vGrad(ctx, -56, -22, [[0, look.shirt], [1, look.shirtDark]]);
  if (look.girl) {
    ctx.beginPath();
    ctx.moveTo(-11, -56);
    ctx.lineTo(11, -56);
    ctx.quadraticCurveTo(13, -40, 18, -22);
    ctx.lineTo(-18, -22);
    ctx.quadraticCurveTo(-13, -40, -11, -56);
    ctx.closePath();
  } else {
    roundRect(ctx, -13, -57, 26, 33, 10);
  }
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, -8, -53, 5, 18, 2.5);
  ctx.fill();
  ctx.fillStyle = look.accent;
  circle(ctx, 3, -44, 3.2);
  ctx.fill();
}

function hairBack(ctx: Ctx, look: TurnerLook, t: number): void {
  if (!look.girl) return;
  ctx.fillStyle = look.hair;
  const sw = Math.sin(t * 6) * 1.5;
  for (const sx of [-1, 1]) {
    oval(ctx, sx * 19, HEAD_Y + 6 + sw * sx, 6, 10, sx * 0.4);
    ctx.fill();
  }
  ctx.fillStyle = look.accent;
  for (const sx of [-1, 1]) {
    circle(ctx, sx * 16, HEAD_Y - 2, 3.2);
    ctx.fill();
  }
}

function head(ctx: Ctx, look: TurnerLook, lookUp: number, t: number): void {
  hairBack(ctx, look, t);
  ctx.fillStyle = radGrad(ctx, -6, HEAD_Y - 7, 3, HEAD_R + 3, [[0, '#FFE9D6'], [0.7, SKIN], [1, SKIN_SHADE]]);
  circle(ctx, 0, HEAD_Y, HEAD_R);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = vGrad(ctx, HEAD_Y - HEAD_R, HEAD_Y, [[0, look.hair], [1, look.hairDark]]);
  ctx.beginPath();
  ctx.arc(0, HEAD_Y, HEAD_R + 1, Math.PI * 1.02, Math.PI * 1.98);
  ctx.quadraticCurveTo(10, HEAD_Y - 12, 2, HEAD_Y - 9);
  ctx.quadraticCurveTo(-8, HEAD_Y - 13, -HEAD_R - 1, HEAD_Y - 1);
  ctx.fill();
  if (!look.girl) {
    ctx.fillStyle = look.accent;
    ctx.beginPath();
    ctx.arc(0, HEAD_Y - 6, HEAD_R + 1, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, -HEAD_R - 9, HEAD_Y - 9, 14, 5, 2.5);
    ctx.fill();
  }
  face(ctx, lookUp, t);
}

function face(ctx: Ctx, lookUp: number, t: number): void {
  const blink = (t + 0.7) % 3.7 < 0.12;
  const ey = HEAD_Y + 2 - lookUp;
  ctx.fillStyle = '#2B2140';
  ctx.strokeStyle = '#2B2140';
  for (const ex of [2, 12]) {
    if (blink) {
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ex - 2.4, ey);
      ctx.lineTo(ex + 2.4, ey);
      ctx.stroke();
    } else {
      oval(ctx, ex, ey, 2.4, 3.2);
      ctx.fill();
    }
  }
  if (!blink) {
    ctx.fillStyle = '#FFFFFF';
    for (const ex of [2, 12]) {
      circle(ctx, ex + 0.8, ey - 1.2, 0.9);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255,120,140,0.45)';
  oval(ctx, 15, HEAD_Y + 8, 3.4, 2);
  ctx.fill();
  ctx.strokeStyle = '#7A3044';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(8, HEAD_Y + 8, 3.2, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function arm(ctx: Ctx, look: TurnerLook, hx: number, hy: number): void {
  const sx = 7;
  const sy = -50 * HEIGHT_K;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 8.4;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + hx) / 2 + 2, Math.max(sy, hy) + 4, hx, hy);
  ctx.stroke();
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = look.shirt;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(sx - 1, sy);
  ctx.lineTo(sx + 4, sy - 2);
  ctx.stroke();
}

const rig = setLongRig(new RopeRig());
const hp = new Float32Array(3);
const sp = new Float32Array(3);

/** screen position of a turner's hand (side -1 = left turner) */
function handScreen(phase: number, side: number): void {
  handPos(rig, phase, side, hp);
  project(hp[0], hp[1], hp[2], sp);
}

function drawOne(ctx: Ctx, side: number, look: TurnerLook, phase: number, t: number, lookUp: number): void {
  const facing = -side;
  const b = bob(phase);
  const fx = screenX(side * TURNER_X, 0);
  const fy = groundY(0);
  handScreen(phase, side);
  ctx.save();
  ctx.translate(fx, fy + b);
  ctx.scale(facing, 1);
  ctx.fillStyle = 'rgba(30,20,50,0.22)';
  oval(ctx, 0, -b + 1, 22, 7);
  ctx.fill();
  ctx.save();
  ctx.scale(1, HEIGHT_K);
  legs(ctx, look);
  torso(ctx, look);
  ctx.restore();
  ctx.save();
  ctx.translate(0, HEAD_Y * (HEIGHT_K - 1) + 4);
  head(ctx, look, lookUp, t);
  ctx.restore();
  arm(ctx, look, (sp[0] - fx) * facing, sp[1] - (fy + b));
  ctx.restore();
}

/** Turner bodies + arms (behind the rope). */
export function drawTurners(ctx: Ctx, phase: number, t: number, playerHeight: number): void {
  const lookUp = clamp(playerHeight / 60, 0, 2.2);
  drawOne(ctx, -1, LEFT, phase, t, lookUp);
  drawOne(ctx, 1, RIGHT, phase, t + 1.3, lookUp);
}

function hand(ctx: Ctx, x: number, y: number, look: TurnerLook): void {
  ctx.fillStyle = '#C98A4B';
  roundRect(ctx, x - 2.6, y - 6, 5.2, 12, 2.6);
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 2.6, y + 3, 5.2, 2);
  ctx.fillStyle = SKIN;
  circle(ctx, x, y, 4.6);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

/** Fists + rope handles (over the rope ends). */
export function drawTurnerHands(ctx: Ctx, phase: number): void {
  handScreen(phase, -1);
  hand(ctx, sp[0], sp[1], LEFT);
  handScreen(phase, 1);
  hand(ctx, sp[0], sp[1], RIGHT);
}

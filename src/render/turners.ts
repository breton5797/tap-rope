// The two friends turning the long rope, seen from above (~60° down) with the same chibi
// kit as the kid, a little bigger. Faces turn inward toward the jumper. Bodies + arms are
// drawn behind the rope; fists + handles after it.
import {
  drawArm, drawLower, drawShoulders, faceBand, HEAD_CY, HEAD_R, headBall, OUTLINE, SHOULDER_X, SHOULDER_Y,
  strands, type BodyStyle,
} from './chibi';
import { drawFace, type FaceStyle } from './face';
import { groundRy, groundY, project, screenX } from './projection';
import { handPos, RopeRig, setLongRig, TURNER_X } from './rope';
import { circle, clamp, oval, roundRect, type Ctx } from './util';

interface TurnerLook extends BodyStyle {
  readonly hair: string;
  readonly hairLight: string;
  readonly hairDark: string;
  readonly accent: string;
  readonly girl: boolean;
}

const SKIN = '#FFD8B8';
const SKIN_SHADE = '#F2B48F';
const LEFT: TurnerLook = {
  shirt: '#2EC4B6', shirtDark: '#1A8F86', pants: '#FF7AA2', limb: SKIN, shoe: '#FFFFFF',
  hair: '#3B2A4A', hairLight: '#6A5080', hairDark: '#22172D', accent: '#FF5E8E', girl: true,
};
const RIGHT: TurnerLook = {
  shirt: '#8E6CFF', shirtDark: '#5F43CC', pants: '#2F3B66', limb: SKIN, shoe: '#FFFFFF',
  hair: '#6B3E22', hairLight: '#9A6440', hairDark: '#43240F', accent: '#FFB627', girl: false,
};
const FACE: FaceStyle = { eye: '#2B2140', mouth: '#7A3044', blush: true };
const SCALE = 1.28;

const rig = setLongRig(new RopeRig());
const hp = new Float32Array(3);
const sp = new Float32Array(3);

/** screen position of a turner's hand (side -1 = left turner) */
function handScreen(phase: number, side: number): void {
  handPos(rig, phase, side, hp);
  project(hp[0], hp[1], hp[2], sp);
}

function pigtails(ctx: Ctx, look: TurnerLook, t: number): void {
  const sw = Math.sin(t * 6) * 1.2;
  for (const s of [-1, 1]) {
    ctx.fillStyle = look.hair;
    oval(ctx, s * (HEAD_R + 3), HEAD_CY - 2 + sw * s, 5.5, 8, s * 0.5);
    ctx.fill();
    ctx.fillStyle = look.accent;
    circle(ctx, s * (HEAD_R - 1), HEAD_CY - 6, 3);
    ctx.fill();
  }
}

function girlHead(ctx: Ctx, look: TurnerLook, dx: number): void {
  headBall(ctx, look.hairLight, look.hair, look.hairDark);
  faceBand(ctx, SKIN, SKIN_SHADE, dx);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, HEAD_CY - HEAD_R + 1);
  ctx.quadraticCurveTo(1, HEAD_CY - 6, dx * 0.6, HEAD_CY + 3);
  ctx.stroke();
  strands(ctx, -4, HEAD_CY - 8, 'rgba(20,10,30,0.35)', 4);
  strands(ctx, 4, HEAD_CY - 8, 'rgba(20,10,30,0.35)', 4);
}

/** Backwards cap from above: a dome with the brim pointing away (up on screen). */
function boyHead(ctx: Ctx, look: TurnerLook, dx: number): void {
  headBall(ctx, look.hairLight, look.hair, look.hairDark);
  faceBand(ctx, SKIN, SKIN_SHADE, dx);
  ctx.fillStyle = '#F2A20E';
  roundRect(ctx, -8, HEAD_CY - HEAD_R - 6, 16, 9, 4);
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.beginPath();
  ctx.ellipse(0, HEAD_CY - 3, HEAD_R + 0.5, HEAD_R - 3, 0, Math.PI * 0.96, Math.PI * 2.04);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160,90,0,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const a of [-0.9, 0, 0.9]) {
    ctx.moveTo(0, HEAD_CY - 9);
    ctx.lineTo(Math.sin(a) * HEAD_R, HEAD_CY - 3 - Math.cos(a) * (HEAD_R - 4));
  }
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, 0, HEAD_CY - 9, 1.8);
  ctx.fill();
}

function face(ctx: Ctx, dx: number, lookUp: number, t: number): void {
  ctx.save();
  ctx.translate(dx, HEAD_CY + 8 - lookUp);
  ctx.scale(0.72, 0.72);
  drawFace(ctx, lookUp > 1.2 ? 'happy' : 'idle', t, 0, 0, FACE);
  ctx.restore();
}

function drawOne(ctx: Ctx, side: number, look: TurnerLook, phase: number, t: number, lookUp: number): void {
  const fx = screenX(side * TURNER_X, 0);
  const fy = groundY(0) - 1.6 * Math.abs(Math.sin(phase));
  const dx = -side * 3.5;
  handScreen(phase, side);
  ctx.fillStyle = 'rgba(30,20,50,0.24)';
  oval(ctx, fx, groundY(0) - 1, 22 * SCALE, groundRy(0, 17) * SCALE);
  ctx.fill();
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(SCALE, SCALE);
  drawLower(ctx, look, 0);
  if (look.girl) pigtails(ctx, look, t);
  drawShoulders(ctx, look);
  const hx = (sp[0] - fx) / SCALE;
  const hy = (sp[1] - fy) / SCALE;
  drawArm(ctx, look, -side * SHOULDER_X, SHOULDER_Y + 1, hx, hy, false);
  ctx.fillStyle = look.limb;
  circle(ctx, side * SHOULDER_X * 1.05, SHOULDER_Y + 6, 2.8);
  ctx.fill();
  if (look.girl) girlHead(ctx, look, dx);
  else boyHead(ctx, look, dx);
  face(ctx, dx, lookUp, t);
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

// Head shapes and headgear per skin. Local player coords; head center (0, HEAD_Y).
import type { Mood, SkinId } from '../types';
import { drawFace } from './face';
import { lookFor } from './skins';
import { circle, oval, radGrad, roundRect, vGrad, type Ctx } from './util';

export const HEAD_Y = -41;
export const HEAD_R = 16;
const OUTLINE = 'rgba(40,22,55,0.6)';
const FACE_DROP = 2.5;

function ears(ctx: Ctx, outer: string, inner: string, t: number): void {
  const tw = Math.sin(t * 2.3) > 0.97 ? 0.15 : 0;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 10, HEAD_Y - 11);
    ctx.rotate(s * (0.35 + tw));
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(-6, 3);
    ctx.quadraticCurveTo(-3, -12, 0, -12);
    ctx.quadraticCurveTo(3, -12, 6, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(-3, 1);
    ctx.quadraticCurveTo(0, -9, 3, 1);
    ctx.fill();
    ctx.restore();
  }
}

function bunnyEars(ctx: Ctx, t: number, vy: number): void {
  const flop = Math.max(-0.5, Math.min(0.5, -vy / 1400));
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 6, HEAD_Y - 12);
    ctx.rotate(s * (0.16 + flop * 0.6) + Math.sin(t * 3 + s) * 0.05);
    ctx.fillStyle = '#FFF3F7';
    oval(ctx, 0, -13, 5.4, 15);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = '#FFA6C4';
    oval(ctx, 0, -12, 2.6, 11);
    ctx.fill();
    ctx.restore();
  }
}

function ninjaTails(ctx: Ctx, t: number, vy: number): void {
  const lift = Math.max(-1, Math.min(1, -vy / 700));
  ctx.strokeStyle = '#E63946';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.4;
  for (let i = 0; i < 2; i++) {
    const w = Math.sin(t * 12 + i * 1.7) * 3;
    ctx.beginPath();
    ctx.moveTo(13, HEAD_Y - 6);
    ctx.bezierCurveTo(20, HEAD_Y - 8 + w, 26, HEAD_Y - 2 - w + lift * 6 + i * 4, 33 - i * 3, HEAD_Y + 2 + w + lift * 8 + i * 5);
    ctx.stroke();
  }
}

/** Accessories behind the head. */
export function drawHeadBack(ctx: Ctx, id: SkinId, t: number, vy: number): void {
  if (id === 'cat') ears(ctx, '#FFAE52', '#FFB3C4', t);
  else if (id === 'bunny') bunnyEars(ctx, t, vy);
  else if (id === 'ninja') ninjaTails(ctx, t, vy);
  else if (id === 'robot') {
    ctx.strokeStyle = '#8E9BB4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HEAD_Y - 14);
    ctx.lineTo(0, HEAD_Y - 24);
    ctx.stroke();
    const on = Math.sin(t * 5) > 0;
    ctx.fillStyle = on ? '#FF5E5B' : '#FFB627';
    circle(ctx, 0, HEAD_Y - 26, 3.4);
    ctx.fill();
    ctx.fillStyle = on ? 'rgba(255,94,91,0.3)' : 'rgba(255,182,39,0.25)';
    circle(ctx, 0, HEAD_Y - 26, 6.5);
    ctx.fill();
  }
}

function headBall(ctx: Ctx, id: SkinId): void {
  const L = lookFor(id);
  ctx.fillStyle = radGrad(ctx, -5, HEAD_Y - 7, 2, HEAD_R + 4, [[0, L.headLight], [0.6, L.head], [1, L.headShade]]);
  if (id === 'robot') roundRect(ctx, -HEAD_R, HEAD_Y - HEAD_R + 1, HEAD_R * 2, HEAD_R * 2 - 2, 9);
  else circle(ctx, 0, HEAD_Y, HEAD_R);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function kidHair(ctx: Ctx): void {
  ctx.fillStyle = vGrad(ctx, HEAD_Y - 17, HEAD_Y - 2, [[0, '#8C5632'], [1, '#5E331A']]);
  ctx.beginPath();
  ctx.arc(0, HEAD_Y, HEAD_R + 1, Math.PI * 1.0, Math.PI * 2.0);
  ctx.lineTo(HEAD_R + 1, HEAD_Y - 2);
  ctx.quadraticCurveTo(10, HEAD_Y - 10, 6, HEAD_Y - 6);
  ctx.quadraticCurveTo(2, HEAD_Y - 11, -3, HEAD_Y - 6);
  ctx.quadraticCurveTo(-8, HEAD_Y - 11, -11, HEAD_Y - 5);
  ctx.quadraticCurveTo(-14, HEAD_Y - 7, -HEAD_R - 1, HEAD_Y - 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5E331A';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1, HEAD_Y - 16);
  ctx.quadraticCurveTo(4, HEAD_Y - 25, 9, HEAD_Y - 22);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(0, HEAD_Y, HEAD_R - 3, Math.PI * 1.2, Math.PI * 1.45);
  ctx.stroke();
}

function catFace(ctx: Ctx): void {
  ctx.fillStyle = '#FFF0DC';
  oval(ctx, 0, HEAD_Y + 7, 8.5, 5.5);
  ctx.fill();
  ctx.fillStyle = '#D9701F';
  for (const dx of [-4, 0, 4]) {
    roundRect(ctx, dx - 1, HEAD_Y - 15, 2, 5 - Math.abs(dx) * 0.4, 1);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(80,40,20,0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(s * 8, HEAD_Y + 6);
    ctx.lineTo(s * 17, HEAD_Y + 4);
    ctx.moveTo(s * 8, HEAD_Y + 8);
    ctx.lineTo(s * 17, HEAD_Y + 9);
  }
  ctx.stroke();
}

function noseDot(ctx: Ctx, color: string): void {
  ctx.fillStyle = color;
  oval(ctx, 0, HEAD_Y + 4.6, 1.8, 1.2);
  ctx.fill();
}

function ninjaMask(ctx: Ctx): void {
  ctx.fillStyle = '#FFD9B8';
  roundRect(ctx, -12.5, HEAD_Y - 3.5, 25, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#E63946';
  ctx.fillRect(-HEAD_R + 0.5, HEAD_Y - 10, HEAD_R * 2 - 1, 4);
  ctx.fillStyle = '#C9CED8';
  roundRect(ctx, -3.5, HEAD_Y - 10.5, 7, 5, 1.5);
  ctx.fill();
}

function robotVisor(ctx: Ctx): void {
  ctx.fillStyle = vGrad(ctx, HEAD_Y - 8, HEAD_Y + 7, [[0, '#26375A'], [1, '#0E1628']]);
  roundRect(ctx, -12.5, HEAD_Y - 8, 25, 14, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(ctx, -10, HEAD_Y - 6.5, 9, 2.5, 1.2);
  ctx.fill();
  ctx.fillStyle = '#7D8AA5';
  for (const s of [-1, 1]) {
    circle(ctx, s * (HEAD_R + 0.5), HEAD_Y, 3);
    ctx.fill();
  }
  ctx.fillStyle = '#5C6A88';
  for (let i = -1; i <= 1; i++) ctx.fillRect(i * 3.5 - 1, HEAD_Y + 9, 2, 3.2);
}

function helmet(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(190,230,255,0.16)';
  circle(ctx, 0, HEAD_Y, HEAD_R + 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,245,255,0.95)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, HEAD_Y, HEAD_R + 1, Math.PI * 1.15, Math.PI * 1.42);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  circle(ctx, 11, HEAD_Y - 11, 1.6);
  ctx.fill();
  ctx.fillStyle = '#D6DEEA';
  roundRect(ctx, -12, HEAD_Y + HEAD_R + 1, 24, 5, 2.5);
  ctx.fill();
}

/** Soft top-light on the crown so the head reads as seen from above. */
function crown(ctx: Ctx, id: SkinId): void {
  if (id === 'kid' || id === 'astro' || id === 'robot') return;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  oval(ctx, -2, HEAD_Y - 9, 9, 4.5);
  ctx.fill();
}

/** Head, face and front headgear. */
export function drawHead(ctx: Ctx, id: SkinId, mood: Mood, t: number): void {
  headBall(ctx, id);
  const L = lookFor(id);
  // seen from above: the face sits low on the head so the crown shows
  ctx.save();
  ctx.translate(0, FACE_DROP);
  if (id === 'cat') catFace(ctx);
  if (id === 'ninja') ninjaMask(ctx);
  if (id === 'robot') robotVisor(ctx);
  drawFace(ctx, mood, t, 0, id === 'robot' ? HEAD_Y - 1 : HEAD_Y + 1, L.face);
  if (id === 'cat') noseDot(ctx, '#FF7F98');
  if (id === 'bunny') noseDot(ctx, '#FF8FB1');
  ctx.restore();
  crown(ctx, id);
  if (id === 'kid' || id === 'astro') kidHair(ctx);
  if (id === 'astro') helmet(ctx);
}

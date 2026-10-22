// Skin heads seen from above (~60° down): the crown dominates, the face is a small band
// on the lower part of the head. Local player coords (feet at origin).
import type { Mood, SkinId } from '../types';
import { faceBand, HEAD_CY, HEAD_R, headBall, OUTLINE, strands, whorl } from './chibi';
import { drawFace } from './face';
import { lookFor } from './skins';
import { circle, oval, radGrad, roundRect, type Ctx } from './util';

const FACE_Y = HEAD_CY + 8;
const FACE_K = 0.72;

function face(ctx: Ctx, id: SkinId, mood: Mood, t: number, dy = 0): void {
  ctx.save();
  ctx.translate(0, FACE_Y + dy);
  ctx.scale(FACE_K, FACE_K);
  drawFace(ctx, mood, t, 0, 0, lookFor(id).face);
  ctx.restore();
}

function nose(ctx: Ctx, color: string): void {
  ctx.fillStyle = color;
  oval(ctx, 0, FACE_Y + 3, 1.6, 1.1);
  ctx.fill();
}

function catEar(ctx: Ctx, s: number, t: number): void {
  const tw = Math.sin(t * 2.3) > 0.97 ? 0.15 : 0;
  ctx.save();
  ctx.translate(s * 10, HEAD_CY - 9);
  ctx.rotate(s * (0.55 + tw));
  ctx.fillStyle = '#F39A3E';
  ctx.beginPath();
  ctx.moveTo(-6.5, 3);
  ctx.quadraticCurveTo(-2, -11, 0, -12);
  ctx.quadraticCurveTo(2, -11, 6.5, 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = '#FFB3C4';
  ctx.beginPath();
  ctx.moveTo(-3, 1.5);
  ctx.quadraticCurveTo(0, -8, 3, 1.5);
  ctx.fill();
  ctx.restore();
}

function bunnyEars(ctx: Ctx, t: number, vy: number): void {
  const lift = Math.max(-0.3, Math.min(0.4, vy / 1600));
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 5.5, HEAD_CY - 10);
    ctx.rotate(s * (0.34 - lift * 0.4) + Math.sin(t * 3 + s) * 0.05);
    ctx.fillStyle = '#FFF3F7';
    oval(ctx, 0, -10, 5, 11 + lift * 5);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = '#FFA6C4';
    oval(ctx, 0, -10, 2.4, 8 + lift * 4);
    ctx.fill();
    ctx.restore();
  }
}

function ninjaTails(ctx: Ctx, t: number, vy: number): void {
  const air = Math.max(0, Math.min(1, Math.abs(vy) / 700));
  ctx.strokeStyle = '#E63946';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    const w = Math.sin(t * 11 + i * 1.9) * (1.5 + air * 2.5);
    const len = 1 + air * 0.35 + i * 0.12;
    ctx.beginPath();
    ctx.moveTo(1, HEAD_CY - 12);
    ctx.bezierCurveTo(7, HEAD_CY - 15 + w, 12 * len, HEAD_CY - 12 - w + i * 4, 19 * len, HEAD_CY - 15 + w + i * 6);
    ctx.stroke();
  }
}

/** Accessories behind (= above on screen) the head. */
export function drawHeadBack(ctx: Ctx, id: SkinId, t: number, vy: number): void {
  if (id === 'bunny') bunnyEars(ctx, t, vy);
  else if (id === 'ninja') ninjaTails(ctx, t, vy);
  else if (id === 'astro') {
    ctx.fillStyle = '#C9D3E2';
    roundRect(ctx, -13, HEAD_CY - 6, 26, 14, 5);
    ctx.fill();
    ctx.fillStyle = '#FF8A3D';
    roundRect(ctx, -12, HEAD_CY - 4, 4, 9, 2);
    ctx.fill();
    roundRect(ctx, 8, HEAD_CY - 4, 4, 9, 2);
    ctx.fill();
  }
}

function kidHead(ctx: Ctx, id: SkinId, mood: Mood, t: number): void {
  headBall(ctx, '#B07446', '#7E4A28', '#56301A');
  faceBand(ctx, '#FFD9B8', '#F0AF88', 0);
  ctx.fillStyle = '#7E4A28';
  ctx.beginPath();
  ctx.moveTo(-HEAD_R + 1, HEAD_CY + 2);
  for (let i = 0; i <= 6; i++) {
    const x = -HEAD_R + 1 + (i * (HEAD_R * 2 - 2)) / 6;
    ctx.quadraticCurveTo(x - 2.4, HEAD_CY + 6 + (i % 2) * 1.5, x, HEAD_CY + 2.5);
  }
  ctx.lineTo(HEAD_R - 1, HEAD_CY - 2);
  ctx.lineTo(-HEAD_R + 1, HEAD_CY - 2);
  ctx.closePath();
  ctx.fill();
  strands(ctx, 2, HEAD_CY - 6, 'rgba(60,30,12,0.45)', 6);
  whorl(ctx, 2, HEAD_CY - 6, 'rgba(60,30,12,0.7)');
  ctx.strokeStyle = 'rgba(255,220,180,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-3, HEAD_CY - 4, 9, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = '#56301A';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(2, HEAD_CY - 7);
  ctx.quadraticCurveTo(6, HEAD_CY - 16, 10, HEAD_CY - 12);
  ctx.stroke();
  face(ctx, id, mood, t);
}

function catHead(ctx: Ctx, mood: Mood, t: number): void {
  catEar(ctx, -1, t);
  catEar(ctx, 1, t);
  headBall(ctx, '#FFD08A', '#FFAE52', '#E07F24');
  ctx.fillStyle = '#D9701F';
  for (const a of [-0.5, -0.17, 0.17, 0.5]) {
    ctx.save();
    ctx.translate(0, HEAD_CY - 6);
    ctx.rotate(a);
    roundRect(ctx, -1.2, -8, 2.4, 8, 1.2);
    ctx.fill();
    ctx.restore();
  }
  faceBand(ctx, '#FFF0DC', '#F3CFA6', 0, 7.5);
  ctx.strokeStyle = 'rgba(80,40,20,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(s * 6, FACE_Y + 3);
    ctx.lineTo(s * 14, FACE_Y + 1.5);
    ctx.moveTo(s * 6, FACE_Y + 4.5);
    ctx.lineTo(s * 14, FACE_Y + 5.5);
  }
  ctx.stroke();
  face(ctx, 'cat', mood, t);
  nose(ctx, '#FF7F98');
}

function bunnyHead(ctx: Ctx, mood: Mood, t: number): void {
  headBall(ctx, '#FFFFFF', '#FFF3F7', '#F1C3D4');
  ctx.fillStyle = 'rgba(255,166,196,0.35)';
  oval(ctx, 0, HEAD_CY - 6, 6, 3.5);
  ctx.fill();
  faceBand(ctx, '#FFFAFC', '#F6D6E2', 0, 7.5);
  face(ctx, 'bunny', mood, t);
  nose(ctx, '#FF8FB1');
}

function ninjaHead(ctx: Ctx, mood: Mood, t: number): void {
  headBall(ctx, '#5A608F', '#30345A', '#1A1C34');
  ctx.save();
  circle(ctx, 0, HEAD_CY, HEAD_R - 0.6);
  ctx.clip();
  ctx.fillStyle = '#FFD9B8';
  roundRect(ctx, -11.5, FACE_Y - 4.5, 23, 8.5, 4.2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#E63946';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.ellipse(0, HEAD_CY - 1, HEAD_R - 0.5, 7, 0, Math.PI * 0.95, Math.PI * 2.05);
  ctx.stroke();
  ctx.fillStyle = '#E63946';
  circle(ctx, 0, HEAD_CY - 12.5, 3);
  ctx.fill();
  ctx.fillStyle = '#C9CED8';
  roundRect(ctx, -3.5, HEAD_CY - 9.5, 7, 4.5, 1.4);
  ctx.fill();
  face(ctx, 'ninja', mood, t, -0.5);
}

function robotHead(ctx: Ctx, mood: Mood, t: number): void {
  headBall(ctx, '#FFFFFF', '#D8E0EC', '#8E9BB4');
  ctx.strokeStyle = 'rgba(90,105,140,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, HEAD_CY - 2, HEAD_R - 3, 8, 0, Math.PI, Math.PI * 2);
  ctx.moveTo(0, HEAD_CY - 10);
  ctx.lineTo(0, HEAD_CY - HEAD_R + 1);
  ctx.stroke();
  ctx.fillStyle = radGrad(ctx, 0, FACE_Y - 2, 1, 14, [[0, '#2A3D66'], [1, '#0E1628']]);
  roundRect(ctx, -12, FACE_Y - 5.5, 24, 11, 5.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  roundRect(ctx, -9.5, FACE_Y - 4.5, 8, 2, 1);
  ctx.fill();
  face(ctx, 'robot', mood, t, -0.5);
  const on = Math.sin(t * 5) > 0;
  ctx.fillStyle = '#7D8AA5';
  circle(ctx, 0, HEAD_CY - 6, 2.2);
  ctx.fill();
  ctx.fillStyle = on ? 'rgba(255,94,91,0.3)' : 'rgba(255,182,39,0.25)';
  circle(ctx, 0, HEAD_CY - 6, 6);
  ctx.fill();
  ctx.fillStyle = on ? '#FF5E5B' : '#FFB627';
  circle(ctx, 0, HEAD_CY - 6, 3);
  ctx.fill();
}

function helmetGlass(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(190,230,255,0.16)';
  circle(ctx, 0, HEAD_CY, HEAD_R + 4.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,245,255,0.95)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, HEAD_CY, HEAD_R + 0.5, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  oval(ctx, 7, HEAD_CY - 10, 3, 1.6, -0.5);
  ctx.fill();
}

/** Head (crown, face band, headgear) for a skin. */
export function drawHead(ctx: Ctx, id: SkinId, mood: Mood, t: number): void {
  switch (id) {
    case 'cat': return catHead(ctx, mood, t);
    case 'bunny': return bunnyHead(ctx, mood, t);
    case 'ninja': return ninjaHead(ctx, mood, t);
    case 'robot': return robotHead(ctx, mood, t);
    case 'astro':
      kidHead(ctx, id, mood, t);
      return helmetGlass(ctx);
    default: return kidHead(ctx, id, mood, t);
  }
}

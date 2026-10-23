// Side-view (3/4, facing right) chibi heads for each agent skin + the prisoner.
import type { Mood } from '../types';
import { drawFace } from './face';
import { lookFor, type LookId } from './skins';
import { circle, oval, radGrad, roundRect, type Ctx } from './util';

export const HX = 1;
export const HY = -40;
export const HR = 15;
const OUT = 'rgba(30,18,45,0.6)';

function ball(ctx: Ctx, id: LookId): void {
  const L = lookFor(id);
  ctx.fillStyle = radGrad(ctx, HX + 3, HY - 6, 2, HR * 1.2, [[0, L.skinLight], [0.6, L.skin], [1, L.skinShade]]);
  if (id === 'robot') roundRect(ctx, HX - HR, HY - HR + 1, HR * 2, HR * 2 - 2, 9);
  else circle(ctx, HX, HY, HR);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function face(ctx: Ctx, id: LookId, mood: Mood, t: number, dy = 0): void {
  ctx.save();
  ctx.translate(HX + 5, HY + 2 + dy);
  ctx.scale(0.82, 0.82);
  drawFace(ctx, mood, t, 0, 0, lookFor(id).face);
  ctx.restore();
}

/** Hair cap covering the top/back of the head with a fringe at the front. */
function hair(ctx: Ctx, c0: string, c1: string): void {
  ctx.fillStyle = radGrad(ctx, HX - 2, HY - 10, 2, HR + 4, [[0, c0], [1, c1]]);
  ctx.beginPath();
  ctx.arc(HX, HY, HR + 0.8, Math.PI * 0.62, Math.PI * 1.92);
  ctx.quadraticCurveTo(HX + 12, HY - 5, HX + 6, HY - 6);
  ctx.quadraticCurveTo(HX + 2, HY - 11, HX - 3, HY - 5);
  ctx.quadraticCurveTo(HX - 8, HY - 2, HX - 11, HY + 8);
  ctx.closePath();
  ctx.fill();
}

function kid(ctx: Ctx, mood: Mood, t: number): void {
  ball(ctx, 'kid');
  hair(ctx, '#3A3044', '#16121E');
  face(ctx, 'kid', mood, t);
  ctx.fillStyle = '#2B2F3E';
  ctx.beginPath();
  ctx.ellipse(HX, HY - 6, HR + 1, 4, -0.12, Math.PI * 1.05, Math.PI * 1.98);
  ctx.lineTo(HX + HR, HY - 6);
  ctx.ellipse(HX, HY - 6, HR + 1, 4, -0.12, 0, Math.PI, true);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, HX + 9, HY - 10, 1, 6, [[0, '#FFE9A8'], [1, '#FF9A3C']]);
  oval(ctx, HX + 9, HY - 9, 5.2, 4.2);
  ctx.fill();
  ctx.strokeStyle = '#2B2F3E';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  earpiece(ctx);
}

function earpiece(ctx: Ctx): void {
  ctx.fillStyle = '#C9D3E2';
  circle(ctx, HX - 9, HY + 3, 2.6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,210,230,0.8)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(HX - 9, HY + 5);
  for (let i = 1; i <= 4; i++) ctx.lineTo(HX - 9 + (i % 2 ? 1.6 : -1.6), HY + 5 + i * 2.4);
  ctx.stroke();
}

function catHead(ctx: Ctx, mood: Mood, t: number): void {
  const tw = Math.sin(t * 2.3) > 0.97 ? 0.2 : 0;
  for (const [x, rot, c] of [[HX - 7, -0.35, '#D9701F'], [HX + 5, 0.15 + tw, '#FFAE52']] as const) {
    ctx.save();
    ctx.translate(x, HY - 11);
    ctx.rotate(rot);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-6, 3);
    ctx.quadraticCurveTo(-1, -12, 1, -12);
    ctx.quadraticCurveTo(3, -10, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#FFB3C4';
    ctx.beginPath();
    ctx.moveTo(-2.5, 1);
    ctx.quadraticCurveTo(0, -7, 2.5, 1);
    ctx.fill();
    ctx.restore();
  }
  ball(ctx, 'cat');
  ctx.fillStyle = '#D9701F';
  for (const dx of [-6, -1, 4]) {
    roundRect(ctx, HX + dx - 1, HY - 14, 2, 6, 1);
    ctx.fill();
  }
  ctx.fillStyle = '#FFF0DC';
  oval(ctx, HX + 7, HY + 7, 7, 4.5);
  ctx.fill();
  face(ctx, 'cat', mood, t);
  ctx.fillStyle = '#FF7F98';
  oval(ctx, HX + 9, HY + 5.5, 1.6, 1.1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,40,20,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(HX + 12, HY + 6);
  ctx.lineTo(HX + 19, HY + 4);
  ctx.moveTo(HX + 12, HY + 8);
  ctx.lineTo(HX + 19, HY + 9);
  ctx.stroke();
}

function bunnyHead(ctx: Ctx, mood: Mood, t: number, flow: number): void {
  for (const [dx, k] of [[-6, 0], [-1, 1]] as const) {
    ctx.save();
    ctx.translate(HX + dx, HY - 11);
    ctx.rotate(-0.5 - flow * 0.7 + Math.sin(t * 9 + k) * 0.06 * (0.3 + flow));
    ctx.fillStyle = k ? '#FFF3F7' : '#F1D3E0';
    oval(ctx, 0, -12, 4.8, 13);
    ctx.fill();
    ctx.fillStyle = '#FFA6C4';
    oval(ctx, 0, -12, 2.2, 9.5);
    ctx.fill();
    ctx.restore();
  }
  ball(ctx, 'bunny');
  face(ctx, 'bunny', mood, t);
  ctx.fillStyle = '#FF8FB1';
  oval(ctx, HX + 9, HY + 5.5, 1.5, 1);
  ctx.fill();
  ctx.strokeStyle = '#2B2140';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(HX, HY, HR + 1.5, Math.PI * 1.15, Math.PI * 1.75);
  ctx.stroke();
  ctx.fillStyle = '#7B61FF';
  oval(ctx, HX - 5, HY + 1, 4.2, 5.4);
  ctx.fill();
  ctx.strokeStyle = '#2B2140';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(HX - 3, HY + 5);
  ctx.quadraticCurveTo(HX + 4, HY + 13, HX + 11, HY + 10);
  ctx.stroke();
  ctx.fillStyle = '#3DFFB4';
  circle(ctx, HX + 11, HY + 10, 1.8);
  ctx.fill();
}

function robotHead(ctx: Ctx, mood: Mood, t: number): void {
  ctx.strokeStyle = '#8E9BB4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(HX - 2, HY - 14);
  ctx.lineTo(HX - 4, HY - 23);
  ctx.stroke();
  ctx.fillStyle = Math.sin(t * 5) > 0 ? '#FF5E5B' : '#FFB627';
  circle(ctx, HX - 4, HY - 24, 3);
  ctx.fill();
  ball(ctx, 'robot');
  ctx.fillStyle = radGrad(ctx, HX + 5, HY, 1, 14, [[0, '#2A3D66'], [1, '#0E1628']]);
  roundRect(ctx, HX - 3, HY - 6, 18, 12, 5);
  ctx.fill();
  face(ctx, 'robot', mood, t, -2);
  ctx.fillStyle = '#7D8AA5';
  circle(ctx, HX - 8, HY + 1, 3.2);
  ctx.fill();
}

function ninjaHead(ctx: Ctx, mood: Mood, t: number, flow: number): void {
  ctx.strokeStyle = '#E63946';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    const w = Math.sin(t * 14 + i * 1.8) * (2 + flow * 4);
    ctx.beginPath();
    ctx.moveTo(HX - 12, HY - 6);
    ctx.bezierCurveTo(HX - 20, HY - 8 + w, HX - 28, HY - 4 - w + i * 4, HX - 36 - flow * 6, HY - 6 + w + i * 6);
    ctx.stroke();
  }
  ball(ctx, 'ninja');
  ctx.fillStyle = '#FFD9B8';
  roundRect(ctx, HX - 1, HY - 3, 17, 9, 4.5);
  ctx.fill();
  face(ctx, 'ninja', mood, t, -1);
  ctx.fillStyle = '#E63946';
  ctx.beginPath();
  ctx.ellipse(HX, HY - 8, HR + 0.6, 4, -0.1, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();
}

function astroHead(ctx: Ctx, mood: Mood, t: number): void {
  ball(ctx, 'astro');
  face(ctx, 'astro', mood, t, 1);
  ctx.fillStyle = radGrad(ctx, HX - 2, HY - 12, 2, HR + 4, [[0, '#7E9A66'], [1, '#3C4E30']]);
  ctx.beginPath();
  ctx.arc(HX, HY - 1, HR + 2.5, Math.PI * 0.9, Math.PI * 2.02);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = '#2A2F2A';
  roundRect(ctx, HX + 2, HY - 12, 12, 7, 3);
  ctx.fill();
  ctx.fillStyle = '#7CFF8A';
  circle(ctx, HX + 11, HY - 8.5, 2.1);
  ctx.fill();
  ctx.strokeStyle = '#2A2F2A';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(HX - 12, HY + 2);
  ctx.quadraticCurveTo(HX - 4, HY + 16, HX + 6, HY + 12);
  ctx.stroke();
}

function prisonerHead(ctx: Ctx, mood: Mood, t: number): void {
  ball(ctx, 'prisoner');
  hair(ctx, '#9A6A40', '#6A4426');
  face(ctx, 'prisoner', mood, t);
  ctx.fillStyle = '#4A4E5E';
  ctx.beginPath();
  ctx.arc(HX, HY - 3, HR + 1.2, Math.PI * 1.02, Math.PI * 1.98);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#F2F2F4';
  ctx.fillRect(HX - HR, HY - 6, HR * 2, 3);
}

/** Head for a skin; `flow` 0..1 is how much ears/tails stream back (speed). */
export function drawAgentHead(ctx: Ctx, id: LookId, mood: Mood, t: number, flow: number): void {
  switch (id) {
    case 'cat': return catHead(ctx, mood, t);
    case 'bunny': return bunnyHead(ctx, mood, t, flow);
    case 'robot': return robotHead(ctx, mood, t);
    case 'ninja': return ninjaHead(ctx, mood, t, flow);
    case 'astro': return astroHead(ctx, mood, t);
    case 'prisoner': return prisonerHead(ctx, mood, t);
    default: return kid(ctx, mood, t);
  }
}

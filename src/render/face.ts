// Chibi facial expressions shared by every skin.
import type { Mood } from '../types';
import { circle, oval, starPath, type Ctx } from './util';

export interface FaceStyle {
  readonly eye: string;
  readonly mouth: string | null; // null = mouth hidden (ninja mask, robot grille)
  readonly blush: boolean;
}

const EYE_DX = 5.6;

function dotEyes(ctx: Ctx, cx: number, cy: number, fs: FaceStyle, blink: boolean): void {
  ctx.fillStyle = fs.eye;
  ctx.strokeStyle = fs.eye;
  for (const s of [-1, 1]) {
    const ex = cx + s * EYE_DX;
    if (blink) {
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(ex - 2.4, cy + 0.5);
      ctx.quadraticCurveTo(ex, cy + 2, ex + 2.4, cy + 0.5);
      ctx.stroke();
      continue;
    }
    oval(ctx, ex, cy, 2.5, 3.3);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    circle(ctx, ex - 0.8, cy - 1.3, 1.05);
    ctx.fill();
    circle(ctx, ex + 0.9, cy + 1.2, 0.5);
    ctx.fill();
    ctx.fillStyle = fs.eye;
  }
}

function arcEyes(ctx: Ctx, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const ex = cx + s * EYE_DX;
    ctx.moveTo(ex - 2.8, cy + 1.2);
    ctx.quadraticCurveTo(ex, cy - 3.2, ex + 2.8, cy + 1.2);
  }
  ctx.stroke();
}

function xEyes(ctx: Ctx, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const ex = cx + s * EYE_DX;
    ctx.moveTo(ex - 2.3, cy - 2.3);
    ctx.lineTo(ex + 2.3, cy + 2.3);
    ctx.moveTo(ex + 2.3, cy - 2.3);
    ctx.lineTo(ex - 2.3, cy + 2.3);
  }
  ctx.stroke();
}

function mouth(ctx: Ctx, mood: Mood, cx: number, cy: number, color: string, t: number): void {
  const my = cy + 6.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  if (mood === 'cheer' || mood === 'happy') {
    const open = mood === 'cheer' ? 4.2 : 3;
    ctx.fillStyle = '#7A2234';
    ctx.beginPath();
    ctx.moveTo(cx - 3.8, my - 0.6);
    ctx.quadraticCurveTo(cx, my + open * 1.9, cx + 3.8, my - 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FF7F98';
    oval(ctx, cx, my + open * 0.8, 2, 1.1);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  if (mood === 'hurt') {
    ctx.moveTo(cx - 4, my + 0.6);
    for (let i = 1; i <= 4; i++) ctx.lineTo(cx - 4 + i * 2, my + (i % 2 ? -0.8 : 0.6) + Math.sin(t * 20) * 0.3);
  } else if (mood === 'worried') {
    ctx.ellipse(cx, my + 0.6, 1.8, 2.1, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(cx, my - 1.6, 3, 0.25, Math.PI - 0.25);
  }
  ctx.stroke();
}

function brows(ctx: Ctx, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(cx + s * (EYE_DX - 2.6), cy - 7);
    ctx.lineTo(cx + s * (EYE_DX + 2.4), cy - 5);
  }
  ctx.stroke();
}

export function drawFace(ctx: Ctx, mood: Mood, t: number, cx: number, cy: number, fs: FaceStyle): void {
  if (fs.blush) {
    ctx.fillStyle = 'rgba(255,110,140,0.42)';
    oval(ctx, cx - 9.6, cy + 4.6, 3.1, 1.9);
    ctx.fill();
    oval(ctx, cx + 9.6, cy + 4.6, 3.1, 1.9);
    ctx.fill();
  }
  if (mood === 'happy' || mood === 'cheer') arcEyes(ctx, cx, cy, fs.eye);
  else if (mood === 'hurt') xEyes(ctx, cx, cy, fs.eye);
  else dotEyes(ctx, cx, cy, fs, t % 3.3 < 0.13);
  if (mood === 'worried') brows(ctx, cx, cy, fs.eye);
  if (fs.mouth) mouth(ctx, mood, cx, cy, fs.mouth, t);
}

/** Little stars orbiting the head when cheering, swirl when hurt. */
export function drawMoodFx(ctx: Ctx, mood: Mood, t: number, cx: number, cy: number): void {
  if (mood === 'cheer') {
    ctx.fillStyle = '#FFD84D';
    ctx.strokeStyle = 'rgba(150,90,0,0.6)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + (i * Math.PI * 2) / 3;
      starPath(ctx, cx + Math.cos(a) * 24, cy - 10 + Math.sin(a) * 7, 4.2, 1.8, 5);
      ctx.fill();
      ctx.stroke();
    }
  } else if (mood === 'hurt') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = t * 9 + i * 0.5;
      const r = 3 + i * 0.5;
      const x = cx + Math.cos(a) * r * 1.6;
      const y = cy - 22 + Math.sin(a) * r * 0.45;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

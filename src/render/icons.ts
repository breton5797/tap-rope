// Vector glyphs shared by in-world pickups and rhythm-lane icons. Centered at (0,0).
import { circle, radGrad, starPath, type Ctx } from './util';

export function coinFace(ctx: Ctx, r: number): void {
  ctx.fillStyle = '#C77C00';
  circle(ctx, 0, 0, r);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -r * 0.35, -r * 0.4, r * 0.1, r * 1.1, [[0, '#FFF6C2'], [0.45, '#FFD84A'], [1, '#F2A210']]);
  circle(ctx, 0, 0, r * 0.86);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,200,0.8)';
  ctx.lineWidth = Math.max(1, r * 0.09);
  circle(ctx, 0, 0, r * 0.66);
  ctx.stroke();
  ctx.fillStyle = '#E39500';
  starPath(ctx, 0, r * 0.04, r * 0.42, r * 0.18, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2);
  ctx.fill();
}

export function shieldIcon(ctx: Ctx, s: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s * 0.55, -s * 0.7, s * 0.85, -s * 0.72);
  ctx.quadraticCurveTo(s * 0.9, s * 0.45, 0, s);
  ctx.quadraticCurveTo(-s * 0.9, s * 0.45, -s * 0.85, -s * 0.72);
  ctx.quadraticCurveTo(-s * 0.55, -s * 0.7, 0, -s);
  ctx.closePath();
  ctx.fillStyle = radGrad(ctx, -s * 0.3, -s * 0.4, 1, s * 1.3, [[0, '#9AD0FF'], [1, '#2F6FE0']]);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(1.2, s * 0.16);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  starPath(ctx, 0, 0, s * 0.42, s * 0.18, 5);
  ctx.fill();
}

export function clockIcon(ctx: Ctx, s: number): void {
  ctx.fillStyle = '#7B61FF';
  circle(ctx, 0, 0, s);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, 0, 0, s * 0.76);
  ctx.fill();
  ctx.fillStyle = '#7B61FF';
  ctx.fillRect(-s * 0.22, -s * 1.3, s * 0.44, s * 0.32);
  ctx.strokeStyle = '#3A2A8C';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, s * 0.15);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 0.52);
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.38, s * 0.12);
  ctx.stroke();
  ctx.fillStyle = '#FF5E5B';
  circle(ctx, 0, 0, s * 0.12);
  ctx.fill();
}

export function heartIcon(ctx: Ctx, s: number): void {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 1.3, s * 0.05, -s * 0.8, -s * 1.05, 0, -s * 0.38);
  ctx.bezierCurveTo(s * 0.8, -s * 1.05, s * 1.3, s * 0.05, 0, s * 0.9);
  ctx.closePath();
  ctx.fillStyle = radGrad(ctx, -s * 0.35, -s * 0.35, 1, s * 1.2, [[0, '#FF9DB0'], [1, '#E8264A']]);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.42, -s * 0.28, s * 0.18, s * 0.11, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Simple side-view bird glyph facing left. */
export function birdGlyph(ctx: Ctx, s: number, body: string, wing: string): void {
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.8, -s * 0.1);
  ctx.lineTo(s * 1.45, -s * 0.5);
  ctx.lineTo(s * 1.3, s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.ellipse(s * 0.15, -s * 0.15, s * 0.55, s * 0.32, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFB627';
  ctx.beginPath();
  ctx.moveTo(-s * 0.9, -s * 0.15);
  ctx.lineTo(-s * 1.45, s * 0.05);
  ctx.lineTo(-s * 0.9, s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1E1B3A';
  circle(ctx, -s * 0.45, -s * 0.22, s * 0.16);
  ctx.fill();
}

/** Glassy bubble that holds a pickup icon. */
export function bubble(ctx: Ctx, r: number, tint: string): void {
  ctx.fillStyle = radGrad(ctx, 0, 0, r * 0.2, r, [[0, 'rgba(255,255,255,0.08)'], [0.75, tint], [1, 'rgba(255,255,255,0.65)']]);
  circle(ctx, 0, 0, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.74, Math.PI * 1.12, Math.PI * 1.42);
  ctx.stroke();
}

// In-world pickup hardware (GDD-v6): credit chip (₵ funds), energy-shield emitter, chrono module
// (slow-mo) and armour plate (restores a ballistic cell). Centered at (0,0); baked into sprites.
import { roundRect, vGrad, type Ctx } from './util';

/** brass credit chip with an engraved ₵ */
export function creditChip(ctx: Ctx, r: number): void {
  ctx.fillStyle = '#5A4313';
  roundRect(ctx, -r, -r * 0.72, r * 2, r * 1.44, r * 0.28);
  ctx.fill();
  ctx.fillStyle = vGrad(ctx, -r * 0.62, r * 0.62, [[0, '#E9C873'], [0.5, '#B98A2E'], [1, '#7A5A1A']]);
  roundRect(ctx, -r * 0.88, -r * 0.6, r * 1.76, r * 1.2, r * 0.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,28,6,0.75)';
  ctx.font = `700 ${Math.round(r * 1.2)}px "Rajdhani", "IBM Plex Sans KR", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₵', 0, r * 0.06);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-r * 0.8, -r * 0.55, r * 1.6, r * 0.12);
}

/** hexagonal shield emitter with a teal core */
export function shieldIcon(ctx: Ctx, s: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
  }
  ctx.closePath();
  ctx.fillStyle = '#2A3036';
  ctx.fill();
  ctx.strokeStyle = '#5E6872';
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.stroke();
  ctx.fillStyle = '#3FE0D0';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-s * 0.12, -s * 0.12, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

/** chrono module: dark puck with a teal dial and a single hand */
export function clockIcon(ctx: Ctx, s: number): void {
  ctx.fillStyle = '#23282D';
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3FE0D0';
  ctx.lineWidth = Math.max(1, s * 0.16);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.68, -Math.PI * 0.5, Math.PI * 1.1);
  ctx.stroke();
  ctx.strokeStyle = '#E8ECEF';
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.4, -s * 0.36);
  ctx.stroke();
  ctx.fillStyle = '#5E6872';
  ctx.fillRect(-s * 0.18, -s * 1.22, s * 0.36, s * 0.3);
}

/** ballistic armour plate (restores one cell): curved steel plate with an amber band */
export function heartIcon(ctx: Ctx, s: number): void {
  ctx.beginPath();
  ctx.moveTo(-s * 0.8, -s * 0.9);
  ctx.quadraticCurveTo(0, -s * 1.1, s * 0.8, -s * 0.9);
  ctx.lineTo(s * 0.8, s * 0.55);
  ctx.quadraticCurveTo(0, s * 1.1, -s * 0.8, s * 0.55);
  ctx.closePath();
  ctx.fillStyle = vGrad(ctx, -s, s, [[0, '#7A838C'], [1, '#3A4047']]);
  ctx.fill();
  ctx.strokeStyle = '#1C2024';
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.stroke();
  ctx.fillStyle = '#FFB020';
  ctx.fillRect(-s * 0.8, -s * 0.2, s * 1.6, s * 0.28);
}

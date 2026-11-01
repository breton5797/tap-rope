// Office hazard readability (v2.1 ambiguity audit): one colour and one sign per move, whatever the prop —
// jump amber, slide blue, lane red, stay-low purple — and pickups that read as "good" (glow disc, no
// footprint). Pure helpers plus the small signs (height ticks, stay-low band, safe-lane arrow, rear arrow).
import type { LaneId, ObstacleKind } from '../../types';
import type { Ctx } from '../../render/util';
import { ACTION_COLORS, actionCue } from './props';

/** the hero's drawn height in logical px (agent.ts HERO_H 92 × RIG_SIZE 1.2) */
export const HERO_PX = 110;

/** the callout's move hint: the jump level, the move, and "뒤에서!" for an attack from behind */
export function calloutHint(kind: ObstacleKind, level: number, rear: boolean): string {
  const cue = actionCue(kind);
  const move = cue === 'jump'
    ? kind === 'beam' && level >= 2 ? `점프 ${Math.min(3, level)}단!` : '점프!'
    : cue === 'slide' ? '숙여!' : cue === 'low' ? '낮게!' : '옆으로!';
  return rear ? `뒤에서! ${move}` : move;
}

const LANES: readonly LaneId[] = [0, 1, 2];

/** the lanes a lane attack leaves open */
export function safeLanes(blocked: readonly number[]): LaneId[] {
  return LANES.filter((l) => !blocked.includes(l));
}

/** drawn pickup height: collectibles ~0.45×, power-ups / coins ~0.4× the hero */
export function pickupSize(collectible: boolean): number {
  return (collectible ? 0.45 : 0.4) * HERO_PX;
}

/** 1–3 stacked height ticks on a jump footprint (the jump level to use) */
export function heightTicks(ctx: Ctx, x: number, floorY: number, level: number, s: number): void {
  ctx.save();
  ctx.fillStyle = ACTION_COLORS.jump;
  ctx.strokeStyle = '#2E2433';
  ctx.lineWidth = 1;
  for (let i = 0; i < Math.min(3, Math.max(1, level)); i++) {
    const y = floorY + 4 * s - i * 5 * s;
    ctx.fillRect(x + 16 * s, y - 3 * s, 9 * s, 3 * s);
    ctx.strokeRect(x + 16 * s, y - 3 * s, 9 * s, 3 * s);
  }
  ctx.restore();
}

/** stay low: a dashed purple band at 2단 height across the lane with a "↓" under it */
export function stayLowBand(ctx: Ctx, x: number, bandY: number, width: number, s: number): void {
  ctx.save();
  ctx.strokeStyle = ACTION_COLORS.low;
  ctx.lineWidth = 2.2 * s;
  ctx.setLineDash(DASH);
  ctx.beginPath();
  ctx.moveTo(x - width / 2, bandY);
  ctx.lineTo(x + width / 2, bandY);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  arrow(ctx, x, bandY + 6 * s, 9 * s, 1, ACTION_COLORS.low);
  ctx.restore();
}

const DASH = [6, 4];
const NO_DASH: number[] = [];

/** a green chevron on a lane the lane attack leaves open */
export function safeArrow(ctx: Ctx, x: number, floorY: number, s: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#2FD27A';
  ctx.strokeStyle = '#1B6E44';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, floorY - 4 * s);
  ctx.lineTo(x + 7 * s, floorY);
  ctx.lineTo(x - 7 * s, floorY + 4 * s);
  ctx.lineTo(x - 3 * s, floorY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** a pulsing red arrow at the left screen edge pointing right: something comes from behind */
export function rearArrow(ctx: Ctx, x: number, y: number, t: number, reduced: boolean): void {
  const pulse = reduced ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(t * 9));
  ctx.save();
  ctx.globalAlpha *= pulse;
  ctx.fillStyle = ACTION_COLORS.lane;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x + 18, y);
  ctx.lineTo(x, y + 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** a small filled arrow pointing down (dir 1) or up (−1) */
function arrow(ctx: Ctx, x: number, y: number, size: number, dir: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - size / 2, y);
  ctx.lineTo(x + size / 2, y);
  ctx.lineTo(x, y + dir * size * 0.8);
  ctx.closePath();
  ctx.fill();
}

/** pickups read as good: a soft glow disc behind them (mint for mission collectibles, gold otherwise) */
export function glowDisc(ctx: Ctx, x: number, y: number, r: number, collectible: boolean, t: number): void {
  ctx.save();
  ctx.globalAlpha *= 0.55 + 0.15 * Math.sin(t * 4);
  ctx.fillStyle = collectible ? '#9FF5D6' : '#FFE38A';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha *= 0.8;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** a twinkle beside a pickup */
export function twinkle(ctx: Ctx, x: number, y: number, r: number, t: number): void {
  const k = Math.max(0, Math.sin(t * 6));
  if (k <= 0.05) return;
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.25, y - r * 0.25);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.25, y + r * 0.25);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.25, y + r * 0.25);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.25, y - r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The laser pointer (최팀장): a thin red beam from the boss's hand to the target height with a bright dot
 * there — head (slide), knee / ankle (jump) — instead of a prop sprite.
 */
export function pointerBeam(ctx: Ctx, hx: number, hy: number, x: number, y: number, s: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = 'rgba(255,40,60,0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = '#FF2A3A';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

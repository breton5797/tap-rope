// Rhythm lane: translucent panel at the bottom, items flow right→left into the hit ring.
import { LANE_LEAD, LOGICAL_W, type LaneItem, type ObstacleKind } from '../types';
import { birdGlyph, bubble, clockIcon, coinFace, heartIcon, shieldIcon } from './icons';
import { ballIcon, drawBallDots, drawMoveChip, ringIcon } from './lane-badges';
import { blit, blitScaled, type SpriteCache } from './sprites';
import { circle, clamp, FONT, LEVEL_DARK, LEVEL_FILL, LEVEL_LIGHT, outlinedText, radGrad, roundRect, vGrad, type Ctx } from './util';

export const LANE_X = 14;
export const LANE_Y = 542;
export const PANEL_W = LOGICAL_W - 28;
export const LANE_H = 68;
export const HIT_X = 64;
const CY = LANE_Y + LANE_H / 2;
const SPAN = LOGICAL_W - 90;
const ICON = 32;

const KIND_INDEX: Readonly<Record<ObstacleKind, number>> = {
  rope: 0, hurdle: 1, bird: 2, coin: 3, shield: 4, slow: 5, heart: 6, ring: 7, ball: 8,
};
const ICON_KEYS: string[] = [];
for (let i = 0; i < 36; i++) ICON_KEYS.push(`lane${i}`);

function panel(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(10,8,30,0.22)';
  roundRect(ctx, 0, 4, PANEL_W, LANE_H, 22);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,18,58,0.48)';
  roundRect(ctx, 0, 0, PANEL_W, LANE_H, 22);
  ctx.fill();
  ctx.fillStyle = vGrad(ctx, 0, LANE_H, [[0, 'rgba(255,255,255,0.2)'], [0.45, 'rgba(255,255,255,0.03)'], [1, 'rgba(255,255,255,0)']]);
  roundRect(ctx, 1, 1, PANEL_W - 2, LANE_H * 0.55, 21);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.2;
  roundRect(ctx, 0.6, 0.6, PANEL_W - 1.2, LANE_H - 1.2, 21.5);
  ctx.stroke();
  ctx.fillStyle = radGrad(ctx, HIT_X - LANE_X, LANE_H / 2, 4, 60, [[0, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']]);
  roundRect(ctx, 1, 1, 110, LANE_H - 2, 21);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let x = HIT_X - LANE_X + 30; x < PANEL_W - 14; x += 12) {
    circle(ctx, x, LANE_H / 2, 1.1);
    ctx.fill();
  }
}

function badge(ctx: Ctx, level: number, square: boolean): void {
  const r = 13;
  ctx.fillStyle = LEVEL_DARK[level];
  if (square) roundRect(ctx, -r - 1.5, -r - 1.5, r * 2 + 3, r * 2 + 3, 8);
  else circle(ctx, 0, 0, r + 1.5);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -4, -5, 1, r * 1.4, [[0, LEVEL_LIGHT[level]], [0.55, LEVEL_FILL[level]], [1, LEVEL_DARK[level]]]);
  if (square) roundRect(ctx, -r, -r, r * 2, r * 2, 6.5);
  else circle(ctx, 0, 0, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.4;
  if (square) roundRect(ctx, -r + 2, -r + 2, r * 2 - 4, r * 2 - 4, 5);
  else circle(ctx, 0, 0, r - 2);
  ctx.stroke();
  ctx.font = `900 17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  outlinedText(ctx, String(level), 0, 1, '#FFFFFF', LEVEL_DARK[level], 3.4);
}

function birdBadge(ctx: Ctx): void {
  ctx.fillStyle = '#3A2A8C';
  circle(ctx, 0, 0, 14.5);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -4, -5, 1, 18, [[0, '#B7A8FF'], [1, '#6A4FE0']]);
  circle(ctx, 0, 0, 13);
  ctx.fill();
  ctx.save();
  ctx.translate(-1, -2);
  birdGlyph(ctx, 6.5, '#FFFFFF', '#D6CCFF');
  ctx.restore();
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, 8.5, 8.5, 6.4);
  ctx.fill();
  ctx.strokeStyle = '#3A2A8C';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(8.5, 5);
  ctx.lineTo(8.5, 11.5);
  ctx.moveTo(5.8, 9);
  ctx.lineTo(8.5, 11.8);
  ctx.lineTo(11.2, 9);
  ctx.stroke();
}

function iconSprite(ctx: Ctx, arg: number): void {
  const kind = Math.floor(arg / 4);
  const level = clamp(arg % 4, 1, 3);
  if (kind === 0 || kind === 1) {
    badge(ctx, level, kind === 1);
    return;
  }
  if (kind === 2) {
    birdBadge(ctx);
    return;
  }
  if (kind === 7) {
    ringIcon(ctx);
    return;
  }
  if (kind === 8) {
    ballIcon(ctx);
    return;
  }
  bubble(ctx, 11.5, 'rgba(255,255,255,0.18)');
  if (kind === 3) coinFace(ctx, 8.5);
  else if (kind === 4) shieldIcon(ctx, 7);
  else if (kind === 5) clockIcon(ctx, 6.5);
  else heartIcon(ctx, 7);
}

function itemAlpha(tu: number): number {
  const fadeIn = clamp((LANE_LEAD - tu) / 0.35, 0, 1);
  const fadeOut = tu < 0 ? clamp(1 + tu / 0.28, 0, 1) : 1;
  return fadeIn * fadeOut;
}

function drawItem(ctx: Ctx, it: LaneItem, sprites: SpriteCache, t: number): void {
  const tu = it.timeUntil;
  const alpha = itemAlpha(tu);
  if (alpha <= 0) return;
  const x = HIT_X + (tu / LANE_LEAD) * SPAN;
  const near = tu >= 0 && tu < 0.45 ? 1 - tu / 0.45 : 0;
  const pop = tu < 0 ? 1 + -tu * 1.6 : 1 + near * 0.22 + near * 0.05 * Math.sin(t * 30);
  let n = 0;
  for (let i = 0; i < it.kinds.length; i++) if (it.kinds.indexOf(it.kinds[i]) === i) n++;
  const scale = (n > 1 ? 0.74 : 1) * pop;
  const gap = n > 2 ? 21 : 24;
  let row = 0;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < it.kinds.length; i++) {
    const kind = it.kinds[i];
    if (it.kinds.indexOf(kind) !== i) continue;
    const arg = KIND_INDEX[kind] * 4 + clamp(it.level, 1, 3);
    const sp = sprites.get(ICON_KEYS[arg], ICON + 6, ICON + 6, (ICON + 6) / 2, (ICON + 6) / 2, iconSprite, arg);
    const y = CY + (row - (n - 1) / 2) * gap * (n > 1 ? 1 : 0);
    blitScaled(ctx, sp, x, y, scale, scale);
    if (row === 0) drawMoveChip(ctx, sprites, it.move, x + 12 * scale, y - 12 * scale, Math.min(1.15, pop));
    row++;
  }
  drawBallDots(ctx, x, LANE_Y + LANE_H - 6, it.ballLanes);
  ctx.globalAlpha = 1;
}

function hitRing(ctx: Ctx, glow: number, t: number): void {
  if (glow > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(0.22 * glow).toFixed(3)})`;
    circle(ctx, HIT_X, CY, 22 + glow * 6);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 6;
  circle(ctx, HIT_X, CY, 21);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 2.4;
  circle(ctx, HIT_X, CY, 21 + Math.sin(t * 4) * 0.4);
  ctx.stroke();
}

export function drawLane(ctx: Ctx, lane: readonly LaneItem[], t: number, sprites: SpriteCache): void {
  blit(ctx, sprites.get('lanePanel', PANEL_W + 2, LANE_H + 8, 1, 1, panel), LANE_X, LANE_Y);
  let glow = 0;
  for (const it of lane) glow = Math.max(glow, 1 - Math.abs(it.timeUntil) / 0.18);
  hitRing(ctx, clamp(glow, 0, 1), t);
  for (let i = lane.length - 1; i >= 0; i--) drawItem(ctx, lane[i], sprites, t);
}

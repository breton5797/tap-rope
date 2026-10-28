// Rhythm lane (tactical HUD strip): dark glass panel at the bottom, items flow right→left into the hit ring,
// which sits right under the agent (PLAYER_X) so the lane lines up with the corridor.
// v8: drawn in its own transform (view ls / lox / loy, docked to the bottom on zoomed portrait screens);
// jump / slide icons reach the ring at the ideal input time (lane-timing.ts) and the ring pulses then.
import { DEFAULT_PHYSICS } from '../core/physics';
import { LANE_LEAD, LOGICAL_W, PLAYER_X, type LaneItem, type ObstacleKind } from '../types';
import { displayTimes } from './lane-timing';
import { LANE_HEIGHT, LANE_TOP, type View } from './view';
import {
  beamIcon, chaserIcon, drawChip, drawFromArrow, drawLaneMarker, droneIcon, dropIcon, floorIcon, guardIcon, pickupIcon, slideIcon,
} from './lane-icons';
import { blit, blitScaled, type SpriteCache } from './sprites';
import { circle, clamp, roundRect, type Ctx } from './util';

export const LANE_X = 14;
export const LANE_Y = LANE_TOP;
export const PANEL_W = LOGICAL_W - 28;
export const LANE_H = LANE_HEIGHT;
/** css px kept clear at the screen edges when the panel slides right (zoomed: agent further left) */
const EDGE = 8;
export const HIT_X = PLAYER_X;
const CY = LANE_Y + LANE_H / 2;
const SPAN = LOGICAL_W - HIT_X - 30;
const ICON = 32;

const KIND_INDEX: Readonly<Record<ObstacleKind, number>> = {
  floor: 0, beam: 1, high: 2, ceiling: 3, drone: 4, coin: 5, shield: 6, slow: 7, heart: 8, guard: 9, drop: 10, chaser: 11,
};
const ICON_KEYS: string[] = [];
for (let i = 0; i < 48; i++) ICON_KEYS.push(`lane${i}`);

/** Dark glass strip with 1px lines and tick marks (tactical HUD). */
function panel(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(6,8,10,0.66)';
  roundRect(ctx, 0, 0, PANEL_W, LANE_H, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(63,224,208,0.32)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, PANEL_W - 1, LANE_H - 1, 3.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(63,224,208,0.75)';
  ctx.fillRect(0, 0, 14, 1.5);
  ctx.fillRect(PANEL_W - 14, LANE_H - 1.5, 14, 1.5);
  // timeline ticks (one per ~0.25s)
  ctx.fillStyle = 'rgba(232,236,239,0.22)';
  for (let x = HIT_X - LANE_X + 28, i = 0; x < PANEL_W - 10; x += SPAN / 9.6, i++) {
    const h = i % 4 === 3 ? 7 : 3.5;
    ctx.fillRect(x, LANE_H / 2 - h / 2, 1, h);
  }
  ctx.fillStyle = 'rgba(232,236,239,0.1)';
  ctx.fillRect(HIT_X - LANE_X + 24, LANE_H / 2 - 0.5, PANEL_W - (HIT_X - LANE_X + 34), 1);
}

function iconSprite(ctx: Ctx, arg: number): void {
  const kind = Math.floor(arg / 4);
  const level = clamp(arg % 4, 1, 3);
  if (kind === 0) floorIcon(ctx);
  else if (kind === 1) beamIcon(ctx, level);
  else if (kind === 2 || kind === 3) slideIcon(ctx, kind === 3);
  else if (kind === 4) droneIcon(ctx);
  else if (kind === 9) guardIcon(ctx);
  else if (kind === 10) dropIcon(ctx);
  else if (kind === 11) chaserIcon(ctx);
  else pickupIcon(ctx, kind - 5);
}

/** `arrive` = real time until arrival (fade in at the lead edge), `tu` = drawn time until the ring */
function itemAlpha(arrive: number, tu: number): number {
  const fadeIn = clamp((LANE_LEAD - arrive) / 0.35, 0, 1);
  const fadeOut = tu < 0 ? clamp(1 + tu / 0.25, 0, 1) : 1;
  return fadeIn * fadeOut;
}

function drawItem(ctx: Ctx, it: LaneItem, tu: number, sprites: SpriteCache, t: number): void {
  const alpha = itemAlpha(it.timeUntil, tu);
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
    const level = kind === 'beam' ? clamp(it.level, 1, 3) : 1;
    const arg = KIND_INDEX[kind] * 4 + level;
    const sp = sprites.get(ICON_KEYS[arg], ICON + 6, ICON + 6, (ICON + 6) / 2, (ICON + 6) / 2, iconSprite, arg);
    const y = CY + (row - (n - 1) / 2) * gap * (n > 1 ? 1 : 0);
    blitScaled(ctx, sp, x, y, scale, scale);
    if (row === 0) {
      // lane beats: the 3-lane marker replaces the direction arrow (the icon shape implies it)
      if (it.blocked.length > 0) drawLaneMarker(ctx, it.blocked, x + 23 * scale, y + 3 * scale, Math.min(1.1, pop));
      else drawFromArrow(ctx, it.from, x, y);
      drawChip(ctx, sprites, it.move, x + 12 * scale, y - 12 * scale, Math.min(1.15, pop));
    }
    row++;
  }
  ctx.globalAlpha = 1;
}

/** v8: expanding ring for ~0.3 s after an icon crosses the hit marker (the moment to press) */
function pulseRing(ctx: Ctx, age: number): void {
  const k = age / 0.3;
  if (k < 0 || k >= 1) return;
  ctx.strokeStyle = '#3FE0D0';
  ctx.globalAlpha = 0.85 * (1 - k);
  ctx.lineWidth = 2.5 * (1 - k) + 0.5;
  circle(ctx, HIT_X, CY, 19 + 14 * k);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Hit marker: thin reticle with corner brackets; brightens as an item crosses it. */
function hitRing(ctx: Ctx, glow: number): void {
  const r = 19;
  if (glow > 0) {
    ctx.fillStyle = '#3FE0D0';
    ctx.globalAlpha = 0.16 * glow;
    circle(ctx, HIT_X, CY, r + 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = glow > 0.5 ? '#3FE0D0' : 'rgba(232,236,239,0.75)';
  ctx.lineWidth = 1.2;
  circle(ctx, HIT_X, CY, r);
  ctx.stroke();
  ctx.beginPath();
  for (const [dx, dy] of BRACKETS) {
    ctx.moveTo(HIT_X + dx * (r + 4), CY + dy * (r + 4 - 5));
    ctx.lineTo(HIT_X + dx * (r + 4), CY + dy * (r + 4));
    ctx.lineTo(HIT_X + dx * (r + 4 - 5), CY + dy * (r + 4));
  }
  ctx.stroke();
}

const BRACKETS: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

const DRAW_TU = new Float64Array(64);

/** Lane logical x of the panel's left edge: LANE_X, nudged right if the screen edge would clip it. */
export function panelX(v: View): number {
  return Math.max(LANE_X, (EDGE - v.lox) / v.ls);
}

/** Draws the lane in its own transform (view ls / lox / loy); leaves the transform set to it. */
export function drawLane(ctx: Ctx, v: View, lane: readonly LaneItem[], t: number, sprites: SpriteCache, reduced: boolean): void {
  const k = v.ls * v.dpr;
  ctx.setTransform(k, 0, 0, k, v.lox * v.dpr, v.loy * v.dpr);
  blit(ctx, sprites.get('lanePanel', PANEL_W + 2, LANE_H + 8, 1, 1, panel), panelX(v), LANE_Y);
  const n = displayTimes(lane, DEFAULT_PHYSICS, DRAW_TU);
  let glow = 0;
  let pulse = -1;
  for (let i = 0; i < n; i++) {
    const tu = DRAW_TU[i];
    glow = Math.max(glow, 1 - Math.abs(tu) / 0.18);
    if (tu <= 0 && (pulse < 0 || -tu < pulse)) pulse = -tu;
  }
  hitRing(ctx, clamp(glow, 0, 1));
  if (!reduced && pulse >= 0) pulseRing(ctx, pulse);
  for (let i = n - 1; i >= 0; i--) drawItem(ctx, lane[i], DRAW_TU[i], sprites, t);
}

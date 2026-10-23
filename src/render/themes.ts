// Corridor themes: 0 security outpost, 1 research lab, 2 prison block, 3 industrial / sewer.
// A wall tile = the theme's base (surface, panels, pipes, trim) + three slots filled with
// features picked from a seed, so each of the WALL_VARIANTS tiles looks different.
import { GROUND_Y, type Variant } from '../types';
import { CEIL_Y } from './layout';
import { seeded, vGrad, type Ctx, type Stops } from './util';
import { at, FEATURES } from './wall-features';
import { hazardBand, panels, pipe, wallLamp } from './wall-kit';

export const WALL_W = 480;
export const PLANE_W = 480;
export const WALL_VARIANTS = 5;

export interface ThemeArt {
  readonly top: Stops; // structure above the ceiling
  readonly girder: string;
  readonly duct: readonly [string, string];
  readonly led: string;
  readonly ceil: readonly [string, string];
  readonly ceilLight: string;
  readonly floorTop: readonly [string, string];
  readonly floorFront: readonly [string, string];
  readonly seam: string;
  readonly floorLine: string;
  readonly lamp: string;
  base(ctx: Ctx, w: number): void;
}

const WALL_TOP = CEIL_Y + 4;
const MID = Math.round((CEIL_Y + GROUND_Y) / 2);
const SLOTS: readonly (readonly [number, number])[] = [[14, 150], [184, 112], [318, 148]];

function outpostBase(ctx: Ctx, w: number): void {
  ctx.fillStyle = vGrad(ctx, WALL_TOP, GROUND_Y, [[0, '#2A3450'], [1, '#1E2640']]);
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  panels(ctx, 0, w, WALL_TOP + 14, MID, 80, '#34415F', '#1C2338', 'rgba(255,255,255,0.08)');
  panels(ctx, 0, w, MID, GROUND_Y - 24, 80, '#303C58', '#1C2338', 'rgba(255,255,255,0.06)');
  pipe(ctx, 0, w, WALL_TOP + 8, 4.5, '#6E7A96', '#3A4460', '#2A3248');
  hazardBand(ctx, 0, w, GROUND_Y - 22, 9);
}

function labBase(ctx: Ctx, w: number): void {
  ctx.fillStyle = vGrad(ctx, WALL_TOP, GROUND_Y, [[0, '#E9F0F4'], [1, '#C9D6DE']]);
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  panels(ctx, 0, w, WALL_TOP + 10, MID - 10, 96, '#F2F7FA', '#B9C7D2', 'rgba(255,255,255,0.7)');
  panels(ctx, 0, w, MID - 10, GROUND_Y - 36, 96, '#EDF3F7', '#B9C7D2', 'rgba(255,255,255,0.6)');
  ctx.fillStyle = '#3DDCB4';
  ctx.fillRect(0, GROUND_Y - 34, w, 5);
  ctx.fillStyle = '#9EAAB6';
  ctx.fillRect(0, GROUND_Y - 26, w, 26);
}

function prisonBase(ctx: Ctx, w: number): void {
  ctx.fillStyle = '#433D58';
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  ctx.strokeStyle = 'rgba(20,16,30,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let y = WALL_TOP, r = 0; y < GROUND_Y; y += 18, r++) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    for (let x = (r % 2) * 22; x < w; x += 44) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 18);
    }
  }
  ctx.stroke();
  // muted trim: a red stripe here would hide red knee-height lasers
  ctx.fillStyle = '#6E6390';
  ctx.fillRect(0, GROUND_Y - 24, w, 6);
}

function industrialBase(ctx: Ctx, w: number): void {
  ctx.fillStyle = vGrad(ctx, WALL_TOP, GROUND_Y, [[0, '#3E2A2C'], [1, '#2A1E22']]);
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  panels(ctx, 0, w, at(0.3), GROUND_Y - 20, 60, '#4A3434', '#24181A', 'rgba(255,200,170,0.07)');
  pipe(ctx, 0, w, at(0.1), 12, '#2FA79A', '#176258', '#0F4A42');
  pipe(ctx, 0, w, at(0.19), 6, '#C88A50', '#7A4A2A', '#5A3420');
  pipe(ctx, 0, w, at(0.25), 4, '#8A8F9E', '#4A4E5A', '#3A3E4A');
  ctx.fillStyle = 'rgba(120,255,150,0.18)';
  ctx.fillRect(0, GROUND_Y - 18, w, 18);
}

export const THEMES: readonly ThemeArt[] = [
  {
    top: [[0, '#0B0F1C'], [1, '#1A2238']], girder: '#26304A', duct: ['#3A4766', '#222A40'], led: '#3DFFB4',
    ceil: ['#3A4562', '#232B42'], ceilLight: '#CFE6FF', floorTop: ['#4A5470', '#353D56'], floorFront: ['#262C40', '#12151F'],
    seam: 'rgba(10,14,26,0.55)', floorLine: '#8C9BC0', lamp: 'rgba(255,214,140,0.35)', base: outpostBase,
  },
  {
    top: [[0, '#1A2028'], [1, '#3A4652']], girder: '#56636E', duct: ['#C9D4DD', '#8C99A6'], led: '#3DDCB4',
    ceil: ['#D9E3EA', '#A9B6C1'], ceilLight: '#FFFFFF', floorTop: ['#E4EBEF', '#BFCBD4'], floorFront: ['#8796A3', '#4E5966'],
    seam: 'rgba(110,128,142,0.5)', floorLine: '#FFFFFF', lamp: 'rgba(200,255,240,0.3)', base: labBase,
  },
  {
    top: [[0, '#0C0A12'], [1, '#221D2E']], girder: '#332C42', duct: ['#4A4258', '#2A2436'], led: '#FF5E5B',
    ceil: ['#4A4360', '#2C2640'], ceilLight: '#FFE6B8', floorTop: ['#5A546A', '#423C52'], floorFront: ['#2A2536', '#14111C'],
    seam: 'rgba(16,12,24,0.5)', floorLine: '#FFC93C', lamp: 'rgba(255,220,160,0.3)', base: prisonBase,
  },
  {
    top: [[0, '#0A0A0C'], [1, '#22191A']], girder: '#3A2A2A', duct: ['#5A4A40', '#33281F'], led: '#7AF0A0',
    ceil: ['#4C3A36', '#2C2220'], ceilLight: '#C8FFC8', floorTop: ['#4E4A4A', '#353131'], floorFront: ['#1E2A26', '#0A1210'],
    seam: 'rgba(0,0,0,0.5)', floorLine: '#7AF0A0', lamp: 'rgba(160,255,170,0.25)', base: industrialBase,
  },
];

export function themeOf(world: number): ThemeArt {
  return THEMES[world] ?? THEMES[0];
}

const outdoor = (v: Variant): boolean => v === 'night' || v === 'dawn';

/** One wall tile: theme base + seeded features in three slots. */
export function drawWall(ctx: Ctx, world: number, w: number, variant: Variant, seed: number): void {
  const th = themeOf(world);
  const set = FEATURES[world] ?? FEATURES[0];
  const rnd = seeded(seed * 7919 + world * 131 + 17);
  th.base(ctx, w);
  let prev = -1;
  SLOTS.forEach(([x, sw], i) => {
    if (outdoor(variant) && i !== 1) {
      set.window(ctx, x, sw, rnd, variant);
      return;
    }
    let k = Math.floor(rnd() * set.list.length);
    if (k === prev) k = (k + 1) % set.list.length;
    prev = k;
    set.list[k](ctx, x, sw, rnd, variant);
  });
  for (const lx of [174, 308]) if (rnd() < 0.75) wallLamp(ctx, lx, at(0.1), th.lamp);
}

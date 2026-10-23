// Corridor themes: 0 security outpost, 1 research lab, 2 prison block, 3 industrial / sewer.
// Each draws one back-wall tile (parallax) — the floor + ceiling plane is in plane.ts.
import { GROUND_Y, type Variant } from '../types';
import { CEIL_Y } from './layout';
import { circle, roundRect, seeded, vGrad, type Ctx, type Stops } from './util';
import {
  camera, cell, crate, hazardBand, monitor, panels, pipe, sign, wallLamp, windowFrame,
} from './wall-kit';

export const WALL_W = 480;
export const PLANE_W = 480;

export interface ThemeArt {
  readonly top: Stops; // structure above the ceiling
  readonly girder: string;
  readonly ceil: readonly [string, string];
  readonly ceilLight: string;
  readonly floorTop: readonly [string, string];
  readonly floorFront: readonly [string, string];
  readonly seam: string;
  readonly floorLine: string;
  drawWall(ctx: Ctx, w: number, variant: Variant): void;
}

const outdoor = (v: Variant): boolean => v === 'night' || v === 'dawn';
const WALL_TOP = CEIL_Y + 4;
const MID = Math.round((CEIL_Y + GROUND_Y) / 2);
/** y at a fraction of the way from the ceiling down to the floor */
const at = (f: number): number => Math.round(CEIL_Y + (GROUND_Y - CEIL_Y) * f);

function bigWindows(ctx: Ctx, frame: string, variant: Variant): void {
  windowFrame(ctx, 26, at(0.18), 170, 150, frame, variant, 11);
  windowFrame(ctx, 266, at(0.18), 170, 150, frame, variant, 23);
  if (variant !== 'dawn') return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const x of [26, 266]) {
    const g = ctx.createLinearGradient(0, at(0.2), 0, GROUND_Y);
    g.addColorStop(0, 'rgba(255,190,120,0.22)');
    g.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + 20, at(0.2));
    ctx.lineTo(x + 170, at(0.2));
    ctx.lineTo(x + 120, GROUND_Y);
    ctx.lineTo(x - 40, GROUND_Y);
    ctx.fill();
  }
  ctx.restore();
}

function outpostWall(ctx: Ctx, w: number, variant: Variant): void {
  ctx.fillStyle = vGrad(ctx, WALL_TOP, GROUND_Y, [[0, '#2A3450'], [1, '#1E2640']]);
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  panels(ctx, 0, w, WALL_TOP + 14, MID, 80, '#34415F', '#1C2338', 'rgba(255,255,255,0.08)');
  panels(ctx, 0, w, MID, GROUND_Y - 24, 80, '#303C58', '#1C2338', 'rgba(255,255,255,0.06)');
  pipe(ctx, 0, w, WALL_TOP + 8, 4.5, '#6E7A96', '#3A4460', '#2A3248');
  if (outdoor(variant)) bigWindows(ctx, '#56627E', variant);
  else {
    windowFrame(ctx, 36, at(0.3), 100, 70, '#56627E', variant, 5);
    windowFrame(ctx, 290, at(0.3), 100, 70, '#56627E', variant, 9);
    sign(ctx, 210, at(0.42), 'SECURITY', '#FFC93C', '#26232E');
    camera(ctx, 210, WALL_TOP + 12);
  }
  hazardBand(ctx, 0, w, GROUND_Y - 22, 9);
  wallLamp(ctx, 160, at(0.12), 'rgba(255,214,140,0.35)');
  wallLamp(ctx, 400, at(0.12), 'rgba(255,214,140,0.35)');
  crate(ctx, 430, GROUND_Y - 22, 26);
  crate(ctx, 446, GROUND_Y - 48, 20);
}

function labWall(ctx: Ctx, w: number, variant: Variant): void {
  ctx.fillStyle = vGrad(ctx, WALL_TOP, GROUND_Y, [[0, '#E9F0F4'], [1, '#C9D6DE']]);
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  panels(ctx, 0, w, WALL_TOP + 10, MID - 10, 96, '#F2F7FA', '#B9C7D2', 'rgba(255,255,255,0.7)');
  panels(ctx, 0, w, MID - 10, GROUND_Y - 36, 96, '#EDF3F7', '#B9C7D2', 'rgba(255,255,255,0.6)');
  if (outdoor(variant)) bigWindows(ctx, '#9AAAB8', variant);
  else {
    labRoom(ctx, 24, at(0.2), 140, 120);
    monitor(ctx, 196, at(0.26), 60, 40, '#3DFFB4', 4);
    monitor(ctx, 196, at(0.44), 60, 28, '#7BE0FF', 8);
    labRoom(ctx, 292, at(0.2), 140, 120);
  }
  ctx.fillStyle = '#3DDCB4';
  ctx.fillRect(0, GROUND_Y - 34, w, 5);
  ctx.fillStyle = '#9EAAB6';
  ctx.fillRect(0, GROUND_Y - 26, w, 26);
  sign(ctx, 226, at(0.62), 'LAB-07', '#3DDCB4', '#0E3A32');
  wallLamp(ctx, 120, at(0.08), 'rgba(200,255,240,0.3)');
  wallLamp(ctx, 360, at(0.08), 'rgba(200,255,240,0.3)');
}

function labRoom(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = vGrad(ctx, y, y + h, [[0, '#BFF3E6'], [1, '#7FD8C6']]);
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  const rnd = seeded(x);
  for (let i = 0; i < 4; i++) {
    const fx = x + 16 + i * 30;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    roundRect(ctx, fx, y + h - 34, 12, 26, 5);
    ctx.fill();
    ctx.fillStyle = ['#FF7AB6', '#7BE0FF', '#B8FF7A', '#FFD27A'][i];
    roundRect(ctx, fx + 1.5, y + h - 20 - rnd() * 8, 9, 12, 4);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + 6, y + 6, w * 0.25, 4);
  ctx.strokeStyle = '#9AAAB8';
  ctx.lineWidth = 4;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();
}

function prisonWall(ctx: Ctx, w: number, variant: Variant): void {
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
  if (outdoor(variant)) bigWindows(ctx, '#6A6280', variant);
  else {
    cell(ctx, 20, at(0.3), 130, GROUND_Y - 26 - at(0.3), 'A-12');
    cell(ctx, 260, at(0.3), 130, GROUND_Y - 26 - at(0.3), 'A-13');
  }
  ctx.fillStyle = '#C8323F';
  ctx.fillRect(0, GROUND_Y - 24, w, 6);
  sign(ctx, 205, at(0.14), 'BLOCK A', '#C8323F', '#FFFFFF');
  wallLamp(ctx, 205, at(0.3), 'rgba(255,220,160,0.3)');
  wallLamp(ctx, 445, at(0.3), 'rgba(255,220,160,0.3)');
}

function valve(ctx: Ctx, x: number, y: number): void {
  ctx.strokeStyle = '#C8323F';
  ctx.lineWidth = 3;
  circle(ctx, x, y, 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 9, y);
  ctx.lineTo(x + 9, y);
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x, y + 9);
  ctx.stroke();
}

function industrialWall(ctx: Ctx, w: number, variant: Variant): void {
  ctx.fillStyle = vGrad(ctx, WALL_TOP, GROUND_Y, [[0, '#3E2A2C'], [1, '#2A1E22']]);
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  panels(ctx, 0, w, at(0.3), GROUND_Y - 20, 60, '#4A3434', '#24181A', 'rgba(255,200,170,0.07)');
  if (outdoor(variant)) bigWindows(ctx, '#6A5050', variant);
  pipe(ctx, 0, w, at(0.1), 12, '#2FA79A', '#176258', '#0F4A42');
  pipe(ctx, 0, w, at(0.19), 6, '#C88A50', '#7A4A2A', '#5A3420');
  pipe(ctx, 0, w, at(0.25), 4, '#8A8F9E', '#4A4E5A', '#3A3E4A');
  for (const x of [150, 390]) {
    ctx.fillStyle = '#23857A';
    ctx.fillRect(x - 8, at(0.1), 16, GROUND_Y - at(0.1) - 20);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x - 5, at(0.1), 3, GROUND_Y - at(0.1) - 20);
  }
  valve(ctx, 150, at(0.5));
  valve(ctx, 390, at(0.62));
  sign(ctx, 270, at(0.42), 'DANGER', '#FFC93C', '#26232E');
  ctx.fillStyle = 'rgba(120,255,150,0.18)';
  ctx.fillRect(0, GROUND_Y - 18, w, 18);
  wallLamp(ctx, 60, at(0.32), 'rgba(160,255,170,0.25)');
  wallLamp(ctx, 300, at(0.32), 'rgba(160,255,170,0.25)');
}

export const THEMES: readonly ThemeArt[] = [
  {
    top: [[0, '#0B0F1C'], [1, '#1A2238']], girder: '#26304A', ceil: ['#3A4562', '#232B42'], ceilLight: '#CFE6FF',
    floorTop: ['#4A5470', '#353D56'], floorFront: ['#262C40', '#12151F'], seam: 'rgba(10,14,26,0.55)', floorLine: '#8C9BC0',
    drawWall: outpostWall,
  },
  {
    top: [[0, '#1A2028'], [1, '#3A4652']], girder: '#56636E', ceil: ['#D9E3EA', '#A9B6C1'], ceilLight: '#FFFFFF',
    floorTop: ['#E4EBEF', '#BFCBD4'], floorFront: ['#8796A3', '#4E5966'], seam: 'rgba(110,128,142,0.5)', floorLine: '#FFFFFF',
    drawWall: labWall,
  },
  {
    top: [[0, '#0C0A12'], [1, '#221D2E']], girder: '#332C42', ceil: ['#4A4360', '#2C2640'], ceilLight: '#FFE6B8',
    floorTop: ['#5A546A', '#423C52'], floorFront: ['#2A2536', '#14111C'], seam: 'rgba(16,12,24,0.5)', floorLine: '#FFC93C',
    drawWall: prisonWall,
  },
  {
    top: [[0, '#0A0A0C'], [1, '#22191A']], girder: '#3A2A2A', ceil: ['#4C3A36', '#2C2220'], ceilLight: '#C8FFC8',
    floorTop: ['#4E4A4A', '#353131'], floorFront: ['#1E2A26', '#0A1210'], seam: 'rgba(0,0,0,0.5)', floorLine: '#7AF0A0',
    drawWall: industrialWall,
  },
];

export function themeOf(world: number): ThemeArt {
  return THEMES[world] ?? THEMES[0];
}

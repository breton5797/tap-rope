// Corridor themes: 0 security outpost, 1 research lab, 2 prison block, 3 industrial / sewer; the office build's
// part 2 adds 4 street / bus stop, 5 subway concourse, 6 food alley (outdoor-ish, warm, pastel-friendly).
// Each theme's procedural base finish (surface, panels, pipes, trim) is the fallback back wall when
// its photo art is missing; colours here also drive the ceiling band, floor and service space.
import { GROUND_Y } from '../types';
import { CEIL_Y } from './layout';
import { circle, roundRect, vGrad, type Ctx, type Stops } from './util';

export const WALL_W = 480;
export const PLANE_W = 480;

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

function panels(ctx: Ctx, x0: number, w: number, y0: number, y1: number, pw: number, fill: string, edge: string, light: string): void {
  for (let x = x0; x < x0 + w; x += pw) {
    ctx.fillStyle = fill;
    roundRect(ctx, x + 1.5, y0 + 1.5, pw - 3, y1 - y0 - 3, 4);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = light;
    ctx.fillRect(x + 4, y0 + 4, pw - 8, 2);
    ctx.fillStyle = edge;
    for (const [bx, by] of [[x + 6, y0 + 8], [x + pw - 6, y0 + 8], [x + 6, y1 - 8], [x + pw - 6, y1 - 8]] as const) {
      circle(ctx, bx, by, 1.3);
      ctx.fill();
    }
  }
}

function pipe(ctx: Ctx, x0: number, w: number, y: number, r: number, c0: string, c1: string, joint: string): void {
  ctx.fillStyle = vGrad(ctx, y - r, y + r, [[0, c0], [0.45, c0], [1, c1]]);
  ctx.fillRect(x0, y - r, w, r * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x0, y - r + 1.5, w, Math.max(1, r * 0.35));
  ctx.fillStyle = joint;
  for (let x = x0 + 30; x < x0 + w; x += 120) {
    roundRect(ctx, x, y - r - 2, 8, r * 2 + 4, 2);
    ctx.fill();
  }
}

function hazardBand(ctx: Ctx, x0: number, w: number, y: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#FFC93C';
  ctx.fillRect(x0, y, w, h);
  ctx.fillStyle = '#26232E';
  for (let x = x0 - h; x < x0 + w + h; x += h * 2) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + h, y);
    ctx.lineTo(x + h * 2, y);
    ctx.lineTo(x + h, y + h);
    ctx.fill();
  }
  ctx.restore();
}

const WALL_TOP = CEIL_Y + 4;
const MID = Math.round((CEIL_Y + GROUND_Y) / 2);
/** y at fraction f of the way from the ceiling to the floor line */
const at = (f: number): number => Math.round(CEIL_Y + (GROUND_Y - CEIL_Y) * f);

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

/** 4 퇴근길 거리: shopfront glass over a brick plinth */
function streetBase(ctx: Ctx, w: number): void {
  ctx.fillStyle = vGrad(ctx, WALL_TOP, GROUND_Y, [[0, '#B9C9E6'], [1, '#93A6C8']]);
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  panels(ctx, 0, w, at(0.18), at(0.72), 120, '#D9E8F5', '#5B6E90', 'rgba(255,255,255,0.55)');
  ctx.fillStyle = '#B5654E';
  ctx.fillRect(0, at(0.72), w, GROUND_Y - at(0.72));
  ctx.fillStyle = 'rgba(60,30,26,0.35)';
  for (let y = at(0.72) + 10; y < GROUND_Y; y += 10) ctx.fillRect(0, y, w, 1.2);
}

/** 5 지하철역: white tile wall with a line-colour band */
function subwayBase(ctx: Ctx, w: number): void {
  ctx.fillStyle = '#E8ECEF';
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  ctx.strokeStyle = 'rgba(120,132,145,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = WALL_TOP; y < GROUND_Y; y += 16) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  for (let x = 0; x < w; x += 24) {
    ctx.moveTo(x, WALL_TOP);
    ctx.lineTo(x, GROUND_Y);
  }
  ctx.stroke();
  ctx.fillStyle = '#3BAA5C';
  ctx.fillRect(0, MID - 8, w, 16);
  ctx.fillStyle = '#9AA4AE';
  ctx.fillRect(0, GROUND_Y - 22, w, 22);
}

/** 6 먹자골목: warm wooden shopfronts under paper lanterns */
function alleyBase(ctx: Ctx, w: number): void {
  ctx.fillStyle = vGrad(ctx, WALL_TOP, GROUND_Y, [[0, '#5A3A4E'], [1, '#3E2838']]);
  ctx.fillRect(0, WALL_TOP, w, GROUND_Y - WALL_TOP);
  panels(ctx, 0, w, at(0.3), GROUND_Y - 18, 96, '#C98A52', '#5A3424', 'rgba(255,230,180,0.25)');
  for (let x = 30; x < w; x += 96) {
    ctx.fillStyle = '#FF6B4A';
    circle(ctx, x, at(0.16), 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,214,140,0.5)';
    circle(ctx, x, at(0.16), 4);
    ctx.fill();
  }
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
  {
    top: [[0, '#6E8FC8'], [1, '#A9C1E6']], girder: '#5B6E90', duct: ['#C9D4DD', '#8C99A6'], led: '#FFD36B',
    ceil: ['#C3D3EC', '#9FB4D6'], ceilLight: '#FFFFFF', floorTop: ['#B8BCC4', '#9CA1AB'], floorFront: ['#7D828C', '#4E525A'],
    seam: 'rgba(70,74,84,0.45)', floorLine: '#FFFFFF', lamp: 'rgba(255,230,170,0.3)', base: streetBase,
  },
  {
    top: [[0, '#2A2F36'], [1, '#4A525C']], girder: '#5A636E', duct: ['#B9C2CA', '#7E8892'], led: '#3BAA5C',
    ceil: ['#D6DCE1', '#AEB6BD'], ceilLight: '#F4FFF8', floorTop: ['#C9CCD0', '#A8ADB3'], floorFront: ['#6E747B', '#40454B'],
    seam: 'rgba(80,88,96,0.45)', floorLine: '#FFD23C', lamp: 'rgba(230,255,240,0.3)', base: subwayBase,
  },
  {
    top: [[0, '#1E1428'], [1, '#3A2440']], girder: '#4A2E3E', duct: ['#7A4E46', '#4A2E28'], led: '#FF8A4A',
    ceil: ['#4E3046', '#34202E'], ceilLight: '#FFD9A0', floorTop: ['#8A7468', '#6A564C'], floorFront: ['#3E302A', '#1E1612'],
    seam: 'rgba(30,18,14,0.5)', floorLine: '#FFD9A0', lamp: 'rgba(255,200,140,0.35)', base: alleyBase,
  },
];

export function themeOf(world: number): ThemeArt {
  return THEMES[world] ?? THEMES[0];
}

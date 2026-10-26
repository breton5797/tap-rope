// Rhythm-lane glyphs, tactical-HUD style (GDD-v6 §4): single-colour line icons in a thin dark frame.
// Category = colour + frame: RED house shape = jump over (floor-anchored, big numeral = beam count),
// TEAL inverted shape = slide under (ceiling-anchored, big ⌄⌄),
// AMBER = lane hazard (change lane), TEAL = pickup. Shapes stay distinct without colour.
import type { LaneId, LaserFrom, MoveId } from '../types';
import { blitScaled, type SpriteCache } from './sprites';
import { roundRect, type Ctx } from './util';

const R = 13;
export const HUD_RED = '#FF4A55';
export const HUD_AMBER = '#FFB020';
export const HUD_TEAL = '#3FE0D0';
const INK = '#E8ECEF';
export const HUD_FONT = '"Rajdhani", "IBM Plex Sans KR", sans-serif';

function frame(ctx: Ctx, color: string): void {
  ctx.fillStyle = 'rgba(8,10,12,0.82)';
  roundRect(ctx, -R, -R, R * 2, R * 2, 3);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  roundRect(ctx, -R + 0.6, -R + 0.6, R * 2 - 1.2, R * 2 - 1.2, 2.6);
  ctx.stroke();
  // corner ticks
  ctx.fillStyle = color;
  ctx.fillRect(-R, -R, 4, 1.4);
  ctx.fillRect(R - 4, R - 1.4, 4, 1.4);
}

function pen(ctx: Ctx, color: string, w = 1.6): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function chevron(ctx: Ctx, x: number, y: number, up: boolean, color: string): void {
  pen(ctx, color, 1.8);
  const d = up ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - d * 2);
  ctx.lineTo(x, y + d * 2);
  ctx.lineTo(x + 4, y - d * 2);
  ctx.stroke();
}

/** JUMP silhouette: floor-anchored house shape (flat floor bar, peaked top), red outline. */
function jumpFrame(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-R, R);
  ctx.lineTo(R, R);
  ctx.lineTo(R, -R * 0.3);
  ctx.lineTo(0, -R - 2.5);
  ctx.lineTo(-R, -R * 0.3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,10,12,0.86)';
  ctx.fill();
  pen(ctx, HUD_RED, 1.4);
  ctx.stroke();
  ctx.fillRect(-R, R - 2.6, R * 2, 2.6); // floor bar
}

/** SLIDE silhouette: ceiling-anchored inverted shape (flat ceiling bar, point at the bottom), teal outline. */
function slideFrame(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-R, -R);
  ctx.lineTo(R, -R);
  ctx.lineTo(R, R * 0.3);
  ctx.lineTo(0, R + 2.5);
  ctx.lineTo(-R, R * 0.3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,10,12,0.86)';
  ctx.fill();
  pen(ctx, HUD_TEAL, 1.4);
  ctx.stroke();
  ctx.fillRect(-R, -R, R * 2, 2.6); // ceiling bar
}

/** floor laser: hurdle (two posts + one wire) on the floor bar, ▲ above */
export function floorIcon(ctx: Ctx): void {
  jumpFrame(ctx);
  pen(ctx, HUD_RED, 1.8);
  ctx.beginPath();
  ctx.moveTo(-6, R - 2.6);
  ctx.lineTo(-6, 2);
  ctx.moveTo(6, R - 2.6);
  ctx.lineTo(6, 2);
  ctx.moveTo(-6, 4.5);
  ctx.lineTo(6, 4.5);
  ctx.stroke();
  chevron(ctx, 0, -5, true, INK);
}

/** flying beam stack: big beam count (= taps) under a ▲ */
export function beamIcon(ctx: Ctx, level: number): void {
  jumpFrame(ctx);
  chevron(ctx, 0, -6.5, true, INK);
  ctx.font = `700 17px ${HUD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(String(level), 0, 4.5);
}

/** slide hazards: ceiling = red beams hanging from the bar; head beam = one red line; both a big ⌄⌄ */
export function slideIcon(ctx: Ctx, ceiling: boolean): void {
  slideFrame(ctx);
  pen(ctx, HUD_RED, 1.6);
  ctx.beginPath();
  if (ceiling) {
    ctx.moveTo(-7, -R + 2.6);
    ctx.lineTo(-7, -5);
    ctx.moveTo(7, -R + 2.6);
    ctx.lineTo(7, -5);
    ctx.moveTo(-7, -5);
    ctx.lineTo(7, -5);
  } else {
    ctx.moveTo(-9, -6);
    ctx.lineTo(9, -6);
  }
  ctx.stroke();
  pen(ctx, INK, 2);
  ctx.beginPath();
  for (let k = 0; k < 2; k++) {
    const y = -0.5 + k * 5;
    ctx.moveTo(-6, y);
    ctx.lineTo(0, y + 5);
    ctx.lineTo(6, y);
  }
  ctx.stroke();
}

/** quadcopter: arms, rotors, scan line down */
export function droneIcon(ctx: Ctx): void {
  frame(ctx, HUD_RED);
  pen(ctx, INK, 1.4);
  ctx.beginPath();
  ctx.moveTo(-9, -4);
  ctx.lineTo(9, -4);
  ctx.moveTo(-11, -7);
  ctx.lineTo(-6, -7);
  ctx.moveTo(6, -7);
  ctx.lineTo(11, -7);
  ctx.rect(-4, -4, 8, 4);
  ctx.stroke();
  pen(ctx, HUD_RED, 1.2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-5, 9);
  ctx.moveTo(0, 0);
  ctx.lineTo(5, 9);
  ctx.stroke();
}

/** sentry walker: angular torso on a reverse-knee leg */
export function guardIcon(ctx: Ctx): void {
  frame(ctx, HUD_AMBER);
  pen(ctx, HUD_AMBER, 1.5);
  ctx.beginPath();
  ctx.moveTo(-5, -8);
  ctx.lineTo(5, -8);
  ctx.lineTo(6, -1);
  ctx.lineTo(-5, -1);
  ctx.closePath();
  ctx.moveTo(-1, -1);
  ctx.lineTo(3, 4);
  ctx.lineTo(-1, 9);
  ctx.moveTo(-5, -5);
  ctx.lineTo(-10, -5);
  ctx.stroke();
  ctx.fillStyle = HUD_RED;
  ctx.fillRect(-4, -6, 4, 1.6);
}

/** dropping crate: crate under a claw + ↓ */
export function dropIcon(ctx: Ctx): void {
  frame(ctx, HUD_AMBER);
  pen(ctx, HUD_AMBER, 1.5);
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, -6);
  ctx.moveTo(-5, -4);
  ctx.lineTo(-3, -6);
  ctx.lineTo(3, -6);
  ctx.lineTo(5, -4);
  ctx.rect(-6, -2, 12, 9);
  ctx.moveTo(-6, 2.5);
  ctx.lineTo(6, 2.5);
  ctx.stroke();
}

/** pursuit quadcopter + motion lines */
export function chaserIcon(ctx: Ctx): void {
  frame(ctx, HUD_AMBER);
  pen(ctx, HUD_AMBER, 1.5);
  ctx.beginPath();
  ctx.moveTo(-3, -2);
  ctx.lineTo(9, -2);
  ctx.moveTo(-1, -5);
  ctx.lineTo(3, -5);
  ctx.moveTo(5, -5);
  ctx.lineTo(9, -5);
  ctx.rect(1, -2, 6, 4);
  ctx.moveTo(-10, 0);
  ctx.lineTo(-4, 0);
  ctx.moveTo(-9, 4);
  ctx.lineTo(-3, 4);
  ctx.stroke();
}

/** Mini 3-lane marker (top = far lane): filled red = blocked, teal outline = safe. (x, y) = centre. */
export function drawLaneMarker(ctx: Ctx, blocked: readonly LaneId[], x: number, y: number, s: number): void {
  const pip = 4.2 * s;
  const gap = 1.6 * s;
  ctx.fillStyle = 'rgba(8,10,12,0.85)';
  ctx.fillRect(x - pip / 2 - 1.6 * s, y - pip * 1.5 - gap - 1.6 * s, pip + 3.2 * s, pip * 3 + gap * 2 + 3.2 * s);
  ctx.lineWidth = 1;
  for (let l = 0; l < 3; l++) {
    const py = y - pip * 1.5 - gap + l * (pip + gap);
    if (blocked.includes(l as LaneId)) {
      ctx.fillStyle = HUD_RED;
      ctx.fillRect(x - pip / 2, py, pip, pip);
    } else {
      ctx.strokeStyle = HUD_TEAL;
      ctx.strokeRect(x - pip / 2 + 0.5, py + 0.5, pip - 1, pip - 1);
    }
  }
}

/** pickups: 0 credit (₵), 1 shield emitter (hex), 2 chrono (dial), 3 armour plate */
export function pickupIcon(ctx: Ctx, kind: number): void {
  const color = kind === 0 ? HUD_AMBER : HUD_TEAL;
  ctx.fillStyle = 'rgba(8,10,12,0.7)';
  ctx.beginPath();
  ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
  ctx.fill();
  pen(ctx, color, 1.3);
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  if (kind === 0) {
    ctx.font = `700 13px ${HUD_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₵', 0, 0.5);
    return;
  }
  if (kind === 1) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      ctx.lineTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5);
    }
    ctx.closePath();
  } else if (kind === 2) {
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.moveTo(0, 0);
    ctx.lineTo(2.6, -2.6);
  } else {
    ctx.moveTo(-5, -5);
    ctx.lineTo(5, -5);
    ctx.lineTo(5, 2);
    ctx.lineTo(0, 6);
    ctx.lineTo(-5, 2);
    ctx.closePath();
  }
  ctx.stroke();
}

const CHIPS: readonly MoveId[] = ['gate', 'pulse', 'rear', 'lane', 'drop', 'chaser', 'lanejump'];
const CHIP_KEYS = CHIPS.map((m) => `chip-${m}`);

function upDown(ctx: Ctx, x: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x, -h);
  ctx.lineTo(x, h);
  ctx.moveTo(x - 2.4, -h + 2.4);
  ctx.lineTo(x, -h);
  ctx.lineTo(x + 2.4, -h + 2.4);
  ctx.moveTo(x - 2.4, h - 2.4);
  ctx.lineTo(x, h);
  ctx.lineTo(x + 2.4, h - 2.4);
  ctx.stroke();
}

/** Corner tag naming the move (dark square, white line glyph). */
function chipSprite(ctx: Ctx, idx: number): void {
  ctx.fillStyle = '#0A0C0E';
  ctx.fillRect(-7, -7, 14, 14);
  ctx.strokeStyle = 'rgba(232,236,239,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-6.5, -6.5, 13, 13);
  const m = CHIPS[idx];
  pen(ctx, INK, 1.3);
  if (m === 'pulse') {
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-0.5, -4);
    ctx.lineTo(1.5, 4);
    ctx.lineTo(3, 0);
    ctx.lineTo(5, 0);
    ctx.stroke();
  } else if (m === 'gate') {
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.lineTo(-4, -4);
    ctx.lineTo(4, -4);
    ctx.lineTo(4, 4);
    ctx.stroke();
  } else if (m === 'rear') {
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-4, 0);
    ctx.moveTo(-1.5, -2.6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-1.5, 2.6);
    ctx.stroke();
  } else if (m === 'lane') {
    upDown(ctx, 0, 4.6);
  } else if (m === 'drop' || m === 'chaser') {
    ctx.fillStyle = HUD_AMBER;
    ctx.fillRect(-0.9, -4.6, 1.8, 6);
    ctx.fillRect(-0.9, 2.6, 1.8, 1.8);
    if (m === 'chaser') {
      ctx.fillStyle = INK;
      ctx.fillRect(-5, -1.5, 2.6, 1.2);
      ctx.fillRect(-5, 1.2, 2.6, 1.2);
    }
  } else {
    upDown(ctx, -2.2, 4.6);
    ctx.beginPath();
    ctx.moveTo(1.5, 2);
    ctx.lineTo(3.4, -1.5);
    ctx.lineTo(5.3, 2);
    ctx.stroke();
  }
}

export function drawChip(ctx: Ctx, sprites: SpriteCache, move: MoveId, x: number, y: number, s: number): void {
  const i = CHIPS.indexOf(move);
  if (i < 0) return;
  blitScaled(ctx, sprites.get(CHIP_KEYS[i], 16, 16, 8, 8, chipSprite, i), x, y, s, s);
}

/** Small chevron showing where the laser comes from (points the way it travels). */
export function drawFromArrow(ctx: Ctx, from: LaserFrom | null, x: number, y: number): void {
  if (!from) return;
  const dir = from === 'front' ? [-1, 0] : from === 'back' ? [1, 0] : from === 'top' ? [0, 1] : [0, -1];
  const ax = from === 'front' ? x + 17 : from === 'back' ? x - 17 : x;
  const ay = from === 'top' ? y - 17 : from === 'bottom' ? y + 17 : y;
  pen(ctx, INK, 1.4);
  ctx.beginPath();
  ctx.moveTo(ax - dir[0] * 2 - dir[1] * 3.5, ay - dir[1] * 2 + dir[0] * 3.5);
  ctx.lineTo(ax + dir[0] * 2.5, ay + dir[1] * 2.5);
  ctx.lineTo(ax - dir[0] * 2 + dir[1] * 3.5, ay - dir[1] * 2 - dir[0] * 3.5);
  ctx.stroke();
}

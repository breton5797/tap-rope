// Office build stand-in for src/render/doors.ts (build/office-swaps.ts): the section door is an office glass
// door — light aluminium frame, a green exit light on the header and a glass leaf that slides up on the v8
// timing — and its approach sign is a white office sign. Transitions and backgrounds are the v8 ones.
import type { DoorView } from '../../types';
import { fixedX, projX, projY, WALL_DEPTH } from '../../render/layout';
import type { DoorOffset } from '../../render/doors';
import type { SpriteCache } from '../../render/sprites';
import { clamp, roundRect, type Ctx } from '../../render/util';
import type { View } from '../../render/view';

export * from '../../render/doors';

/** v8 doors.ts geometry: door height, near floor depth, leaf / rail / header sizes */
const DOOR_H = 150;
const NEAR_D = 2.6;
const LEAF_W = 34;
const POST_W = 6;
const HEADER_H = 14;
const ALU = '#C9D1D8';
const ALU_EDGE = '#7F8A95';
const EXIT_GREEN = '#2FD27A';

interface Box { x: number; top: number; open: number; bot: number }

const box = (wx: number): Box => {
  const top = projY(WALL_DEPTH, DOOR_H + 20);
  return { x: projX(wx, 1), top, open: top + HEADER_H, bot: projY(NEAR_D, 0) + 2 };
};

/** v8 timing: the leaf opens from 1.0 s to 0.3 s before the agent reaches the door */
const opening = (tu: number): number => clamp((1.0 - tu) / 0.7, 0, 1);

const visible = (d: DoorView, off: DoorOffset): boolean => {
  const x = fixedX(d.timeUntil);
  return off.alpha > 0.01 && x >= -80 && x <= 520;
};

/** the glass leaf, sliding up into the header */
function glass(ctx: Ctx, b: Box, o: number): void {
  if (o >= 0.999) return;
  const h = b.bot - b.open;
  const y0 = b.open - o * h;
  const x0 = b.x - LEAF_W / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, b.open, LEAF_W, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(185,228,245,0.38)';
  ctx.fillRect(x0, y0, LEAF_W, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  for (const k of [0.25, 0.42]) {
    ctx.beginPath();
    ctx.moveTo(x0 + 4, y0 + h * k + 18);
    ctx.lineTo(x0 + LEAF_W - 6, y0 + h * k);
    ctx.stroke();
  }
  // push bar and the frosted company band
  ctx.fillStyle = ALU;
  ctx.fillRect(x0 + 4, y0 + h * 0.55, LEAF_W - 8, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(x0, y0 + h * 0.36, LEAF_W, 6);
  ctx.strokeStyle = ALU_EDGE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 + 0.75, y0 + 0.75, LEAF_W - 1.5, h - 1.5);
  ctx.restore();
}

/** v8 contract — back part: the leaf (before the lanes) */
export function drawDoorBack(ctx: Ctx, d: DoorView, off: DoorOffset, _t: number, _sprites: SpriteCache, _reduced: boolean): void {
  if (!visible(d, off)) return;
  ctx.save();
  ctx.translate(off.ox, off.oy);
  ctx.globalAlpha = off.alpha;
  glass(ctx, box(fixedX(d.timeUntil)), opening(d.timeUntil));
  ctx.restore();
}

/** v8 contract — front part: aluminium posts and the header with its exit light (after the lanes) */
export function drawDoorFront(ctx: Ctx, d: DoorView, t: number, off: DoorOffset): void {
  if (!visible(d, off)) return;
  ctx.save();
  ctx.translate(off.ox, off.oy);
  ctx.globalAlpha = off.alpha;
  const b = box(fixedX(d.timeUntil));
  const left = b.x - LEAF_W / 2 - POST_W;
  const right = b.x + LEAF_W / 2;
  for (const rx of [left, right]) {
    ctx.fillStyle = ALU;
    ctx.fillRect(rx, b.top, POST_W, b.bot - b.top);
    ctx.fillStyle = ALU_EDGE;
    ctx.fillRect(rx + POST_W - 1.2, b.top, 1.2, b.bot - b.top);
  }
  ctx.fillStyle = ALU;
  ctx.fillRect(left - 3, b.top, right + POST_W + 3 - (left - 3), HEADER_H);
  ctx.fillStyle = ALU_EDGE;
  ctx.fillRect(left - 3, b.top + HEADER_H - 1.2, right + POST_W + 3 - (left - 3), 1.2);
  const open = opening(d.timeUntil) > 0.05;
  ctx.fillStyle = open || Math.floor(t * 3) % 2 === 0 ? EXIT_GREEN : '#1C7A48';
  roundRect(ctx, b.x - 9, b.top + 3, 18, 8, 2);
  ctx.fill();
  ctx.restore();
}

/** v8 contract — the sign sliding in at the right edge before a door: a white office door sign */
export function drawDoorSign(ctx: Ctx, v: View, d: DoorView, _t: number): void {
  const x = fixedX(d.timeUntil);
  const edge = v.x0 + v.w;
  if (d.timeUntil <= 0 || x < edge - 10) return;
  const slide = clamp((3 - d.timeUntil) / 0.3, 0, 1);
  const cx = edge - 24 * slide + 4;
  const cy = projY(1, DOOR_H * 0.6);
  ctx.globalAlpha = slide;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, cx - 17, cy - 21, 34, 42, 6);
  ctx.fill();
  ctx.strokeStyle = EXIT_GREEN;
  ctx.lineWidth = 2;
  ctx.stroke();
  // door glyph + arrow
  ctx.strokeStyle = '#1E2238';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 7, cy - 12, 14, 22);
  ctx.fillStyle = '#1E2238';
  ctx.fillRect(cx + 3, cy - 1, 2, 2);
  ctx.beginPath();
  ctx.moveTo(cx - 21, cy - 4);
  ctx.lineTo(cx - 25, cy);
  ctx.lineTo(cx - 21, cy + 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

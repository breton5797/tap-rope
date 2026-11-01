// Office feel pack F1 (v2 spec §4): the ground visibly flows under the hero. The apron between the lanes
// and the rhythm lane gets world-fixed tile seams projected in perspective (smooth lines, so no strip
// banding), scrolling 1:1 with the floor; in 칼퇴 모드 (fever) white speed lines streak past.
import { CEIL_Y, FLOOR_FRONT, FRONT_DEPTH, depthAtY, projX } from '../../render/layout';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';

/** world px between apron tile seams, and depth between seam rows */
const SEAM = 64;
const ROWS = 3;
const SEAM_INK = 'rgba(58,46,63,0.25)';
const SPEED_LINES = 12;

/** streak count: only in fever, none with reduced motion */
export function speedLineCount(fever: boolean, reduced: boolean): number {
  return fever && !reduced ? SPEED_LINES : 0;
}

/** perspective seams on the apron (FLOOR_FRONT → `bottom`), locked to the floor scroll */
export function drawApronFlow(ctx: Ctx, v: View, scroll: number, bottom: number): void {
  if (bottom <= FLOOR_FRONT + 2) return;
  const dBot = depthAtY(bottom);
  ctx.strokeStyle = SEAM_INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // seams run toward the camera: world x fixed, so they scroll with the floor and converge on PLAYER_X
  const first = Math.floor((v.x0 - v.w + scroll) / SEAM) * SEAM;
  for (let wx = first; wx - scroll < v.x0 + 2 * v.w; wx += SEAM) {
    const x = wx - scroll;
    ctx.moveTo(projX(x, FRONT_DEPTH), FLOOR_FRONT);
    ctx.lineTo(projX(x, dBot), bottom);
  }
  // seam rows across
  for (let i = 1; i <= ROWS; i++) {
    const y = FLOOR_FRONT + ((bottom - FLOOR_FRONT) * i) / (ROWS + 1);
    ctx.moveTo(v.x0, y);
    ctx.lineTo(v.x0 + v.w, y);
  }
  ctx.stroke();
}

/** fever speed lines: white streaks moving left across the corridor */
export function drawSpeedLines(ctx: Ctx, v: View, t: number, count: number): void {
  if (count <= 0) return;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineCap = 'round';
  const span = v.w + 160;
  for (let i = 0; i < count; i++) {
    const y = CEIL_Y + 30 + ((i * 97) % Math.max(1, FLOOR_FRONT - CEIL_Y - 40));
    const len = 40 + ((i * 53) % 50);
    const x = v.x0 + v.w + 80 - ((t * 900 + i * 137) % span);
    ctx.lineWidth = 1 + (i % 3) * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
}

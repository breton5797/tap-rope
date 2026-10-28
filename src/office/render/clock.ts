// Office clock (office spec §4): "17:42" ticking toward 18:00, on the near floor just above the rhythm lane
// (the DOM HUD covers the corridor's top band on phones).
import { roundRect, type Ctx } from '../../render/util';
import { LANE_TOP, type View } from '../../render/view';

/** css px between the clock's centre and the rhythm lane's top edge */
const ABOVE_LANE = 26;

/** logical y of the rhythm lane's top edge (the lane has its own css transform) */
export function laneTopY(v: View): number {
  return (v.loy + LANE_TOP * v.ls - v.oy) / v.s;
}

/** logical y of the clock: just above the rhythm lane */
export function clockY(v: View): number {
  return laneTopY(v) - ABOVE_LANE / v.s;
}

export function drawClock(ctx: Ctx, v: View, text: string, urgent: boolean): void {
  const Y = clockY(v);
  ctx.font = '800 17px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 34;
  const x = v.x0 + v.w - w / 2 - 10;
  ctx.fillStyle = 'rgba(20,24,44,0.78)';
  roundRect(ctx, x - w / 2, Y - 14, w, 28, 14);
  ctx.fill();
  ctx.strokeStyle = urgent ? '#FF5C7A' : '#7CF0D8';
  ctx.lineWidth = 2;
  ctx.stroke();
  // clock face icon
  ctx.beginPath();
  ctx.arc(x - w / 2 + 14, Y, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 14, Y - 4);
  ctx.lineTo(x - w / 2 + 14, Y);
  ctx.lineTo(x - w / 2 + 17, Y + 2);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, x + 7, Y + 1);
}

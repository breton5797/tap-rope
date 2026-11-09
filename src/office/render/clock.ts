// Office clock (office spec §4): "17:42" ticking toward 18:00, on the near floor just above the rhythm lane
// (the DOM HUD covers the corridor's top band on phones).
import { roundRect, type Ctx } from '../../render/util';
import { LANE_TOP, type View } from '../../render/view';
import { textWidth } from './text-width';

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

/** the stages whose clock runs out on a deadline: 5 (18:00 칼퇴) and 10 (18:30 귀가), 0-based */
const DEADLINE_STAGES: ReadonlySet<number> = new Set([4, 9]);
/** the clock turns red over the last fifth of a deadline stage */
const URGENT_FROM = 0.8;

/** red clock: the end of part 1 and the end of part 2 */
export function clockUrgent(stageIndex: number, progress01: number): boolean {
  return DEADLINE_STAGES.has(stageIndex) && progress01 > URGENT_FROM;
}

const CLOCK_FONT = '800 17px ui-rounded, system-ui, sans-serif';

export function drawClock(ctx: Ctx, v: View, text: string, urgent: boolean): void {
  const Y = clockY(v);
  ctx.font = CLOCK_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = textWidth(ctx, CLOCK_FONT, text) + 34;
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

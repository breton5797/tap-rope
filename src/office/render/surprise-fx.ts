// Office surprise visuals (office spec §6, §9): blackout with glowing hazard outlines, fire-drill red flash,
// high-five popup, broadcast banner and the superiors' speech bubbles. Drawn over the finished v8 frame in
// logical coordinates; the hit boxes and the "!" warnings are the v8 ones (warnings are redrawn on top).
import type { VisibleObstacle } from '../../types';
import { HAZARD_KINDS } from '../../types';
import {
  CEIL_LASER_END, ENTER_TIME, FLOOR_BACK, depthScale, fixedX, flyingX, projX, projY,
} from '../../render/layout';
import { chaserX, dropHeight } from '../../render/hazards';
import { PROP_SIZE, flyingSpan } from './props';
import { roundRect, type Ctx } from '../../render/util';
import { clockY, laneTopY } from './clock';
import { PERSON_ASPECT, PERSON_FX, personWidth } from './boss-rigs';
import type { View } from '../../render/view';

/** how far below the face a bubble may be pushed by the DOM HUD before it waits */
const MAX_DROP = 40;
const BUBBLE_FONT = '700 12px ui-rounded, system-ui, sans-serif';

interface Box { x: number; y: number; w: number; h: number }

const LANES = [0, 1, 2] as const;
const NEON = '#7CFFEA';

/** a square prop box centred on x, anchored at y by `ay` (1 = bottom, 0.5 = centre) */
const square = (x: number, y: number, size: number, ay: number): Box => ({ x: x - size / 2, y: y - size * ay, w: size, h: size });

/** screen boxes of a hazard (same placement as the office props) */
function boxesOf(o: VisibleObstacle, v: View): Box[] {
  const lanes: readonly number[] = o.lanes ?? LANES;
  return lanes.flatMap((d): Box[] => {
    const s = depthScale(d);
    const tu = o.timeUntil;
    switch (o.kind) {
      case 'floor': return [square(projX(fixedX(tu), d), projY(d, 0), PROP_SIZE.floor * s, 1)];
      case 'ceiling': return [square(projX(fixedX(tu), d), projY(d, CEIL_LASER_END), PROP_SIZE.ceiling * s, 1)];
      case 'drone': return [square(projX(fixedX(tu), d), projY(d, 160), PROP_SIZE.drone * s, 0.5)];
      case 'guard': return [square(projX(fixedX(tu), d), projY(d, 0), PROP_SIZE.guard * s, 1)];
      case 'drop': return [square(projX(fixedX(tu), d), projY(d, dropHeight(tu)), PROP_SIZE.drop * s, 1)];
      case 'chaser': return [square(projX(chaserX(tu, v), d), projY(d, 34), PROP_SIZE.chaser * s, 0.5)];
      case 'beam': case 'high': {
        if (tu > ENTER_TIME) return [];
        const back = o.from === 'back';
        const x = projX(flyingX(back ? 'back' : 'front', tu, v), d);
        const { bottom, h } = flyingSpan(o);
        return [{ x: back ? x - h * s : x, y: projY(d, bottom + h), w: h * s, h: h * s }];
      }
      default: return [];
    }
  });
}

/** darkness over the scene, then every hazard as a glowing outline (alpha ≥ 0.8 in the window) */
export function drawBlackout(ctx: Ctx, v: View, obs: readonly VisibleObstacle[], scene: number, outline: number): void {
  // the world only: the rhythm lane stays lit
  ctx.fillStyle = `rgba(6,8,22,${scene})`;
  ctx.fillRect(v.x0, v.y0, v.w, laneTopY(v) - v.y0);
  if (outline <= 0) return;
  ctx.strokeStyle = NEON;
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  ctx.globalAlpha = outline;
  for (const o of obs) {
    if (!HAZARD_KINDS.includes(o.kind) || o.timeUntil < -0.3) continue;
    for (const b of boxesOf(o, v)) {
      roundRect(ctx, b.x, b.y, b.w, b.h, 5);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/** fire drill: pulsing red edge wash + "소방훈련!" banner (the rear hazard keeps its v8 "!") */
export function drawFireDrill(ctx: Ctx, v: View, age: number, reduced: boolean): void {
  const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(age * Math.PI * 6);
  const g = ctx.createRadialGradient(v.x0 + v.w / 2, v.y0 + v.h / 2, Math.min(v.w, v.h) * 0.3, v.x0 + v.w / 2, v.y0 + v.h / 2, Math.max(v.w, v.h) * 0.7);
  g.addColorStop(0, 'rgba(255,40,60,0)');
  g.addColorStop(1, `rgba(255,40,60,${0.35 * pulse})`);
  ctx.fillStyle = g;
  ctx.fillRect(v.x0, v.y0, v.w, v.h);
  banner(ctx, v, '소방훈련! 뒤에서 와요', '#FF4D6A', bannerY(v));
}

/** surprise banners sit in the free band just above the clock (below every DOM HUD row) */
export function bannerY(v: View): number {
  return clockY(v) - 34 / v.s;
}

/** high five: "같이 퇴근하자!" popup over the hero, kept inside the view and under the DOM HUD rows */
export function drawHighFive(ctx: Ctx, v: View, x: number, y: number, age: number, below: number): void {
  const text = '하이파이브! 같이 퇴근하자!';
  ctx.font = BUBBLE_FONT;
  const half = Math.min(230, ctx.measureText(text).width + 22) / 2;
  const k = Math.min(1, age / 0.15);
  ctx.save();
  ctx.translate(Math.max(v.x0 + half + 6, Math.min(v.x0 + v.w - half - 6, x)), Math.max(below + 22, y - 20 * k));
  ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  bubble(ctx, 0, 0, text, '#FFE45C', '#3A2A00', 'down');
  ctx.restore();
}

/** company broadcast: banner across the top */
export function drawBroadcast(ctx: Ctx, v: View): void {
  banner(ctx, v, '사내방송: 사장님 깜짝 순시 중', '#5CC8FF', bannerY(v));
}

/** a superior's speech bubble beside the figure's face, kept under the DOM HUD rows and the phase line */
export function drawBossBubble(ctx: Ctx, v: View, text: string, below: number): void {
  const w = personWidth(v.w);
  const faceY = FLOOR_BACK - (w / PERSON_ASPECT) * 0.8;
  const x = Math.max(v.x0 + 120, v.x0 + v.w * PERSON_FX - w * 0.35 - 70);
  const y = Math.max(faceY, below + 18);
  // a DOM card (briefing, tutorial) covering the face: wait instead of dropping onto the hero
  if (y > faceY + MAX_DROP) return;
  bubble(ctx, x, y, text, '#FFFFFF', '#1E2238', 'right');
}

function banner(ctx: Ctx, v: View, text: string, color: string, y: number): void {
  ctx.font = '800 13px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.min(v.w - 16, ctx.measureText(text).width + 28);
  const x = v.x0 + v.w / 2;
  ctx.fillStyle = color;
  roundRect(ctx, x - w / 2, y - 12, w, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#10121E';
  ctx.fillText(text, x, y + 1, w - 16);
}

/** rounded bubble centred on (x, y) with a tail pointing down or down-right */
function bubble(ctx: Ctx, x: number, y: number, text: string, fill: string, ink: string, tail: 'down' | 'right'): void {
  ctx.font = BUBBLE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.min(230, ctx.measureText(text).width + 22);
  const h = 26;
  ctx.fillStyle = fill;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 12);
  ctx.fill();
  ctx.stroke();
  const tx = tail === 'down' ? x : x + w / 2 - 22;
  ctx.beginPath();
  ctx.moveTo(tx - 6, y + h / 2 - 1);
  ctx.lineTo(tx + (tail === 'down' ? 0 : 10), y + h / 2 + 10);
  ctx.lineTo(tx + 6, y + h / 2 - 1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.fillText(text, x, y + 1, w - 12);
}

// Office surprise visuals (office spec §6, §9): blackout with glowing hazard outlines, fire-drill red flash,
// high-five popup, broadcast banner and the superiors' speech bubbles. Drawn over the finished v8 frame in
// logical coordinates; the hit boxes and the "!" warnings are the v8 ones (warnings are redrawn on top).
import type { VisibleObstacle } from '../../types';
import { HAZARD_KINDS } from '../../types';
import {
  BEAM_H, CEIL_LASER_END, CEIL_Y, ENTER_TIME, FLOOR_BACK, HIGH_H, depthScale, fixedX, flyingX, projX, projY,
} from '../../render/layout';
import { chaserX, dropHeight } from '../../render/hazards';
import { roundRect, type Ctx } from '../../render/util';
import { laneTopY } from './clock';
import { PERSON_ASPECT, PERSON_FX, personWidth } from './boss-rigs';
import type { View } from '../../render/view';

interface Box { x: number; y: number; w: number; h: number }

const LANES = [0, 1, 2] as const;
const NEON = '#7CFFEA';

/** screen boxes of a hazard (same placement as the office props) */
function boxesOf(o: VisibleObstacle, v: View): Box[] {
  const lanes: readonly number[] = o.lanes ?? LANES;
  return lanes.flatMap((d): Box[] => {
    const s = depthScale(d);
    const tu = o.timeUntil;
    switch (o.kind) {
      case 'floor': return [{ x: projX(fixedX(tu), d) - 18 * s, y: projY(d, 34), w: 36 * s, h: 34 * s }];
      case 'ceiling': return [{ x: projX(fixedX(tu), d) - 20 * s, y: projY(d, CEIL_LASER_END + 46), w: 40 * s, h: 46 * s }];
      case 'drone': return [{ x: projX(fixedX(tu), d) - 18 * s, y: projY(d, 160) - 17 * s, w: 36 * s, h: 34 * s }];
      case 'guard': return [{ x: projX(fixedX(tu), d) - 24 * s, y: projY(d, 70), w: 48 * s, h: 70 * s }];
      case 'drop': return [{ x: projX(fixedX(tu), d) - 22 * s, y: projY(d, dropHeight(tu) + 46), w: 44 * s, h: 46 * s }];
      case 'chaser': return [{ x: projX(chaserX(tu, v), d) - 24 * s, y: projY(d, 34) - 22 * s, w: 48 * s, h: 44 * s }];
      case 'beam': case 'high': {
        if (tu > ENTER_TIME) return [];
        const x = projX(flyingX(o.from === 'back' ? 'back' : 'front', tu, v), d);
        const hs = o.kind === 'high' ? [HIGH_H] : BEAM_H.slice(0, Math.max(1, o.level));
        return hs.map((h) => ({ x: x - 4 * s, y: projY(d, h) - 14 * s, w: 36 * s, h: 28 * s }));
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
  banner(ctx, v, '소방훈련! 뒤에서 와요', '#FF4D6A', CEIL_Y + 18);
}

/** high five: "같이 퇴근하자!" popup over the hero */
export function drawHighFive(ctx: Ctx, x: number, y: number, age: number): void {
  const k = Math.min(1, age / 0.15);
  ctx.save();
  ctx.translate(x, y - 20 * k);
  ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  bubble(ctx, 0, 0, '하이파이브! 같이 퇴근하자!', '#FFE45C', '#3A2A00', 'down');
  ctx.restore();
}

/** company broadcast: banner across the top */
export function drawBroadcast(ctx: Ctx, v: View): void {
  banner(ctx, v, '사내방송: 사장님 깜짝 순시 중', '#5CC8FF', CEIL_Y + 18);
}

/** a superior's speech bubble beside the standing figure's face (boss-rigs placement) */
export function drawBossBubble(ctx: Ctx, v: View, text: string): void {
  const w = personWidth(v.w);
  const faceY = FLOOR_BACK - (w / PERSON_ASPECT) * 0.8;
  const x = Math.max(v.x0 + 120, v.x0 + v.w * PERSON_FX - w * 0.35 - 70);
  bubble(ctx, x, faceY, text, '#FFFFFF', '#1E2238', 'right');
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
  ctx.font = '700 12px ui-rounded, system-ui, sans-serif';
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

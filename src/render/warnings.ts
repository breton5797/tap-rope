// Sudden-attack warnings (GDD-v5 §3.3): from WARN_LEAD before arrival a blinking red "!" badge
// floats above each target lane just ahead of the agent; chasers and rear beams also get a "!"
// on the left screen edge at their lane height. Reduced motion = steady badges.
import { PLAYER_X, WARN_LEAD, type VisibleObstacle } from '../types';
import { CHASE_ENTER } from './hazards';
import { BEAM_H, HIGH_H, depthScale, laneY, projX, projY } from './layout';
import { blitScaled, type SpriteCache } from './sprites';
import { FONT, oval, outlinedText, type Ctx } from './util';
import type { View } from './view';

const BADGE_H = 66;
const BADGE_DX = 44;
const CHASE_H = 30;

function bangSprite(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(20,10,30,0.55)';
  ctx.beginPath();
  ctx.arc(0, 1.5, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FF3358';
  ctx.beginPath();
  ctx.moveTo(-5, 8);
  ctx.lineTo(0, 15);
  ctx.lineTo(5, 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `900 16px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  outlinedText(ctx, '!', 0, 1, '#FFFFFF', '#8A0F2A', 3);
}

function isRear(o: VisibleObstacle): boolean {
  return (o.kind === 'beam' || o.kind === 'high') && o.from === 'back';
}

function blink(t: number, reduced: boolean): number {
  if (reduced) return 1;
  return (t * 5) % 1 < 0.6 ? 1 : 0.25;
}

/** Draw every active "!" (call after the lanes so badges sit on top). */
export function drawWarnings(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], agentLane: number, t: number, sprites: SpriteCache, reduced: boolean,
): void {
  const sp = sprites.get('warnBang', 28, 32, 14, 14, bangSprite);
  let mask = 0; // lanes that already have a badge this frame
  const a = blink(t, reduced);
  const pop = reduced ? 1 : 1 + 0.08 * Math.sin(t * 20);
  for (const o of obs) {
    if (!o.sudden || o.timeUntil > WARN_LEAD || o.timeUntil <= 0) continue;
    const lanes = o.lanes ?? [Math.round(agentLane)];
    for (const l of lanes) {
      if (mask & (1 << l)) continue;
      mask |= 1 << l;
      const s = depthScale(l) * pop;
      const x = projX(PLAYER_X + BADGE_DX, l);
      const fy = laneY(l);
      // a pin: red ring on the lane floor + stem up to the badge, so it reads as "this lane"
      ctx.globalAlpha = 0.5 + 0.5 * a;
      ctx.strokeStyle = '#FF3358';
      ctx.lineWidth = 2;
      oval(ctx, x, fy, 13 * depthScale(l), 3.6 * depthScale(l));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.lineTo(x, projY(l, BADGE_H) + 12 * s);
      ctx.stroke();
      ctx.globalAlpha = a;
      blitScaled(ctx, sp, x, projY(l, BADGE_H), s, s);
    }
    const edge = o.kind === 'chaser' ? o.timeUntil > CHASE_ENTER - 0.12 : isRear(o) && o.timeUntil > 0.35;
    if (!edge) continue;
    const h = o.kind === 'chaser' ? CHASE_H : o.kind === 'high' ? HIGH_H : BEAM_H[Math.min(2, o.level - 1)];
    for (const l of lanes) {
      const s = depthScale(l);
      ctx.globalAlpha = a;
      blitScaled(ctx, sp, v.x0 + 16, projY(l, h), s * 0.9, s * 0.9);
    }
  }
  ctx.globalAlpha = 1;
}

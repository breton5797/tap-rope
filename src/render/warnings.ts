// Sudden-attack warnings (GDD-v5 §3.3, v6 style §4): from WARN_LEAD before arrival an amber
// triangular hazard sign hangs over each target lane just ahead of the agent, tied to a red laser
// targeting ring on that lane's floor; chasers and rear beams also get a sign on the left screen
// edge at their lane height. Reduced motion = steady signs, static ring.
import { PLAYER_X, WARN_LEAD, type LaneId, type VisibleObstacle } from '../types';
import { CHASE_ENTER, targetRing } from './hazards';
import { BEAM_H, HIGH_H, depthScale, laneY, projX, projY } from './layout';
import { blitScaled, type SpriteCache } from './sprites';
import { type Ctx } from './util';
import type { View } from './view';

const SIGN_H = 66;
const SIGN_DX = 44;
const CHASE_H = 34;
/** reused single-lane list for full-width sudden obstacles (the agent's lane) */
const AGENT_LANE: LaneId[] = [1];

/** Amber warning triangle with a black "!" (anchor = centre). */
function signSprite(ctx: Ctx): void {
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(11.5, 9);
  ctx.lineTo(-11.5, 9);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.stroke();
  ctx.fillStyle = '#FFB020';
  ctx.fill();
  ctx.strokeStyle = '#1A1408';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -7.5);
  ctx.lineTo(8.6, 7);
  ctx.lineTo(-8.6, 7);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#1A1408';
  ctx.fillRect(-1.1, -3.5, 2.2, 6.2);
  ctx.fillRect(-1.1, 4, 2.2, 1.8);
}

function isRear(o: VisibleObstacle): boolean {
  return (o.kind === 'beam' || o.kind === 'high') && o.from === 'back';
}

function blink(t: number, reduced: boolean): number {
  if (reduced) return 1;
  return (t * 4) % 1 < 0.62 ? 1 : 0.3;
}

/** Draw every active warning (call after the lanes so signs sit on top). */
export function drawWarnings(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], agentLane: number, t: number, sprites: SpriteCache, reduced: boolean,
): void {
  const sp = sprites.get('warnSign', 30, 28, 15, 13, signSprite);
  let mask = 0; // lanes that already have a sign this frame
  const a = blink(t, reduced);
  for (const o of obs) {
    if (!o.sudden || o.timeUntil > WARN_LEAD || o.timeUntil <= 0) continue;
    let lanes = o.lanes;
    if (!lanes) {
      AGENT_LANE[0] = Math.round(agentLane) as LaneId;
      lanes = AGENT_LANE;
    }
    const k = 1 - o.timeUntil / WARN_LEAD;
    for (const l of lanes) {
      if (mask & (1 << l)) continue;
      mask |= 1 << l;
      const s = depthScale(l);
      const x = projX(PLAYER_X + SIGN_DX, l);
      const fy = laneY(l);
      targetRing(ctx, x, fy, s, t, reduced, 0.45 + 0.55 * k);
      // thin red tether from the ring up to the sign
      ctx.strokeStyle = '#FF2A3A';
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.lineTo(x, projY(l, SIGN_H) + 10 * s);
      ctx.stroke();
      ctx.globalAlpha = a;
      blitScaled(ctx, sp, x, projY(l, SIGN_H), s, s);
      ctx.globalAlpha = 1;
    }
    const edge = o.kind === 'chaser' ? o.timeUntil > CHASE_ENTER - 0.12 : isRear(o) && o.timeUntil > 0.35;
    if (!edge) continue;
    const h = o.kind === 'chaser' ? CHASE_H : o.kind === 'high' ? HIGH_H : BEAM_H[Math.min(2, o.level - 1)];
    for (const l of lanes) {
      const s = depthScale(l) * 0.9;
      ctx.globalAlpha = a;
      blitScaled(ctx, sp, v.x0 + 16, projY(l, h), s, s);
    }
    ctx.globalAlpha = 1;
  }
}

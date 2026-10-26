// Adult operative figure (GDD-v6 §3): solves the skeleton (rig-skeleton) and paints it back to
// front — far arm and leg in shadow, torso and gear, near leg, head, near arm — as overlapping
// muscle-tapered capsules with three-tone plane shading and a scene-coloured rim light.
import { boot, cable, hand, holster, rimAlpha, seg, setRim, torso, type Paint, type Tone } from './rig-parts';
import { drawHead } from './rig-head';
import { clampPose, J, P, solve, type Pose } from './rig-skeleton';
import type { AgentLook } from './skins';
import type { Ctx } from './util';

export type { Paint } from './rig-parts';
export { newPose, type Pose } from './rig-skeleton';

/** stride length of one full run cycle (two steps), world px */
export const STRIDE = 137;

interface FarTones {
  suit: Tone;
  legs: Tone;
  gloves: Tone;
  boots: Tone;
}

/** far-side limbs are one tone darker (cached per look: no per-frame allocation) */
const FAR = new WeakMap<AgentLook, FarTones>();

function far(L: AgentLook): FarTones {
  let f = FAR.get(L);
  if (!f) {
    const d = (t: Tone): Tone => ({ base: t.dark, light: t.base, dark: t.dark });
    f = { suit: d(L.suit), legs: d(L.legs), gloves: d(L.gloves), boots: d(L.boots) };
    FAR.set(L, f);
  }
  return f;
}

function leg(ctx: Ctx, hip: number, knee: number, ankle: number, toe: number, t: Tone, b: Tone, sole: string): void {
  // thigh: glute / hamstring bulge behind, quad in front; shin: calf bulge behind
  seg(ctx, hip, knee, 5.3, 3.6, 5.6, 5.4, 0.36, t);
  seg(ctx, knee, ankle, 3.6, 2.2, 4.1, 3.2, 0.3, t);
  boot(ctx, ankle, toe, b, sole);
}

function arm(ctx: Ctx, sh: number, el: number, h: number, t: Tone, g: Tone): void {
  seg(ctx, sh, el, 3.2, 2.4, 3.4, 3.4, 0.3, t);
  seg(ctx, el, h, 2.4, 1.8, 2.7, 2.6, 0.3, t);
  hand(ctx, el, h, g);
}

function torch(ctx: Ctx): void {
  ctx.save();
  ctx.translate(J[P.Hand0], J[P.Hand0 + 1]);
  // held level, pointing ahead whatever the arm swing
  ctx.rotate(0.12);
  ctx.fillStyle = '#16181B';
  ctx.fillRect(0, -1.1, 5.5, 2.2);
  ctx.fillStyle = '#FFE9B8';
  ctx.fillRect(5.3, -1.0, 0.7, 2.0);
  ctx.restore();
}

/** Draw the rig in pose p at the current transform (origin = feet, scale 1 = 88px tall). */
export function drawRig(ctx: Ctx, p: Pose, k: Paint): void {
  clampPose(p);
  solve(p);
  const L = k.look;
  setRim(k.rim, k.torch);
  if (p.rot !== 0) {
    // spin about the body's centre of mass (a little up the spine from the pelvis)
    const cx = J[P.Pelvis] + Math.sin(p.spine) * 8;
    const cy = J[P.Pelvis + 1] - Math.cos(p.spine) * 8;
    ctx.translate(cx, cy);
    ctx.rotate(p.rot);
    ctx.translate(-cx, -cy);
  }
  const F = far(L);
  // far side: darker, faint rim so the silhouette still separates from a dark wall
  rimAlpha(k.torch ? 0.7 : 0.45);
  arm(ctx, P.Sh1, P.El1, P.Hand1, F.suit, F.gloves);
  leg(ctx, P.Hip1, P.Knee1, P.Ankle1, P.Toe1, F.legs, F.boots, L.sole);
  rimAlpha(1);
  torso(ctx, p, L);
  leg(ctx, P.Hip0, P.Knee0, P.Ankle0, P.Toe0, L.legs, L.boots, L.sole);
  if (L.holster) holster(ctx, P.Hip0, P.Knee0, L);
  drawHead(ctx, p, L, k.torch);
  arm(ctx, P.Sh0, P.El0, P.Hand0, L.suit, L.gloves);
  if (L.backpack) cable(ctx, p);
  if (k.torch) torch(ctx);
}

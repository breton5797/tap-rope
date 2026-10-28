// v7.1 ghost trail (GDD-v7.1 §2–3): the last few frames of the operative redrawn as flat,
// fading silhouettes behind the figure — amber in overdrive, cool white on lane moves. Poses and
// placements live in fixed slots (copied, never allocated per frame); a ghost is the cheap
// silhouette path of drawRig, so three of them cost about one shaded figure.
import { drawRig, newPose, type Paint, type Pose } from './rig';
import type { Ctx } from './util';

const N = 3;
/** seconds between samples: spaced wider than a frame so the trail reads at 60 fps */
const EVERY = 1 / 30;
/** a ghost fades out over this long */
const LIFE = 0.12;

interface Slot {
  readonly pose: Pose;
  t: number;
  x: number;
  y: number;
  lean: number;
  scale: number;
  sx: number;
  sy: number;
}

function copyPose(d: Pose, s: Pose): void {
  d.x = s.x;
  d.y = s.y;
  d.rot = s.rot;
  d.spine = s.spine;
  d.head = s.head;
  d.plant = s.plant;
  for (let i = 0; i < 2; i++) {
    d.legs[i].hip = s.legs[i].hip;
    d.legs[i].knee = s.legs[i].knee;
    d.legs[i].ankle = s.legs[i].ankle;
    d.arms[i].hip = s.arms[i].hip;
    d.arms[i].knee = s.arms[i].knee;
    d.arms[i].ankle = s.arms[i].ankle;
  }
}

export class GhostTrail {
  private readonly slots: Slot[] = Array.from({ length: N }, () => ({
    pose: newPose(), t: Number.NEGATIVE_INFINITY, x: 0, y: 0, lean: 0, scale: 1, sx: 1, sy: 1,
  }));
  private head = 0;
  private last = Number.NEGATIVE_INFINITY;

  /** Record the frame just drawn (pose already clamped by drawRig), at most every EVERY s. */
  sample(p: Pose, t: number, x: number, y: number, lean: number, scale: number, sx: number, sy: number): void {
    if (t - this.last < EVERY && t >= this.last) return;
    this.last = t;
    const s = this.slots[this.head];
    this.head = (this.head + 1) % N;
    copyPose(s.pose, p);
    s.t = t;
    s.x = x;
    s.y = y;
    s.lean = lean;
    s.scale = scale;
    s.sx = sx;
    s.sy = sy;
  }

  /** Forget every ghost (trail switched off, new run). */
  clear(): void {
    for (const s of this.slots) s.t = Number.NEGATIVE_INFINITY;
    this.last = Number.NEGATIVE_INFINITY;
  }

  /** Draw live ghosts oldest first in `color`; `drift` = px/s they slide back (overdrive speed). */
  draw(ctx: Ctx, k: Paint, color: string, now: number, strength: number, drift: number): void {
    const flat0 = k.flat;
    const out0 = k.outline;
    k.flat = color;
    k.outline = 0;
    for (let i = N; i >= 1; i--) {
      const s = this.slots[(this.head - i + N * 2) % N];
      const age = now - s.t;
      if (age < 0 || age > LIFE + i * EVERY) continue;
      const a = strength * (0.36 - 0.09 * i) * (1 - age / (LIFE + i * EVERY));
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(s.x - drift * (age + 0.02), s.y);
      if (s.lean !== 0) ctx.rotate(s.lean);
      ctx.scale(s.scale * s.sx, s.scale * s.sy);
      drawRig(ctx, s.pose, k);
      ctx.restore();
    }
    k.flat = flat0;
    k.outline = out0;
  }
}

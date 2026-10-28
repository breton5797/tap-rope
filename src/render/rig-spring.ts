// Damped springs for the rig's secondary motion (GDD-v7.1 §1): backpack, cable, sling strap and
// cloth tails lag behind the body and jiggle on landings and hits. Plain mutable records so the
// painter can keep one per gear item without allocating per frame.

export interface Spring {
  x: number;
  v: number;
}

export function newSpring(x = 0): Spring {
  return { x, v: 0 };
}

/** fixed sub-step: semi-implicit Euler stays stable for the stiffness range used here */
const SUB = 1 / 120;
/** a frame longer than this (tab switch, hitch) is treated as this long */
const MAX_DT = 0.1;

/**
 * Advance spring s toward target over dt seconds. k = stiffness (1/s², natural frequency √k),
 * z = damping ratio (1 = critical, < 1 overshoots and wobbles).
 */
export function springStep(s: Spring, target: number, k: number, z: number, dt: number): void {
  let left = Math.min(Math.max(dt, 0), MAX_DT);
  const c = 2 * z * Math.sqrt(k);
  while (left > 1e-9) {
    const h = Math.min(left, SUB);
    s.v += (k * (target - s.x) - c * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
}

/** Kick a spring (landing thump, hit): adds velocity, the spring rings out on its own. */
export function springKick(s: Spring, dv: number): void {
  s.v += dv;
}

// Oblique top-down camera: world (x lateral, z ahead, h height) → logical screen.
// The camera hangs above and in front of the kid, looking down ~60°: the ground
// recedes toward a high horizon, obstacles approach from the top of the screen.

export const CENTER_X = 180;
export const HORIZON_Y = 112;
/** screen y of the ground directly under the player (z = 0) */
export const NEAR_Y = 454;
/** perspective focal length in world px — smaller = stronger perspective */
export const FOCAL = 540;
/** vertical heights are foreshortened by the viewing angle */
export const HEIGHT_K = 0.82;
const SPAN = NEAR_Y - HORIZON_Y;
const Z_MIN = -FOCAL * 0.6;

/** depth scale: 1 at the player, < 1 farther away */
export function depthScale(z: number): number {
  return FOCAL / (FOCAL + Math.max(z, Z_MIN));
}

export function groundY(z: number): number {
  return HORIZON_Y + SPAN * depthScale(z);
}

export function screenX(x: number, z: number): number {
  return CENTER_X + x * depthScale(z);
}

export function screenY(z: number, h: number): number {
  const s = depthScale(z);
  return HORIZON_Y + SPAN * s - h * s * HEIGHT_K;
}

/** writes [screenX, screenY, scale] into out */
export function project(x: number, z: number, h: number, out: Float32Array): void {
  const s = depthScale(z);
  out[0] = CENTER_X + x * s;
  out[1] = HORIZON_Y + SPAN * s - h * s * HEIGHT_K;
  out[2] = s;
}

/** screen half-height of a ground ellipse of world depth-radius rz centred at z */
export function groundRy(z: number, rz: number): number {
  return Math.abs(groundY(z - rz) - groundY(z + rz)) / 2;
}

/** inverse of groundY: world z for a screen y below the horizon */
export function zAtScreenY(y: number): number {
  const s = (y - HORIZON_Y) / SPAN;
  return s <= 0 ? Number.POSITIVE_INFINITY : FOCAL / s - FOCAL;
}

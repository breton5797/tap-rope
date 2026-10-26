// Body parts of the operative rig: muscle-tapered limb capsules (no joint discs: neighbouring
// segments overlap in the same cloth colour), the torso silhouette with its gear, gloved hands and
// boots. Three-tone plane shading (key light above-front) plus a rim line in the scene colour.
import { FOOT, J, P, type Pose } from './rig-skeleton';
import type { AgentLook } from './skins';
import type { Ctx } from './util';

export interface Paint {
  look: AgentLook;
  rim: string; // scene rim-light colour
  torch: boolean; // dark scene: hand torch + stronger rim (readability, M3)
}

/** key light direction (toward the light): above and in front */
const LX = 0.5;
const LY = -0.866;

/** three tones of one material: base, key-lit plane, shadow plane */
export interface Tone {
  base: string;
  light: string;
  dark: string;
}

/** rim stroke settings for the current figure (set once per draw) */
const rimState = { color: '', width: 0.7, alpha: 1, boost: 0.75 };

export function setRim(color: string, strong: boolean): void {
  rimState.color = color;
  rimState.width = strong ? 1.3 : 0.7;
  rimState.boost = strong ? 1 : 0.75;
}

export function rimAlpha(a: number): void {
  rimState.alpha = a;
}

/** Stroke the current path as rim light. */
export function rimStroke(ctx: Ctx): void {
  const a = rimState.alpha * rimState.boost;
  if (a <= 0) return;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * a;
  ctx.strokeStyle = rimState.color;
  ctx.lineWidth = rimState.width;
  ctx.stroke();
  ctx.globalAlpha = a0;
}

/**
 * Tapered capsule from joint a to joint b with widths wa → wb (half widths) and a muscle bulge on
 * each side: bulge widths bl (+normal side) / br (−normal side) peaking at fraction `at`.
 */
export function seg(
  ctx: Ctx, a: number, b: number, wa: number, wb: number, bl: number, br: number, at: number, t: Tone, rim = true,
): void {
  const ax = J[a];
  const ay = J[a + 1];
  const bx = J[b];
  const by = J[b + 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ang = Math.atan2(dy, dx);
  const cx = ax + dx * at;
  const cy = ay + dy * at;
  // quadratic control offsets so the outline peaks near the requested bulge widths
  const kl = 2 * bl - (wa + wb) / 2;
  const kr = 2 * br - (wa + wb) / 2;
  ctx.fillStyle = t.base;
  ctx.beginPath();
  ctx.moveTo(ax + nx * wa, ay + ny * wa);
  ctx.quadraticCurveTo(cx + nx * kl, cy + ny * kl, bx + nx * wb, by + ny * wb);
  ctx.arc(bx, by, wb, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.quadraticCurveTo(cx - nx * kr, cy - ny * kr, ax - nx * wa, ay - ny * wa);
  ctx.arc(ax, ay, wa, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
  ctx.fill();
  // lit plane (toward the key light) and shadow plane (away from it): strips that taper out at the ends
  const s = nx * LX + ny * LY > 0 ? 1 : -1;
  const ox = nx * s;
  const oy = ny * s;
  const kLit = s > 0 ? kl : kr;
  const kSh = s > 0 ? kr : kl;
  // soft planes (partly transparent so they read as shading, not as piping)
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * 0.55;
  strip(ctx, ax, ay, bx, by, cx, cy, ox, oy, wa, wb, kLit, 0.95, 0.05, t.light);
  ctx.globalAlpha = a0 * 0.8;
  strip(ctx, ax, ay, bx, by, cx, cy, -ox, -oy, wa, wb, kSh, 0.98, 0.3, t.dark);
  ctx.globalAlpha = a0;
  if (!rim) return;
  ctx.beginPath();
  ctx.moveTo(ax - ox * (wa - 0.4), ay - oy * (wa - 0.4));
  ctx.quadraticCurveTo(cx - ox * (kSh - 0.4), cy - oy * (kSh - 0.4), bx - ox * (wb - 0.4), by - oy * (wb - 0.4));
  rimStroke(ctx);
}

function strip(
  ctx: Ctx, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, ox: number, oy: number,
  wa: number, wb: number, k: number, outer: number, inner: number, color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax + ox * wa * outer * 0.8, ay + oy * wa * outer * 0.8);
  ctx.quadraticCurveTo(cx + ox * k * outer, cy + oy * k * outer, bx + ox * wb * outer * 0.8, by + oy * wb * outer * 0.8);
  ctx.quadraticCurveTo(cx + ox * k * inner, cy + oy * k * inner, ax + ox * wa * outer * 0.8, ay + oy * wa * outer * 0.8);
  ctx.closePath();
  ctx.fill();
}

// ---------- local frames ----------

/** Rotate the context into the frame of segment a → b (local +x along the segment). */
function frame(ctx: Ctx, a: number, b: number): void {
  ctx.translate(J[a], J[a + 1]);
  ctx.rotate(Math.atan2(J[b + 1] - J[a + 1], J[b] - J[a]));
}

/** Gloved fist at the end of the forearm (or a bare hand for the scientist). */
export function hand(ctx: Ctx, el: number, h: number, t: Tone): void {
  ctx.save();
  frame(ctx, el, h);
  ctx.translate(Math.hypot(J[h] - J[el], J[h + 1] - J[el + 1]) - 1.2, 0);
  ctx.fillStyle = t.base;
  ctx.beginPath();
  ctx.moveTo(0, -1.9);
  ctx.lineTo(3.0, -2.3);
  ctx.quadraticCurveTo(4.9, -2.2, 4.8, 0.1);
  ctx.quadraticCurveTo(4.6, 2.3, 2.8, 2.2);
  ctx.lineTo(0, 1.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.light;
  ctx.fillRect(0.6, -2.0, 3.4, 0.9);
  ctx.fillStyle = t.dark;
  ctx.fillRect(3.6, -0.6, 1.0, 2.2);
  ctx.restore();
}

/** Boot: shaft over the lower shin, heel, sole and toe cap, in the foot's frame. */
export function boot(ctx: Ctx, ankle: number, toe: number, t: Tone, sole: string): void {
  ctx.save();
  frame(ctx, ankle, toe);
  const F = FOOT;
  ctx.fillStyle = t.base;
  ctx.beginPath();
  ctx.moveTo(-2.5, -4.6);
  ctx.lineTo(2.3, -4.9);
  ctx.quadraticCurveTo(2.6, -1.4, 5.0, -0.9);
  ctx.quadraticCurveTo(F + 1.7, -0.4, F + 1.6, 1.3);
  ctx.lineTo(F + 1.2, 2.3);
  ctx.lineTo(-2.8, 2.3);
  ctx.quadraticCurveTo(-3.7, 1.4, -3.2, -0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.light;
  ctx.beginPath();
  ctx.moveTo(1.6, -4.7);
  ctx.quadraticCurveTo(2.2, -1.6, 5.0, -0.9);
  ctx.quadraticCurveTo(F, -0.6, F + 1.3, 0.4);
  ctx.lineTo(4.6, 0.2);
  ctx.quadraticCurveTo(1.4, -0.4, 0.6, -4.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = sole;
  ctx.fillRect(-3.0, 1.3, F + 4.2, 1.0);
  ctx.restore();
}

/** Drop-leg holster strapped to the near thigh. */
export function holster(ctx: Ctx, hip: number, knee: number, look: AgentLook): void {
  ctx.save();
  frame(ctx, hip, knee);
  ctx.fillStyle = '#0D0F11';
  ctx.beginPath();
  ctx.moveTo(2.5, -2.6);
  ctx.lineTo(11.5, -2.2);
  ctx.quadraticCurveTo(12.5, 0, 11.5, 2.4);
  ctx.lineTo(2.5, 2.8);
  ctx.closePath();
  ctx.fill();
  // grip sticking out above the holster, strap round the thigh
  ctx.fillStyle = '#16191C';
  ctx.fillRect(0.2, -1.4, 3.0, 3.0);
  ctx.fillStyle = look.vestLight;
  ctx.fillRect(7.2, -3.4, 0.9, 6.9);
  ctx.restore();
}

// ---------- torso ----------

/** Torso silhouette (side view, x forward, y up the spine), drawn in the spine frame. */
function torsoShape(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(3.8, 1.2);
  ctx.quadraticCurveTo(5.4, -3.8, 4.6, -9);
  ctx.quadraticCurveTo(4.1, -13, 5.6, -17);
  ctx.quadraticCurveTo(6.9, -21.5, 5.0, -25.2);
  ctx.quadraticCurveTo(3.4, -27.4, 1.6, -28.2);
  ctx.lineTo(-2.4, -28.4);
  ctx.quadraticCurveTo(-5.8, -27.2, -6.1, -22);
  ctx.quadraticCurveTo(-6.3, -15.5, -4.5, -10);
  ctx.quadraticCurveTo(-3.9, -6, -5.7, -2.4);
  ctx.quadraticCurveTo(-6.6, 1.6, -3.4, 4.2);
  ctx.quadraticCurveTo(0, 5.2, 3.8, 1.2);
  ctx.closePath();
}

/** Enter the torso frame (origin pelvis, rotated with the spine). Caller restores. */
function torsoFrame(ctx: Ctx, p: Pose): void {
  ctx.save();
  ctx.translate(J[P.Pelvis], J[P.Pelvis + 1]);
  ctx.rotate(p.spine);
}

export function torso(ctx: Ctx, p: Pose, L: AgentLook): void {
  if (L.backpack) backpack(ctx, p, L);
  torsoFrame(ctx, p);
  ctx.fillStyle = L.suit.base;
  torsoShape(ctx);
  ctx.fill();
  // key-lit front / top plane
  ctx.fillStyle = L.suit.light;
  ctx.beginPath();
  ctx.moveTo(1.6, -27.6);
  ctx.quadraticCurveTo(3.6, -27, 5.0, -25.2);
  ctx.quadraticCurveTo(6.9, -21.5, 5.6, -17);
  ctx.quadraticCurveTo(4.1, -13, 4.6, -9);
  ctx.quadraticCurveTo(5.0, -5.5, 4.2, -2.5);
  ctx.quadraticCurveTo(2.4, -12, 1.2, -26);
  ctx.closePath();
  ctx.fill();
  // shadowed lower back / seat
  ctx.fillStyle = L.suit.dark;
  ctx.beginPath();
  ctx.moveTo(-4.5, -10);
  ctx.quadraticCurveTo(-3.9, -6, -5.7, -2.4);
  ctx.quadraticCurveTo(-6.6, 1.6, -3.4, 4.2);
  ctx.quadraticCurveTo(0, 5.2, 3.8, 1.2);
  ctx.quadraticCurveTo(-1.5, 1.5, -2.6, -9);
  ctx.closePath();
  ctx.fill();
  if (L.metal) androidPlates(ctx, L);
  else if (L.vest) plateCarrier(ctx, L);
  else if (L.id === 'prisoner') jumpsuit(ctx, L);
  else clothSeams(ctx, L);
  if (L.belt) {
    ctx.fillStyle = L.belt;
    ctx.beginPath();
    ctx.moveTo(-5.4, -5.4);
    ctx.lineTo(4.9, -5.6);
    ctx.lineTo(4.6, -3.0);
    ctx.lineTo(-5.6, -2.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5A6066';
    ctx.fillRect(3.4, -5.2, 1.4, 2.0);
  }
  // rim light along the back
  ctx.beginPath();
  ctx.moveTo(-2.6, -28.0);
  ctx.quadraticCurveTo(-5.4, -27.0, -5.7, -22);
  ctx.quadraticCurveTo(-5.9, -15.5, -4.1, -10);
  ctx.quadraticCurveTo(-3.5, -6, -5.3, -2.4);
  ctx.quadraticCurveTo(-6.1, 1.2, -3.4, 3.7);
  rimStroke(ctx);
  ctx.restore();
}

function plateCarrier(ctx: Ctx, L: AgentLook): void {
  const v = L.vest as Tone;
  // back plate, front plate, cummerbund between them
  ctx.fillStyle = v.base;
  ctx.beginPath();
  ctx.moveTo(-7.0, -25.0);
  ctx.lineTo(-4.0, -25.6);
  ctx.lineTo(-3.6, -11.0);
  ctx.lineTo(-6.4, -11.2);
  ctx.quadraticCurveTo(-7.6, -18, -7.0, -25.0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-4.6, -14.6, 9.6, 4.6);
  ctx.beginPath();
  ctx.moveTo(3.6, -25.4);
  ctx.lineTo(6.6, -24.4);
  ctx.quadraticCurveTo(8.1, -18, 7.2, -11.0);
  ctx.lineTo(3.8, -10.6);
  ctx.closePath();
  ctx.fill();
  // shoulder strap over the top
  ctx.fillRect(-4.4, -27.2, 8.4, 2.0);
  // lit face of the front plate + magazine pouches
  ctx.fillStyle = v.light;
  ctx.fillRect(5.6, -24.0, 1.6, 12.6);
  ctx.fillStyle = v.dark;
  ctx.fillRect(7.0, -19.5, 2.0, 6.8);
  ctx.fillStyle = v.light;
  ctx.fillRect(7.0, -19.5, 2.0, 1.0);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(4.0, -16.2, 3.2, 0.6);
  ctx.fillRect(-4.6, -12.4, 9.6, 0.5);
  // radio antenna stub on the back plate
  ctx.fillStyle = '#0B0C0E';
  ctx.fillRect(-7.4, -25.0, 1.4, 5.0);
}

function androidPlates(ctx: Ctx, L: AgentLook): void {
  // chest shell, abdominal segments, seam lines
  ctx.fillStyle = L.suit.light;
  ctx.beginPath();
  ctx.moveTo(1.0, -26.5);
  ctx.quadraticCurveTo(6.8, -24, 5.8, -16.5);
  ctx.lineTo(1.8, -15.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(-5.4, -15.4);
  ctx.lineTo(5.6, -15.8);
  ctx.moveTo(-4.4, -11.6);
  ctx.lineTo(4.6, -11.8);
  ctx.moveTo(-4.4, -8.0);
  ctx.lineTo(4.7, -8.0);
  ctx.moveTo(-1.0, -27.8);
  ctx.lineTo(-1.6, -16);
  ctx.stroke();
  // vent slits on the back
  ctx.fillStyle = '#121418';
  ctx.fillRect(-5.6, -23.5, 1.3, 1.0);
  ctx.fillRect(-5.7, -21.5, 1.3, 1.0);
}

function jumpsuit(ctx: Ctx, L: AgentLook): void {
  // collar opening, chest pocket, stencilled number patch, waist seam
  ctx.fillStyle = L.skin.base;
  ctx.beginPath();
  ctx.moveTo(1.4, -28.0);
  ctx.lineTo(4.6, -25.6);
  ctx.lineTo(2.2, -23.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = L.suit.dark;
  ctx.fillRect(2.4, -21.0, 3.2, 3.6);
  ctx.fillStyle = 'rgba(235,230,220,0.75)';
  ctx.fillRect(-4.6, -23.5, 3.0, 2.2);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-5.0, -5.0);
  ctx.lineTo(4.8, -5.2);
  ctx.moveTo(2.0, -26.0);
  ctx.lineTo(1.6, -6.0);
  ctx.stroke();
}

function clothSeams(ctx: Ctx, L: AgentLook): void {
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(-1.2, -27.6);
  ctx.quadraticCurveTo(0.6, -17, -0.6, -6);
  ctx.stroke();
  if (L.sash) {
    ctx.fillStyle = L.sash;
    ctx.beginPath();
    ctx.moveTo(-5.2, -7.0);
    ctx.lineTo(4.7, -7.4);
    ctx.lineTo(4.6, -3.8);
    ctx.lineTo(-5.5, -3.4);
    ctx.closePath();
    ctx.fill();
    // knot tails hanging off the back
    ctx.beginPath();
    ctx.moveTo(-5.4, -5.6);
    ctx.lineTo(-7.6, 1.2);
    ctx.lineTo(-6.4, 1.4);
    ctx.lineTo(-4.8, -4.0);
    ctx.closePath();
    ctx.fill();
  }
}

/** Hacker's backpack with a cable to the wrist deck (drawn before the torso, it sits behind). */
function backpack(ctx: Ctx, p: Pose, L: AgentLook): void {
  torsoFrame(ctx, p);
  ctx.fillStyle = '#16181B';
  ctx.beginPath();
  ctx.moveTo(-5.0, -26.5);
  ctx.lineTo(-10.2, -25.4);
  ctx.quadraticCurveTo(-11.8, -17, -10.0, -8.5);
  ctx.lineTo(-4.6, -8.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#272A2F';
  ctx.fillRect(-10.4, -24.6, 1.4, 14.5);
  ctx.fillStyle = '#0C0D0F';
  ctx.fillRect(-9.8, -16.5, 4.6, 0.7);
  // antenna and a tiny status LED
  ctx.strokeStyle = '#3A3F45';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-9.0, -25.6);
  ctx.lineTo(-11.4, -33.5);
  ctx.stroke();
  ctx.fillStyle = L.accent;
  ctx.fillRect(-9.6, -12.4, 0.9, 0.9);
  ctx.restore();
}

/** Coiled cable from the backpack's hip pocket to the near wrist. */
export function cable(ctx: Ctx, p: Pose): void {
  const c = Math.cos(p.spine);
  const s = Math.sin(p.spine);
  // local (-6, -9) in the torso frame
  const x0 = J[P.Pelvis] + -6 * c - -9 * s;
  const y0 = J[P.Pelvis + 1] + -6 * s + -9 * c;
  const x1 = J[P.Hand0];
  const y1 = J[P.Hand0 + 1];
  ctx.strokeStyle = '#0A0B0C';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 3, x1, y1);
  ctx.stroke();
}

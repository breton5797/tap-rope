// Heads of the operative rig, drawn in the head frame (origin = head centre, x forward, y down).
// Operatives never show a cartoon face: balaclava / cowl / hood / wrap / helmet cover the head,
// eyes sit behind NVG, a visor, eye-pro or a shadowed slit; skin shows as a sliver at most. The
// scientist has a bare head drawn as a real profile (brow, nose, lips, ear, receding grey hair).
import { J, P, type Pose } from './rig-skeleton';
import { flatColor, keyStroke, outlineStroke, rimStroke, seg, spec, type Tone } from './rig-parts';
import type { AgentLook } from './skins';
import type { Ctx } from './util';

/** Covered-head profile: cranium, forehead, smooth face plane, chin, jaw. */
function skull(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-3.0, 5.0);
  ctx.quadraticCurveTo(-6.2, 2.0, -5.7, -1.5);
  ctx.bezierCurveTo(-5.4, -6.4, 2.0, -7.6, 4.4, -3.4);
  ctx.quadraticCurveTo(5.5, -1.6, 5.3, 0.4);
  ctx.quadraticCurveTo(5.3, 3.6, 3.6, 5.0);
  ctx.quadraticCurveTo(1.0, 5.8, -0.4, 4.6);
  ctx.closePath();
}

/** Bare profile: brow ridge, nose, lips and chin. */
function face(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-3.0, 5.0);
  ctx.quadraticCurveTo(-6.2, 2.0, -5.7, -1.5);
  ctx.bezierCurveTo(-5.4, -6.4, 2.0, -7.4, 4.3, -3.6);
  ctx.quadraticCurveTo(5.3, -2.2, 5.1, -1.2);
  ctx.lineTo(4.9, -0.5);
  ctx.quadraticCurveTo(6.0, 0.6, 6.3, 1.3);
  ctx.lineTo(5.0, 1.7);
  ctx.quadraticCurveTo(5.4, 2.3, 5.1, 2.8);
  ctx.quadraticCurveTo(5.3, 3.4, 4.9, 3.8);
  ctx.quadraticCurveTo(4.8, 5.0, 3.4, 5.3);
  ctx.quadraticCurveTo(1.0, 5.8, -0.4, 4.6);
  ctx.closePath();
}

/** Base fill with key-lit top-front and shadowed back-bottom planes, clipped to the outline. */
function shaded(ctx: Ctx, t: Tone, bare: boolean): void {
  ctx.save();
  if (bare) face(ctx);
  else skull(ctx);
  ctx.fillStyle = t.base;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = t.light;
  ctx.beginPath();
  ctx.ellipse(2.4, -3.4, 4.6, 3.6, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.ellipse(-5.0, 3.4, 4.4, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function poly(ctx: Ctx, color: string, pts: readonly number[]): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function earCup(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#0C0D0F';
  ctx.beginPath();
  ctx.ellipse(x, y, 1.6, 2.3, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2A2E33';
  ctx.fillRect(x - 0.5, y - 1.6, 0.9, 2.4);
}

/** Low-cut helmet shell with an NVG housing flipped down over the eyes (Agent K). */
function nvgHead(ctx: Ctx, L: AgentLook): void {
  shaded(ctx, L.headGear, false);
  ctx.fillStyle = '#262A2F';
  ctx.beginPath();
  ctx.moveTo(-5.9, -0.8);
  ctx.bezierCurveTo(-5.8, -7.6, 2.4, -8.8, 5.0, -3.4);
  ctx.lineTo(4.4, -2.7);
  ctx.bezierCurveTo(2.0, -6.9, -4.6, -6.5, -5.0, -0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3A4047';
  ctx.fillRect(-2.5, -6.8, 4.2, 0.7);
  earCup(ctx, -0.8, 0.4);
  // boom mic toward the mouth
  ctx.strokeStyle = '#0C0D0F';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(0.2, 1.8);
  ctx.quadraticCurveTo(2.2, 3.6, 4.4, 3.0);
  ctx.stroke();
  // shroud plate + hinged mount arm + binocular housing + lens with a specular glint
  poly(ctx, '#2E3339', [2.6, -6.6, 4.6, -6.0, 4.4, -4.8, 2.6, -5.2]);
  poly(ctx, '#15171A', [3.6, -5.6, 5.4, -4.6, 5.6, -2.6, 4.0, -2.8]);
  ctx.fillStyle = '#4A525B';
  ctx.beginPath();
  ctx.arc(4.6, -4.4, 0.7, 0, Math.PI * 2);
  ctx.fill();
  spec(ctx, 4.3, -4.8, 0.4, 0.4);
  poly(ctx, '#1E2226', [4.0, -2.9, 7.4, -2.6, 7.6, 0.0, 4.2, 0.2]);
  ctx.fillStyle = '#3A4047';
  ctx.fillRect(4.2, -2.8, 3.1, 0.6);
  spec(ctx, 4.8, -2.8, 1.6, 0.3);
  ctx.fillStyle = '#0A0B0C';
  ctx.fillRect(7.4, -2.4, 1.2, 2.2);
  ctx.fillStyle = L.accent;
  ctx.globalAlpha *= 0.85;
  ctx.fillRect(8.2, -1.9, 0.5, 1.2);
  ctx.globalAlpha /= 0.85;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(8.3, -2.1, 0.35, 0.35);
}

/** Smooth stealth cowl with a dark visor slit and a faint lens line (Black Cat). */
function visorHead(ctx: Ctx, L: AgentLook): void {
  shaded(ctx, L.headGear, false);
  poly(ctx, '#050607', [1.4, -2.1, 5.3, -1.7, 5.5, -0.1, 1.3, -0.4]);
  ctx.fillStyle = L.accent;
  ctx.globalAlpha *= 0.7;
  ctx.fillRect(2.0, -1.2, 3.4, 0.45);
  ctx.globalAlpha /= 0.7;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-0.6, -6.4);
  ctx.quadraticCurveTo(-1.6, 0, -2.4, 4.8);
  ctx.stroke();
}

/** Hoodie hood over a shadowed face, lower face behind a mask (Hacker). */
function hoodHead(ctx: Ctx, L: AgentLook): void {
  skull(ctx);
  ctx.fillStyle = '#0B0C0E';
  ctx.fill();
  // the only skin: a sliver of cheekbone catching a screen glow
  poly(ctx, L.skin.dark, [3.0, -1.5, 5.1, -1.3, 5.0, -0.6, 3.1, -0.7]);
  poly(ctx, '#1A1C1F', [2.4, 0.8, 5.4, 0.6, 5.0, 3.6, 3.6, 5.0, 2.0, 4.8]);
  const g = L.headGear;
  ctx.fillStyle = g.base;
  ctx.beginPath();
  ctx.moveTo(-3.8, 6.4);
  ctx.quadraticCurveTo(-7.8, 1.0, -6.8, -3.2);
  ctx.bezierCurveTo(-5.8, -8.9, 3.2, -9.4, 5.9, -4.4);
  ctx.lineTo(4.6, -3.4);
  ctx.quadraticCurveTo(2.2, -3.4, 2.0, -0.6);
  ctx.quadraticCurveTo(1.8, 3.2, 3.6, 5.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = g.light;
  ctx.beginPath();
  ctx.moveTo(-4.8, -6.0);
  ctx.bezierCurveTo(-2.0, -8.6, 3.6, -8.4, 5.9, -4.4);
  ctx.lineTo(4.6, -3.4);
  ctx.bezierCurveTo(2.6, -6.6, -2.0, -7.0, -4.8, -6.0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = g.dark;
  ctx.beginPath();
  ctx.moveTo(-3.8, 6.4);
  ctx.quadraticCurveTo(-7.8, 1.0, -6.8, -3.2);
  ctx.quadraticCurveTo(-4.6, 1.0, -1.0, 6.2);
  ctx.closePath();
  ctx.fill();
}

/** Gunmetal shell, angular face plate, red sensor line (R-7). */
function androidHead(ctx: Ctx, L: AgentLook): void {
  shaded(ctx, L.headGear, false);
  poly(ctx, L.headGear.dark, [1.0, -3.8, 5.2, -2.8, 5.6, 1.4, 3.6, 4.9, 0.4, 4.6]);
  poly(ctx, '#0B0C0E', [1.2, -2.0, 5.5, -1.6, 5.6, -0.2, 1.1, -0.5]);
  ctx.strokeStyle = L.accent;
  ctx.globalAlpha *= 0.3;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(1.6, -1.1);
  ctx.lineTo(5.5, -0.9);
  ctx.stroke();
  ctx.globalAlpha /= 0.3;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.fillStyle = L.headGear.light;
  ctx.fillRect(-2.0, -1.8, 2.6, 3.6);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-2.0, -1.8);
  ctx.lineTo(-2.0, 1.8);
  ctx.moveTo(-4.0, -5.2);
  ctx.quadraticCurveTo(0, -7.4, 3.6, -4.0);
  ctx.moveTo(1.4, 2.6);
  ctx.lineTo(4.8, 2.4);
  ctx.stroke();
}

/** Cloth wrap with a shadowed eye slit and short knot tails (Shadow). */
function wrapHead(ctx: Ctx, L: AgentLook): void {
  const g = L.headGear;
  ctx.fillStyle = g.dark;
  ctx.beginPath();
  ctx.moveTo(-5.0, -2.6);
  ctx.quadraticCurveTo(-8.0, -1.0, -9.6, 2.2);
  ctx.lineTo(-8.8, 2.6);
  ctx.quadraticCurveTo(-7.4, 0.4, -5.2, -0.8);
  ctx.quadraticCurveTo(-7.2, 2.4, -7.6, 4.6);
  ctx.lineTo(-6.8, 4.8);
  ctx.quadraticCurveTo(-6.0, 1.8, -4.6, -0.6);
  ctx.closePath();
  ctx.fill();
  shaded(ctx, g, false);
  poly(ctx, L.skin.base, [2.4, -1.9, 5.4, -1.6, 5.3, -0.6, 2.3, -0.9]);
  poly(ctx, L.skin.dark, [2.4, -1.9, 5.4, -1.6, 5.4, -1.2, 2.4, -1.4]);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-4.6, -3.6);
  ctx.lineTo(3.6, -3.0);
  ctx.moveTo(-4.4, 1.4);
  ctx.lineTo(4.8, 0.6);
  ctx.stroke();
}

/** Ballistic helmet with NVG shroud and counterweight, eye-pro, scarf over the lower face. */
function helmetHead(ctx: Ctx, L: AgentLook): void {
  shaded(ctx, L.skin, false);
  poly(ctx, L.headGear.dark, [-1.0, 0.0, 5.6, -0.1, 5.4, 2.8, 3.8, 5.3, 0.6, 5.8, -3.2, 5.4]);
  poly(ctx, '#0A0B0C', [1.8, -2.2, 5.6, -1.8, 5.6, -0.2, 2.0, -0.4]);
  ctx.fillStyle = 'rgba(200,215,220,0.35)';
  ctx.fillRect(3.4, -1.7, 1.8, 0.4);
  earCup(ctx, -1.2, 1.0);
  const g = L.headGear;
  ctx.fillStyle = g.base;
  ctx.beginPath();
  ctx.moveTo(-6.4, 0.6);
  ctx.bezierCurveTo(-6.6, -8.6, 3.0, -9.8, 5.9, -3.0);
  ctx.lineTo(5.7, -2.2);
  ctx.lineTo(4.2, -2.6);
  ctx.bezierCurveTo(2.4, -6.4, -4.0, -6.2, -4.6, 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = g.light;
  ctx.beginPath();
  ctx.moveTo(-4.8, -6.0);
  ctx.bezierCurveTo(-2.0, -9.0, 3.4, -8.8, 5.8, -3.2);
  ctx.lineTo(4.8, -3.6);
  ctx.bezierCurveTo(2.8, -7.0, -2.0, -7.6, -4.8, -6.0);
  ctx.closePath();
  ctx.fill();
  // side rail, NVG shroud + folded mount on the brow, counterweight pouch at the back
  ctx.fillStyle = g.dark;
  ctx.fillRect(-4.2, -3.0, 6.4, 0.9);
  spec(ctx, -3.6, -3.0, 1.2, 0.3);
  poly(ctx, '#15171A', [3.4, -6.4, 5.2, -5.4, 5.4, -3.6, 3.6, -4.2]);
  poly(ctx, '#23272C', [4.6, -6.0, 6.6, -5.6, 6.8, -4.2, 5.0, -4.0]);
  spec(ctx, 5.0, -5.9, 1.0, 0.3);
  poly(ctx, g.dark, [-6.6, -4.6, -5.2, -5.2, -4.8, -2.0, -6.6, -1.8]);
}

/** The scientist's bare head: shaded profile, ear, receding grey hair, brow shadow, glasses. */
function bareHead(ctx: Ctx, L: AgentLook): void {
  shaded(ctx, L.skin, true);
  ctx.fillStyle = L.hair;
  ctx.beginPath();
  ctx.moveTo(-3.0, 5.0);
  ctx.quadraticCurveTo(-6.4, 2.0, -5.9, -1.5);
  ctx.bezierCurveTo(-5.6, -6.6, 0.0, -7.6, 2.2, -6.0);
  ctx.quadraticCurveTo(-1.4, -5.6, -1.6, -2.0);
  ctx.quadraticCurveTo(-2.0, 1.4, -1.2, 4.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = L.skin.dark;
  ctx.beginPath();
  ctx.ellipse(-0.4, 0.4, 1.0, 1.6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // brow shadow over the eye socket, nasolabial shade, glasses
  poly(ctx, 'rgba(40,24,16,0.55)', [3.2, -1.7, 5.1, -1.3, 5.0, -0.7, 3.3, -0.9]);
  ctx.strokeStyle = 'rgba(30,26,22,0.85)';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(0.4, -0.9);
  ctx.lineTo(3.4, -1.1);
  ctx.rect(3.4, -1.7, 1.9, 1.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(210,230,235,0.35)';
  ctx.fillRect(4.2, -1.5, 0.8, 0.5);
}

const HEADS = {
  nvg: nvgHead, visor: visorHead, hood: hoodHead, android: androidHead, wrap: wrapHead, helmet: helmetHead, bare: bareHead,
} as const;

/** outline radius of the rim arc per head style (hoods and helmets stand off the skull) */
const RIM_R = { nvg: 5.6, visor: 5.3, hood: 6.8, android: 5.3, wrap: 5.3, helmet: 6.0, bare: 5.3 } as const;

/** unit radial falloff per glow colour, scaled per draw (built once per colour) */
const GLOWS = new Map<string, CanvasGradient>();

function glowFill(ctx: Ctx, color: string): CanvasGradient {
  let g = GLOWS.get(color);
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, color);
    g.addColorStop(0.25, color + '88');
    g.addColorStop(1, color + '00');
    GLOWS.set(color, g);
  }
  return g;
}

/** Faint emissive bloom (NVG lens, visor slit, sensor line, LED); stronger in dark scenes. */
function glow(ctx: Ctx, L: AgentLook, strong: boolean): void {
  const e = L.glow;
  if (!e) return;
  const r = strong ? 6.5 : 3.0;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= strong ? 0.8 : 0.4;
  ctx.translate(e.x, e.y);
  ctx.scale(r, r);
  ctx.fillStyle = glowFill(ctx, e.color);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawHead(ctx: Ctx, p: Pose, L: AgentLook, strong: boolean): void {
  // neck: balaclava / collar for operatives, skin for the scientist
  const neck = L.head === 'bare' ? L.skin : L.head === 'hood' ? L.suit : L.headGear;
  seg(ctx, P.Chest, P.Neck, 3.2, 2.9, 3.1, 3.1, 0.5, neck, false);
  ctx.save();
  ctx.translate(J[P.Head], J[P.Head + 1]);
  ctx.rotate(p.spine + p.head);
  const r = RIM_R[L.head];
  const flat = flatColor();
  if (flat) {
    ctx.fillStyle = flat;
    ctx.beginPath();
    ctx.ellipse(-0.4, -0.6, r, r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  HEADS[L.head](ctx, L);
  ctx.beginPath();
  ctx.ellipse(-0.4, -0.6, r + 0.2, r * 1.05 + 0.2, 0, 0, Math.PI * 2);
  outlineStroke(ctx);
  ctx.beginPath();
  ctx.ellipse(-0.6, -0.6, r, r * 1.05, 0, Math.PI * 0.66, Math.PI * 1.3);
  rimStroke(ctx);
  // overhead key light on the crown (in world-up terms, whatever the head tilt)
  ctx.beginPath();
  const up = Math.PI * 1.5 - p.spine - p.head - p.rot;
  ctx.ellipse(-0.4, -0.6, r - 0.4, r - 0.3, 0, up - 0.85, up + 0.95);
  keyStroke(ctx, 0.8);
  glow(ctx, L, strong);
  ctx.restore();
}

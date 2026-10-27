// v7.1 limb gear for the operative rig (GDD-v7.1 §1): knee pads, a blank shoulder patch for the
// skins without a plate carrier, and the scientist's broken cuff with a swinging chain. Drawn in
// the frame of the limb segment they sit on, after that limb.
import { J, type Pose } from './rig-skeleton';
import { outlineStroke, spec, type Tone } from './rig-parts';
import type { AgentLook } from './skins';
import type { Ctx } from './util';

/** Rotate the context into the frame of segment a → b (local +x along the segment). */
function frame(ctx: Ctx, a: number, b: number): void {
  ctx.translate(J[a], J[a + 1]);
  ctx.rotate(Math.atan2(J[b + 1] - J[a + 1], J[b] - J[a]));
}

/** pad material per look: plate-carrier fabric, android knee caps, else a darker trouser tone */
function padTone(L: AgentLook): Tone {
  return L.vest ?? (L.metal ? L.headGear : L.legs);
}

/** Hard-shell knee pad on the front of the knee (shin frame: +x down the shin, −y = front). */
export function kneePad(ctx: Ctx, knee: number, ankle: number, L: AgentLook, far: boolean): void {
  if (L.id === 'prisoner') return;
  const t = padTone(L);
  ctx.save();
  frame(ctx, knee, ankle);
  // shell: taller than wide, proud of the shin front, lit along its top edge
  ctx.fillStyle = far ? t.dark : t.base;
  ctx.beginPath();
  ctx.moveTo(-1.6, -3.6);
  ctx.quadraticCurveTo(1.2, -5.2, 4.6, -3.4);
  ctx.lineTo(4.4, -1.0);
  ctx.quadraticCurveTo(1.4, -1.6, -1.4, -1.2);
  ctx.closePath();
  ctx.fill();
  outlineStroke(ctx);
  if (far) {
    ctx.restore();
    return;
  }
  ctx.fillStyle = t.light;
  ctx.fillRect(-1.0, -4.3, 3.6, 0.6);
  ctx.fillStyle = t.dark;
  ctx.fillRect(1.0, -2.6, 3.0, 0.5);
  // strap round the back of the knee
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(2.6, -1.2, 0.8, 3.4);
  if (L.metal) spec(ctx, -0.4, -4.2, 1.6, 0.4);
  ctx.restore();
}

/** Blank velcro patch on the upper arm (no lettering) for suits without a plate carrier. */
export function shoulderPatch(ctx: Ctx, sh: number, el: number, L: AgentLook): void {
  if (L.vest || L.metal || L.id === 'prisoner' || L.sash) return;
  ctx.save();
  frame(ctx, sh, el);
  ctx.fillStyle = L.suit.dark;
  ctx.fillRect(2.4, -2.6, 4.2, 2.2);
  ctx.fillStyle = L.suit.light;
  ctx.fillRect(2.7, -2.3, 3.6, 1.6);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(2.7, -1.2, 3.6, 0.3);
  ctx.restore();
}

/** The scientist's broken handcuff on the near wrist, two chain links swinging with the body. */
export function brokenCuff(ctx: Ctx, el: number, h: number, sway: number, p: Pose): void {
  ctx.save();
  frame(ctx, el, h);
  ctx.translate(Math.hypot(J[h] - J[el], J[h + 1] - J[el + 1]) - 2.2, 0);
  ctx.fillStyle = '#6E737A';
  ctx.fillRect(-0.6, -2.3, 1.4, 4.6);
  spec(ctx, -0.4, -2.1, 0.5, 1.2);
  // links hang toward world-down: undo the forearm and body rotation, then add the sway
  ctx.rotate(-Math.atan2(J[h + 1] - J[el + 1], J[h] - J[el]) - p.rot + 0.6 * sway);
  ctx.strokeStyle = '#80868D';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(0.2, 3.4, 0.7, 1.2, 0, 0, Math.PI * 2);
  ctx.moveTo(0.9, 5.6);
  ctx.ellipse(0.2, 5.6, 0.7, 1.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

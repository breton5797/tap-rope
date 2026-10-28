// Office build stand-in for src/render/boss-rigs.ts (build/office-swaps.ts): every superior is a standing
// comic figure (public-office/art/boss-<slot>.webp), so all seven slots share one "ground" photo rig at the
// back of the corridor — no rotors, searchlights or eye glow; attacks leave from the hand, steam from the head.
import type { BossAttackKind, BossId, BossView } from '../../types';
import type { View } from '../../render/view';
import { BOSS_RIGS, type BossMotion, type BossRig, type Pt } from '../../render/boss-rigs';

export * from '../../render/boss-rigs';

/** opaque-bbox aspect (w / h) of the delivered standing figures */
export const PERSON_ASPECT = 0.42;
/** drawn width as a share of the visible width (boss.ts clamps the scale to 0.7..1.7), anchor x share */
const PERSON_FRAC = 0.25;
export const PERSON_FX = 0.76;
const W = 110;
const H = Math.round(W / PERSON_ASPECT);
/** logical width the standing figure is drawn at (boss.ts scaleOf) */
export const personWidth = (visibleW: number): number => W * Math.min(1.7, Math.max(0.7, (visibleW * PERSON_FRAC) / W));
const at = (x: number, y: number): Pt => [x * W, y * H];
/** the throwing hand (the figures face left, toward the hero): fractions of the drawn box */
export const HAND_FRAC = { x: 0.2, y: 0.55 } as const;
const HAND = at(HAND_FRAC.x, HAND_FRAC.y);
const SRC: Readonly<Record<BossAttackKind, Pt>> = { beam: HAND, floor: at(0.5, 0.97), ceiling: HAND, drone: HAND, lane: HAND };

/** steps per second of the superior's backpedal (it runs backwards ahead of the hero) */
export const STEP_HZ = 2.6;
const BOB = 4;
const EXIT_TIME = 1.1;

/** set by the office renderer: realTime when the current superior's gauge ran out (−Infinity = not yet) */
export const bossExit = { at: Number.NEGATIVE_INFINITY };

/**
 * F9: the superior backpedals at stride rate (bounce + a slight sway), and once its gauge is empty the hero
 * overtakes it — it slides out to the left (its -tired frame is shown meanwhile).
 */
function personMotion(_b: BossView, v: View, t: number, out: BossMotion): void {
  const step = Math.sin(t * Math.PI * STEP_HZ);
  out.dy = -Math.abs(step) * BOB;
  out.rot = step * 0.03;
  if (!Number.isFinite(bossExit.at)) return;
  const k = Math.min(1, Math.max(0, (t - bossExit.at) / EXIT_TIME));
  out.dx = -k * k * v.w * 0.9;
}

const person: BossRig = {
  ...BOSS_RIGS.warden,
  w: W, h: H, place: 'ground', idle: 'breathe', frac: PERSON_FRAC, fx: PERSON_FX, facesRight: false,
  eye: at(0.5, 0.2), eyeR: 0, src: SRC, rotors: [], searchlight: false, damage: at(0.5, 0.03), shadow: 0.25, motion: personMotion,
};

/** the pastel figures are drawn as painted (no v8 teal grade) */
export const BOSS_PHOTO_GRADE: readonly (readonly [number, string])[] | null = null;

const SLOTS: readonly BossId[] = ['warden', 'sewer-eye', 'lab-ai', 'core', 'jailer', 'apc', 'chimera'];

/** v8 contract: rigs for the photo sprites; a slot without an entry keeps its procedural rig */
export const BOSS_PHOTO_RIGS: Readonly<Partial<Record<BossId, BossRig>>> = Object.fromEntries(SLOTS.map((id) => [id, person]));

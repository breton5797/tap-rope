// Office build stand-in for src/render/boss-rigs.ts (build/office-swaps.ts): every superior is a standing
// comic figure (public-office/art/boss-<slot>.webp), so all seven slots share one "ground" photo rig at the
// back of the corridor — no rotors, searchlights or eye glow; attacks leave from the hand, steam from the head.
import type { BossAttackKind, BossId } from '../../types';
import { BOSS_RIGS, type BossRig, type Pt } from '../../render/boss-rigs';

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

const person: BossRig = {
  ...BOSS_RIGS.warden,
  w: W, h: H, place: 'ground', idle: 'breathe', frac: PERSON_FRAC, fx: PERSON_FX, facesRight: false,
  eye: at(0.5, 0.2), eyeR: 0, src: SRC, rotors: [], searchlight: false, damage: at(0.5, 0.03), shadow: 0.25,
};

/** the pastel figures are drawn as painted (no v8 teal grade) */
export const BOSS_PHOTO_GRADE: readonly (readonly [number, string])[] | null = null;

const SLOTS: readonly BossId[] = ['warden', 'sewer-eye', 'lab-ai', 'core', 'jailer', 'apc', 'chimera'];

/** v8 contract: rigs for the photo sprites; a slot without an entry keeps its procedural rig */
export const BOSS_PHOTO_RIGS: Readonly<Partial<Record<BossId, BossRig>>> = Object.fromEntries(SLOTS.map((id) => [id, person]));

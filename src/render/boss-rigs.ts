// Boss rigs (GDD-v7 §1): where each zone boss stands, how it idles, and the anchor points (in its box
// coordinates, see boss-shapes.ts) that sensors glow at and that each attack kind leaves from. The photo
// sprites (`public/art/boss-<id>.webp`) are fitted into the same box, so the anchors serve both.
import type { BossAttackKind, BossId } from '../types';

/** ground / rear stand on the back floor edge, air hovers in the upper wall, ceiling hangs from the ceiling */
export type Place = 'ground' | 'air' | 'ceiling' | 'rear';
/** breathe = heavy servo idle, hover = drone bob + tilt, servo = slow rail sway, engine = idling vehicle */
export type Idle = 'breathe' | 'hover' | 'servo' | 'engine';
export type Pt = readonly [number, number];

export interface BossRig {
  readonly w: number;
  readonly h: number;
  readonly place: Place;
  readonly idle: Idle;
  /** drawn width as a share of the visible screen width */
  readonly frac: number;
  /** anchor x as a share of the visible screen width (from its left edge) */
  readonly fx: number;
  /** the sprite faces +x (toward the agent's back) — only the chasing APC */
  readonly facesRight: boolean;
  readonly eye: Pt;
  readonly eyeR: number;
  /** where each attack kind leaves the boss (muzzle, foot, pod, bay…) */
  readonly src: Readonly<Record<BossAttackKind, Pt>>;
  /** rotor discs: x, y, radius */
  readonly rotors: readonly (readonly [number, number, number])[];
  /** searchlight cone from the eye */
  readonly searchlight: boolean;
  /** where battle-damage smoke leaks out */
  readonly damage: Pt;
}

const NO_ROTORS: readonly (readonly [number, number, number])[] = [];

function rig(r: Omit<BossRig, 'rotors' | 'searchlight' | 'facesRight'> & Partial<Pick<BossRig, 'rotors' | 'searchlight' | 'facesRight'>>): BossRig {
  return { rotors: NO_ROTORS, searchlight: false, facesRight: false, ...r };
}

export const BOSS_RIGS: Readonly<Record<BossId, BossRig>> = {
  warden: rig({
    w: 150, h: 200, place: 'ground', idle: 'breathe', frac: 0.42, fx: 0.72, eye: [59, 37], eyeR: 6,
    src: { beam: [2, 94], floor: [66, 196], ceiling: [120, 41], drone: [120, 41], lane: [2, 94] }, damage: [92, 70],
  }),
  'sewer-eye': rig({
    w: 180, h: 110, place: 'air', idle: 'hover', frac: 0.48, fx: 0.66, eye: [38, 58], eyeR: 12, searchlight: true,
    src: { beam: [38, 58], floor: [38, 58], ceiling: [90, 32], drone: [96, 104], lane: [96, 104] }, damage: [124, 48],
    rotors: [[30, 18, 22], [150, 16, 22], [62, 6, 18], [120, 4, 18]],
  }),
  'lab-ai': rig({
    w: 230, h: 100, place: 'ceiling', idle: 'servo', frac: 0.62, fx: 0.62, eye: [115, 72], eyeR: 10,
    src: { beam: [12, 88], floor: [115, 72], ceiling: [182, 88], drone: [115, 72], lane: [115, 72] }, damage: [160, 40],
  }),
  core: rig({
    w: 120, h: 250, place: 'ground', idle: 'breathe', frac: 0.3, fx: 0.76, eye: [60, 116], eyeR: 18,
    src: { beam: [22, 70], floor: [60, 246], ceiling: [60, 16], drone: [100, 58], lane: [22, 70] }, damage: [70, 60],
  }),
  jailer: rig({
    w: 150, h: 200, place: 'ground', idle: 'breathe', frac: 0.42, fx: 0.72, eye: [80, 33], eyeR: 6,
    src: { beam: [24, 110], floor: [119, 14], ceiling: [119, 14], drone: [80, 33], lane: [24, 110] }, damage: [92, 84],
  }),
  apc: rig({
    w: 230, h: 120, place: 'rear', idle: 'engine', frac: 0.42, fx: 0.06, facesRight: true, eye: [222, 72], eyeR: 7,
    src: { beam: [220, 23], floor: [220, 23], ceiling: [118, 8], drone: [118, 8], lane: [118, 8] }, damage: [60, 40],
  }),
  chimera: rig({
    w: 230, h: 150, place: 'ground', idle: 'breathe', frac: 0.56, fx: 0.7, eye: [16, 58], eyeR: 7,
    src: { beam: [2, 70], floor: [66, 146], ceiling: [218, 14], drone: [218, 14], lane: [66, 146] }, damage: [140, 56],
  }),
  crane: rig({
    w: 230, h: 140, place: 'ceiling', idle: 'servo', frac: 0.62, fx: 0.6, eye: [185, 27], eyeR: 7,
    src: { beam: [185, 27], floor: [150, 126], ceiling: [150, 126], drone: [60, 110], lane: [60, 110] }, damage: [100, 10],
  }),
  sniper: rig({
    w: 190, h: 90, place: 'air', idle: 'hover', frac: 0.48, fx: 0.68, eye: [62, 36], eyeR: 5,
    src: { beam: [0, 46], floor: [0, 46], ceiling: [62, 36], drone: [62, 36], lane: [0, 46] }, damage: [130, 40],
    rotors: [[80, 10, 26], [160, 8, 26]],
  }),
  gunship: rig({
    w: 250, h: 110, place: 'air', idle: 'hover', frac: 0.6, fx: 0.64, eye: [50, 50], eyeR: 6, searchlight: true,
    src: { beam: [16, 86], floor: [104, 79], ceiling: [96, 18], drone: [134, 79], lane: [104, 79] }, damage: [180, 44],
    rotors: [[96, 16, 96], [236, 36, 14]],
  }),
};

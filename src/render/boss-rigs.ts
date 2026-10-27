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

// ---------- photo rigs: anchors measured on the delivered sprites (fractions of the opaque bbox) ----------

type N = readonly [number, number];

interface PhotoSpec {
  /** opaque-bbox aspect (w / h) of the sprite */
  readonly aspect: number;
  /** logical width of the box (height follows the aspect) */
  readonly w: number;
  readonly frac?: number;
  readonly fx?: number;
  readonly eye: N;
  readonly eyeR: number;
  readonly src: Readonly<Record<BossAttackKind, N>>;
  readonly damage: N;
  /** rotor discs: fractions x, y and radius as a fraction of the box width */
  readonly rotors?: readonly (readonly [number, number, number])[];
}

function photoRig(base: BossRig, p: PhotoSpec): BossRig {
  const w = p.w;
  const h = Math.round(w / p.aspect);
  const at = (n: N): Pt => [n[0] * w, n[1] * h];
  return {
    ...base,
    w,
    h,
    frac: p.frac ?? base.frac,
    fx: p.fx ?? base.fx,
    eye: at(p.eye),
    eyeR: p.eyeR,
    src: { beam: at(p.src.beam), floor: at(p.src.floor), ceiling: at(p.src.ceiling), drone: at(p.src.drone), lane: at(p.src.lane) },
    damage: at(p.damage),
    rotors: (p.rotors ?? []).map(([x, y, r]) => [x * w, y * h, r * w] as const),
  };
}

/** rigs for the photo sprites (public/art/boss-<id>.webp); a boss without an entry keeps its procedural rig */
export const BOSS_PHOTO_RIGS: Readonly<Partial<Record<BossId, BossRig>>> = {
  // shoulder cannon aimed up-left, red visor, chest lens; feet planted wide
  warden: photoRig(BOSS_RIGS.warden, {
    aspect: 0.96, w: 180, frac: 0.52, eye: [0.56, 0.08], eyeR: 5,
    src: { beam: [0.02, 0.05], floor: [0.27, 0.97], ceiling: [0.82, 0.12], drone: [0.82, 0.12], lane: [0.02, 0.05] },
    damage: [0.45, 0.35],
  }),
  // riot shield on the left, red visor, stun baton angled down-right
  jailer: photoRig(BOSS_RIGS.jailer, {
    aspect: 0.76, w: 150, frac: 0.46, eye: [0.46, 0.045], eyeR: 5,
    src: { beam: [0.11, 0.36], floor: [0.98, 0.67], ceiling: [0.98, 0.67], drone: [0.46, 0.045], lane: [0.11, 0.36] },
    damage: [0.55, 0.3],
  }),
  // server rack: red core window, LED matrix above, cable loom below
  core: photoRig(BOSS_RIGS.core, {
    aspect: 0.38, w: 100, frac: 0.26, eye: [0.32, 0.43], eyeR: 12,
    src: { beam: [0.32, 0.43], floor: [0.5, 0.98], ceiling: [0.5, 0.01], drone: [0.75, 0.25], lane: [0.32, 0.43] },
    damage: [0.7, 0.35],
  }),
  // quadruped walker: long gun with a red muzzle at the top-left, red sensor block on the turret
  chimera: photoRig(BOSS_RIGS.chimera, {
    aspect: 1.07, w: 210, frac: 0.54, eye: [0.5, 0.1], eyeR: 6,
    src: { beam: [0.01, 0.05], floor: [0.46, 0.97], ceiling: [0.85, 0.12], drone: [0.85, 0.12], lane: [0.16, 0.95] },
    damage: [0.62, 0.25],
  }),
  // wheeled APC facing right: long autocannon, headlights at the front-right, turret hatch
  apc: photoRig(BOSS_RIGS.apc, {
    aspect: 1.73, w: 230, frac: 0.44, fx: 0.1, eye: [0.67, 0.49], eyeR: 5,
    src: { beam: [0.97, 0.03], floor: [0.97, 0.03], ceiling: [0.38, 0.06], drone: [0.38, 0.06], lane: [0.38, 0.06] },
    damage: [0.2, 0.3],
  }),
  // overhead gantry with a trolley, hook and a hanging press platform
  crane: photoRig(BOSS_RIGS.crane, {
    aspect: 1.55, w: 230, frac: 0.66, eye: [0.52, 0.14], eyeR: 5,
    src: { beam: [0.52, 0.14], floor: [0.47, 0.98], ceiling: [0.47, 0.98], drone: [0.47, 0.76], lane: [0.47, 0.76] },
    damage: [0.45, 0.25],
  }),
  // attack helicopter facing left: chin gun, cockpit, stub-wing rocket pods; the photo has rotor blades
  gunship: photoRig(BOSS_RIGS.gunship, {
    aspect: 2.55, w: 250, eye: [0.13, 0.64], eyeR: 5,
    src: { beam: [0.05, 0.66], floor: [0.53, 0.74], ceiling: [0.47, 0.1], drone: [0.63, 0.74], lane: [0.53, 0.74] },
    damage: [0.53, 0.38], rotors: [[0.47, 0.1, 0.42], [0.86, 0.27, 0.05]],
  }),
  // armored quadcopter facing left: big searchlight lamp at the front-left, four rotors, landing struts
  'sewer-eye': photoRig(BOSS_RIGS['sewer-eye'], {
    aspect: 2.9, w: 210, eye: [0.3, 0.46], eyeR: 9,
    src: { beam: [0.3, 0.46], floor: [0.3, 0.46], ceiling: [0.5, 0.09], drone: [0.54, 0.56], lane: [0.54, 0.56] },
    damage: [0.58, 0.38], rotors: [[0.22, 0.09, 0.2], [0.65, 0.04, 0.26], [0.84, 0.09, 0.15]],
  }),
  // quadcopter facing left: scoped rifle with the muzzle at the far left, red sensor dot on the hull
  sniper: photoRig(BOSS_RIGS.sniper, {
    aspect: 3.3, w: 220, eye: [0.465, 0.32], eyeR: 4,
    src: { beam: [0.15, 0.51], floor: [0.15, 0.51], ceiling: [0.465, 0.32], drone: [0.465, 0.32], lane: [0.15, 0.51] },
    damage: [0.59, 0.49], rotors: [[0.21, 0.16, 0.2], [0.67, 0.07, 0.22], [0.81, 0.15, 0.19], [0.43, 0.23, 0.09]],
  }),
  // a cluster of security cameras around a hub, hung from the ceiling
  'lab-ai': photoRig(BOSS_RIGS['lab-ai'], {
    aspect: 2.36, w: 230, frac: 0.56, eye: [0.48, 0.9], eyeR: 9,
    src: { beam: [0.04, 0.37], floor: [0.48, 0.92], ceiling: [0.6, 0.13], drone: [0.91, 0.27], lane: [0.28, 0.18] },
    damage: [0.62, 0.5],
  }),
};

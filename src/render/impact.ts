// v7.1 impact tuning (GDD-v7.1 §3): pure numbers per impact kind / level so the look can be tested
// without a canvas. Effects.impact() reads a plan and spawns the particles, rings, streaks and glints.
import type { ImpactKind, ImpactOpts } from '../types';
import { clamp } from './util';

/** ring styles: a flat ellipse on the floor, a round ring, or a hexagon (shield) */
export const RingShape = { Ground: 0, Round: 1, Hex: 2 } as const;
export type RingShapeId = (typeof RingShape)[keyof typeof RingShape];

export interface ImpactPlan {
  /** main ring radius in px (0 = no ring) */
  readonly ring: number;
  readonly ringShape: RingShapeId;
  /** ring stroke width at birth */
  readonly ringWidth: number;
  /** seconds the ring lives */
  readonly ringLife: number;
  /** a second ring this many seconds later (0 = none) */
  readonly echo: number;
  /** soft dust puffs */
  readonly dust: number;
  /** hot sparks (thick additive streaks) */
  readonly sparks: number;
  /** spark speed range in px/s */
  readonly speed: number;
  /** tumbling debris chunks */
  readonly debris: number;
  /** hexagon shards */
  readonly shards: number;
  /** air streaks (speed lines) */
  readonly streaks: number;
  /** white glint size in px (0 = none) */
  readonly glint: number;
  /** extra screen shake 0..1 (0 = none) */
  readonly shake: number;
}

const NONE: ImpactPlan = {
  ring: 0, ringShape: RingShape.Round, ringWidth: 0, ringLife: 0, echo: 0,
  dust: 0, sparks: 0, speed: 0, debris: 0, shards: 0, streaks: 0, glint: 0, shake: 0,
};

/** jump level clamped to 1..3 */
function lvl(opts: ImpactOpts): number {
  return clamp(Math.round(opts.level ?? 1), 1, 3);
}

/** The full-strength plan for one impact (reduced motion is applied by `scalePlan`). */
export function planImpact(kind: ImpactKind, opts: ImpactOpts = {}): ImpactPlan {
  const l = lvl(opts);
  switch (kind) {
    case 'jump':
      return { ...NONE, ring: 26, ringShape: RingShape.Ground, ringWidth: 2.5, ringLife: 0.32, dust: 8, sparks: 0, speed: 120 };
    case 'boost':
      return { ...NONE, ring: 22 + l * 10, ringShape: RingShape.Ground, ringWidth: 2 + l, ringLife: 0.34, sparks: 6 + l * 5, speed: 160 + l * 60, glint: l === 3 ? 26 : 0 };
    case 'land':
      return {
        ...NONE, ring: 20 + l * 16, ringShape: RingShape.Ground, ringWidth: 1.5 + l * 1.5, ringLife: 0.3 + l * 0.06,
        echo: l >= 2 ? 0.07 : 0, dust: 4 + l * 5, speed: 90 + l * 50, sparks: l === 3 ? 6 : 0, shake: l === 3 ? 0.22 : 0,
      };
    case 'slide':
      return { ...NONE, dust: 6, sparks: 8, speed: 260 };
    case 'lane':
      return { ...NONE, streaks: 9, dust: 2, speed: 90 };
    case 'bump':
      return { ...NONE, ring: 12, ringShape: RingShape.Round, ringWidth: 1.5, ringLife: 0.22, sparks: 6, dust: 3, speed: 150 };
    case 'pass':
      return { ...NONE, sparks: 5, speed: 140 };
    case 'graze':
      return { ...NONE, sparks: 12 + l * 2, speed: 220 + l * 30, glint: 30 + l * 4, ring: 14, ringShape: RingShape.Round, ringWidth: 2, ringLife: 0.2 };
    case 'hit':
      return { ...NONE, debris: 10, sparks: 14, speed: 300, ring: 46, ringShape: RingShape.Round, ringWidth: 4, ringLife: 0.3 };
    case 'shield':
      return { ...NONE, shards: 12, speed: 170, ring: 42, ringShape: RingShape.Hex, ringWidth: 3, ringLife: 0.4, echo: 0.08, glint: 22 };
  }
}

/** Reduced motion: fewer particles, no streaks and no extra shake; rings and glints stay (dimmed by the caller). */
export function scalePlan(p: ImpactPlan, reduced: boolean): ImpactPlan {
  if (!reduced) return p;
  const k = (n: number): number => Math.round(n * 0.5);
  return { ...p, dust: k(p.dust), sparks: k(p.sparks), debris: k(p.debris), shards: k(p.shards), streaks: 0, shake: 0 };
}

/**
 * Where a pass / graze impact happens relative to the feet (x right, y down, px): under the feet for a
 * low beam, over the head for an overhead one, beside the body for a lane hazard.
 */
export function zoneOffset(zone: ImpactOpts['zone'], bodyLift: number): readonly [number, number] {
  switch (zone) {
    case 'high': return [4, -bodyLift * 2 - 14];
    case 'side': return [18, -bodyLift];
    default: return [2, 4];
  }
}

/** Mean spray direction (radians, screen space) for a graze: off the floor, off the ceiling, or back along the lane. */
export function sprayAngle(zone: ImpactOpts['zone']): number {
  switch (zone) {
    case 'high': return -Math.PI * 0.8; // up and back
    case 'side': return Math.PI; // straight back
    default: return -Math.PI * 0.82; // off the floor, back and up
  }
}

/** Slide friction emission rate (particles / s) and whether the slide is still on. */
export const SLIDE_FX = { time: 0.5, sparksPerSec: 46, dustPerSec: 14 } as const;

/** true while the last slide cue is fresh and no jump / hit cut it short */
export function slideActive(slideAge: number, jumpAge: number, boostAge: number, hitAge: number): boolean {
  return slideAge < SLIDE_FX.time && slideAge <= jumpAge && slideAge <= boostAge && slideAge <= hitAge;
}

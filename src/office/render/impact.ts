// Office build stand-in for src/render/impact.ts (build/office-swaps.ts), v2 F11: a slide must not read as a
// hit, so the slide start and the slide stream spawn no sparks or dust puffs here — the office hero painter
// draws speed streaks behind the sliding hero instead. Pass / graze glints stay small (no white flash over
// the hero). Every other impact is the v8 one.
import type { ImpactKind, ImpactOpts } from '../../types';
import { planImpact as v8PlanImpact, type ImpactPlan } from '../../render/impact';

export * from '../../render/impact';

/** white glints / rings stay small, so a PERFECT pass never flashes over the hero (art review) */
const MAX_GLINT = 12;
const MAX_RING = 26;

export function planImpact(kind: ImpactKind, opts: ImpactOpts = {}): ImpactPlan {
  const p = v8PlanImpact(kind, opts);
  if (kind === 'slide') return { ...p, sparks: 0, dust: 0 };
  if (kind === 'pass' || kind === 'graze') return { ...p, glint: Math.min(p.glint, MAX_GLINT), ring: Math.min(p.ring, MAX_RING) };
  return p;
}

/** v8 contract: the continuous slide stream — no sparks / dust in the office build */
export const SLIDE_FX = { time: 0.5, sparksPerSec: 0, dustPerSec: 0 } as const;

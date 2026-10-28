// Office build stand-in for src/render/impact.ts (build/office-swaps.ts), v2 F11: a slide must not read as a
// hit, so the slide start and the slide stream spawn no sparks or dust puffs here — the office hero painter
// draws speed streaks behind the sliding hero instead. Every other impact is the v8 one.
import type { ImpactKind, ImpactOpts } from '../../types';
import { planImpact as v8PlanImpact, type ImpactPlan } from '../../render/impact';

export * from '../../render/impact';

export function planImpact(kind: ImpactKind, opts: ImpactOpts = {}): ImpactPlan {
  const p = v8PlanImpact(kind, opts);
  return kind === 'slide' ? { ...p, sparks: 0, dust: 0 } : p;
}

/** v8 contract: the continuous slide stream — no sparks / dust in the office build */
export const SLIDE_FX = { time: 0.5, sparksPerSec: 0, dustPerSec: 0 } as const;

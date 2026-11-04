// Spec §4 balance targets (office part-2), checked on measured cells. Shared by the always-on tests (small seed sets,
// noise slack) and the 200-seed report (BALANCE_ASSERT=1, no slack). Estimates from bots, not human data.
import type { Cell } from './balance.harness';
import type { ProfileId } from '../../src/game/bot-profiles';

export interface Slack {
  /** pp a stage may sit above the one before (sampling noise) */
  readonly rise: number;
  /** pp added to the 12 pp step limit */
  readonly step: number;
  /** pp the last stage may sit outside 40–50% */
  readonly last: number;
}

export const NO_SLACK: Slack = { rise: 0, step: 0, last: 0 };

/** the normal-profile character spread (max − min ≤ 10 pp) is a hard gate on every stage (lead 2026-11-03, after the
 * user-approved cat hearts 2 → 3; it was stages 1–5 only while cat had 2 hearts) */
export const SPREAD_GATE_STAGES = 10;
export const SPREAD_GATE_PP = 10;

/** per stage (1-based order): mean clear and max−min spread over the characters, in pp */
export function curve(cells: readonly Cell[], profile: ProfileId): { readonly clear: number[]; readonly spread: number[] } {
  const mine = cells.filter((c) => c.profile === profile);
  const stages = [...new Set(mine.map((c) => c.stage))].sort((a, b) => a - b);
  const rows = stages.map((n) => mine.filter((c) => c.stage === n).map((c) => c.clear * 100));
  return {
    clear: rows.map((r) => r.reduce((a, x) => a + x, 0) / r.length),
    spread: rows.map((r) => Math.max(...r) - Math.min(...r)),
  };
}

/** human-readable failures of the casual curve (empty = all met) */
export function casualFailures(clear: readonly number[], slack: Slack): string[] {
  const out: string[] = [];
  if (clear[0] < 95) out.push(`stage 1 ${clear[0].toFixed(1)}% < 95%`);
  clear.slice(1).forEach((c, i) => {
    const prev = clear[i];
    if (c > prev + slack.rise) out.push(`stage ${i + 2} ${c.toFixed(1)}% rises above stage ${i + 1} ${prev.toFixed(1)}%`);
    if (prev - c > 12 + slack.step) out.push(`stage ${i + 2} drops ${(prev - c).toFixed(1)} pp (> 12)`);
  });
  const last = clear[clear.length - 1];
  if (last < 40 - slack.last || last > 50 + slack.last) out.push(`last stage ${last.toFixed(1)}% outside 40–50%`);
  return out;
}

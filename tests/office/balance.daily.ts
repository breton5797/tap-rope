// Daily-mission balance (live-events spec §1; docs/balance/live-economy.md): the skill-profiled bots play
// dailyPlan(date, tier) — the same stage every player at that (date, tier) gets — on consecutive dates with all four
// hires. Bot estimates, not human data. Office module graph (vitest project 'office').
import type { SkinId } from '../../src/types';
import { createSession } from '../../src/game/session';
import { createSkilledBot, PROFILES, type ProfileId } from '../../src/game/bot-profiles';
import { addDays, dailyPlan, type DateKey, type ProgressTier } from '../../src/office/core/live';
import { collectCoins, playRun, SKINS } from './balance.harness';

/** lead decision 2026-11-16: door heal kept; a friendly routine — casual 85–92 % on average, no tier outside 85–95 %,
 * expert ≥ 98 %, 50–60 s (a mean up to 62 s is tolerated where the tier needs the hazards) */
export const DAILY_TARGET = {
  casualMeanMin: 85, casualMeanMax: 92, casualTierMin: 85, casualTierMax: 95, expertMin: 98, lengthMin: 50, lengthMax: 62,
} as const;

export const dailyDates = (n: number, from: DateKey = '2026-11-16'): DateKey[] => Array.from({ length: n }, (_, i) => addDays(from, i));

export interface DailyCell {
  readonly tier: ProgressTier;
  readonly clear: number; // %
  readonly bySkin: Readonly<Record<SkinId, number>>; // %
  readonly length: number; // mean seconds, start → clear
  readonly stamps: number;
}

/** `botSeeds` bot runs per (date, hire); the bot seed stream is separate from the layout's */
export function measureDaily(profile: ProfileId, tier: ProgressTier, dates: readonly DateKey[], botSeeds = 1): DailyCell {
  let cleared = 0;
  let runs = 0;
  let length = 0;
  let stamps = 0;
  const by: Record<string, number> = {};
  for (const date of dates) {
    const stage = dailyPlan(date, tier).stage;
    const s0 = createSession('stage', stage, { skin: 'kid' });
    length += s0.beats[s0.beats.length - 1].time + 0.7;
    for (const skin of SKINS) {
      for (let b = 0; b < botSeeds; b += 1) {
        const bot = createSkilledBot(PROFILES[profile], ((stage.seed ^ 0x9e3779b9) + b * 7919) >>> 0, { seekCoin: collectCoins(stage.id) });
        const r = playRun(stage, skin, stage.seed, bot);
        runs += 1;
        cleared += r.cleared ? 1 : 0;
        stamps += r.stamps;
        by[skin] = (by[skin] ?? 0) + (r.cleared ? 1 : 0);
      }
    }
  }
  const per = dates.length * botSeeds;
  return {
    tier, clear: (cleared / runs) * 100, length: length / dates.length, stamps: stamps / runs,
    bySkin: Object.fromEntries(SKINS.map((k) => [k, ((by[k] ?? 0) / per) * 100])) as Record<SkinId, number>,
  };
}

/** human-readable failures (empty = all met) */
export function dailyFailures(casual: readonly DailyCell[], expert: readonly DailyCell[], slack = 0): string[] {
  const t = DAILY_TARGET;
  const out: string[] = [];
  for (const c of casual) {
    if (c.clear < t.casualTierMin - slack || c.clear > t.casualTierMax + slack) out.push(`casual tier ${c.tier} ${c.clear.toFixed(1)}% outside ${t.casualTierMin}–${t.casualTierMax}%`);
    if (c.length < t.lengthMin || c.length > t.lengthMax) out.push(`tier ${c.tier} ${c.length.toFixed(1)} s outside ${t.lengthMin}–${t.lengthMax} s`);
  }
  const mean = casual.reduce((a, c) => a + c.clear, 0) / Math.max(1, casual.length);
  if (casual.length > 0 && (mean < t.casualMeanMin - slack || mean > t.casualMeanMax + slack)) out.push(`casual mean ${mean.toFixed(1)}% outside ${t.casualMeanMin}–${t.casualMeanMax}%`);
  for (const e of expert) if (e.clear < t.expertMin - slack) out.push(`expert tier ${e.tier} ${e.clear.toFixed(1)}% < ${t.expertMin}%`);
  return out;
}

export const formatDaily = (cells: readonly DailyCell[], label: string): string =>
  [`### ${label}`, '', `| tier | ${SKINS.join(' | ')} | all | length (s) | stamps |`, `|---|${SKINS.map(() => '---').join('|')}|---|---|---|`,
    ...cells.map((c) => `| ${c.tier} | ${SKINS.map((k) => c.bySkin[k].toFixed(1)).join(' | ')} | ${c.clear.toFixed(1)}% | ${c.length.toFixed(1)} | ${c.stamps.toFixed(2)} |`)].join('\n');

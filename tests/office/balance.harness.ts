// Balance harness (office part-2 spec §4): plays (stage × character × seed) headlessly with a skill-profiled bot
// and aggregates clear %, hits and mission stamps. Must run in the office module graph (vitest project 'office'),
// where src/core/content and src/game/missions resolve to the office versions — the same way bot.test.ts runs.
import type { Beat, SkinId, StageDef } from '../../src/types';
import { STAGES } from '../../src/core/content';
import { createSession, lane, step, swipe, tap, type Session } from '../../src/game/session';
import { createSkilledBot, PROFILES, type BotFn, type ProfileId } from '../../src/game/bot-profiles';
import { commitMissions, startMissions, trackMissions, type MissionRun } from '../../src/office/game/missions';
import { STAGE_MISSIONS } from '../../src/office/core/missions';

export const SKINS: readonly SkinId[] = ['kid', 'cat', 'bunny', 'robot'];
const DT = 1 / 60;
const MAX_STEPS = 60 * 300;

/** spread uint32 run seeds (the office draws a fresh crypto seed per run); offset keeps report and test sets apart */
export const runSeeds = (n: number, offset = 0): number[] =>
  Array.from({ length: n }, (_, i) => Math.imul(i + 1 + offset, 2654435761) >>> 0);

/** the player goes for the coins of a collect mission (the mission card tells them to) */
export const collectCoins = (stageId: string) => (b: Beat): boolean =>
  STAGE_MISSIONS[stageId]?.[b.part ?? b.section]?.kind === 'collect';

export interface RunResult {
  readonly cleared: boolean;
  readonly hits: number;
  readonly stamps: number;
}

export function playRun(stage: StageDef, skin: SkinId, seed: number, bot: BotFn): RunResult {
  let s: Session = createSession('stage', { ...stage, seed }, { skin });
  let run: MissionRun | null = startMissions(s.stage, s.beats);
  for (let i = 0; i < MAX_STEPS && s.status === 'playing'; i += 1) {
    const a = bot(s);
    if (a?.lane) s = lane(s, a.lane).session;
    else if (a) {
      s = tap(s).session;
      if (a.swipe) s = swipe(s, a.swipe).session;
    }
    const out = step(s, DT);
    s = out.session;
    run = trackMissions(run, s, out.events);
  }
  const cleared = s.status === 'cleared';
  const outcome = commitMissions(run, cleared, false);
  const stamps = outcome ? outcome.stamps.filter((v) => v === true).length : 0;
  return { cleared, hits: s.hitsTaken, stamps };
}

export interface Cell {
  readonly profile: ProfileId;
  readonly stage: number; // 1-based
  readonly skin: SkinId;
  readonly runs: number;
  readonly clear: number; // 0..1
  readonly hits: number; // mean
  readonly stamps: number; // mean
}

export function measureCell(profile: ProfileId, stageIndex: number, skin: SkinId, seeds: readonly number[]): Cell {
  const stage = STAGES[stageIndex];
  // the bot's own randomness uses a different seed stream than the layout
  const results = seeds.map((seed) => playRun(stage, skin, seed, createSkilledBot(PROFILES[profile], seed ^ 0x9e3779b9, { seekCoin: collectCoins(stage.id) })));
  const mean = (f: (r: RunResult) => number): number => results.reduce((a, r) => a + f(r), 0) / results.length;
  return {
    profile, stage: stageIndex + 1, skin, runs: results.length,
    clear: mean((r) => (r.cleared ? 1 : 0)), hits: mean((r) => r.hits), stamps: mean((r) => r.stamps),
  };
}

export function stageCount(): number {
  return STAGES.length;
}

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

/** markdown tables: one per profile, rows = stages, clear % per character + all, mean hits / stamps (all chars) */
export function formatReport(cells: readonly Cell[]): string {
  const profiles = [...new Set(cells.map((c) => c.profile))];
  return profiles.map((p) => {
    const mine = cells.filter((c) => c.profile === p);
    const stages = [...new Set(mine.map((c) => c.stage))].sort((a, b) => a - b);
    const head = `| stage | ${SKINS.join(' | ')} | all | spread (pp) | mean hits | mean stamps |`;
    const sep = `|---|${SKINS.map(() => '---').join('|')}|---|---|---|---|`;
    const rows = stages.map((n) => {
      const row = mine.filter((c) => c.stage === n);
      const by = SKINS.map((k) => row.find((c) => c.skin === k));
      const all = row.reduce((a, c) => a + c.clear * c.runs, 0) / row.reduce((a, c) => a + c.runs, 0);
      const clears = by.flatMap((c) => (c ? [c.clear] : []));
      const spread = (Math.max(...clears) - Math.min(...clears)) * 100;
      const w = (f: (c: Cell) => number): string => (row.reduce((a, c) => a + f(c) * c.runs, 0) / row.reduce((a, c) => a + c.runs, 0)).toFixed(2);
      return `| ${n} | ${by.map((c) => (c ? pct(c.clear) : '-')).join(' | ')} | ${pct(all)} | ${spread.toFixed(1)} | ${w((c) => c.hits)} | ${w((c) => c.stamps)} |`;
    });
    return [`### ${PROFILES[p].label} (${p})`, '', head, sep, ...rows].join('\n');
  }).join('\n\n');
}

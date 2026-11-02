// Clear-rate report (office part-2 spec §4): every profile × stage × character × seed, printed as markdown.
// Off by default (normal `npm test` stays fast):
//   BALANCE_REPORT=1 npx vitest run --project office tests/office/balance.report.test.ts
// BALANCE_SEEDS=n (default 200), BALANCE_PROFILES=casual,normal (default all), BALANCE_OUT=path (also writes the
// tables to that file), BALANCE_ASSERT=1 (fail unless the spec §4 targets hold with no slack: casual curve, expert ≥ 90%,
// normal character spread ≤ 10 pp). Runs in the office module graph, like bot.test.ts.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROFILE_IDS, type ProfileId } from '../../src/game/bot-profiles';
import { formatReport, measureCell, runSeeds, SKINS, stageCount, type Cell } from './balance.harness';
import { casualFailures, curve, NO_SLACK } from './balance.targets';

const env = process.env;
const enabled = env.BALANCE_REPORT === '1';
const seedCount = Math.max(1, Number.parseInt(env.BALANCE_SEEDS ?? '200', 10) || 200);
const profiles = (env.BALANCE_PROFILES?.split(',').map((p) => p.trim()) ?? PROFILE_IDS).filter((p): p is ProfileId =>
  (PROFILE_IDS as readonly string[]).includes(p));

describe.runIf(enabled)('balance report', () => {
  it('measures clear rates', () => {
    const seeds = runSeeds(seedCount);
    const t0 = performance.now();
    const cells: Cell[] = profiles.flatMap((p) =>
      Array.from({ length: stageCount() }, (_, i) => i).flatMap((i) => SKINS.map((skin) => measureCell(p, i, skin, seeds))));
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const report = `${formatReport(cells)}\n\n_${cells.reduce((a, c) => a + c.runs, 0)} runs, ${seedCount} seeds per cell, ${secs} s_\n`;
    process.stdout.write(`\n${report}\n`);
    if (env.BALANCE_OUT) writeFileSync(env.BALANCE_OUT, report);
    expect(cells.length).toBe(profiles.length * stageCount() * SKINS.length);
    if (env.BALANCE_ASSERT === '1') {
      const fails = [
        ...(profiles.includes('casual') ? casualFailures(curve(cells, 'casual').clear, NO_SLACK) : []),
        ...(profiles.includes('expert') ? curve(cells, 'expert').clear.flatMap((c, i) => (c < 90 ? [`expert stage ${i + 1} ${c.toFixed(1)}%`] : [])) : []),
        ...(profiles.includes('normal') ? curve(cells, 'normal').spread.flatMap((s, i) => (s > 10 ? [`normal spread stage ${i + 1} ${s.toFixed(1)} pp`] : [])) : []),
      ];
      expect(fails).toEqual([]);
    }
  }, 30 * 60 * 1000);
});

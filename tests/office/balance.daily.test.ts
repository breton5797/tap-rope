// Daily mission (live events) balance gate. Always on: a coarse guard on a few dates (one layout per date, so wide
// slack). Strict, 60 dates × 4 hires × 2 bot seeds × 10 tiers:
//   BALANCE_REPORT=1 BALANCE_ASSERT=1 npx vitest run --project office tests/office/balance.daily.test.ts
// Bot estimates, not human data (docs/balance/live-economy.md).
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ProgressTier } from '../../src/office/core/live';
import { dailyDates, dailyFailures, formatDaily, measureDaily } from './balance.daily';

const env = process.env;
const TIERS = Array.from({ length: 10 }, (_, i) => (i + 1) as ProgressTier);

describe('daily mission balance (small sample)', () => {
  it('tiers 1 / 5 / 10 on 8 dates: casual in a wide band, expert near perfect, 50–62 s', () => {
    const dates = dailyDates(8, '2027-01-04');
    const tiers = [1, 5, 10] as ProgressTier[];
    const casual = tiers.map((t) => measureDaily('casual', t, dates));
    const expert = tiers.map((t) => measureDaily('expert', t, dates));
    expect(dailyFailures(casual, expert, 12)).toEqual([]);
  }, 120_000);
});

describe.runIf(env.BALANCE_REPORT === '1')('daily mission balance report', () => {
  it('measures every tier on 60 dates', () => {
    const dates = dailyDates(60);
    const t0 = performance.now();
    const casual = TIERS.map((t) => measureDaily('casual', t, dates, 2));
    const expert = TIERS.map((t) => measureDaily('expert', t, dates, 2));
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const report = `${formatDaily(casual, '오늘의 미션 · 캐주얼 (casual)')}\n\n${formatDaily(expert, '오늘의 미션 · 숙련 (expert)')}\n\n_${dates.length} dates × 4 hires × 2 bot seeds per tier, ${secs} s_\n`;
    process.stdout.write(`\n${report}\n`);
    if (env.BALANCE_OUT) writeFileSync(env.BALANCE_OUT, report);
    if (env.BALANCE_ASSERT === '1') expect(dailyFailures(casual, expert)).toEqual([]);
  }, 30 * 60 * 1000);
});

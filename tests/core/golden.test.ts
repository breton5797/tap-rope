// v8 guard (GDD-v8): the daily and endless layouts and the replay scores are what the server
// re-simulates. Campaign-only changes must leave these hashes untouched; a deliberate rule
// change updates them together with a SIM_VERSION bump and a server redeploy.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { dailyStage, endlessStage, generateStage } from '../../src/core/levels';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import { simulateRun, SIM_VERSION } from '../../src/game/replay';

const digest = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const DATES = ['2026-01-01', '2026-02-28', '2026-07-04', '2026-10-28', '2026-12-31', '2027-03-15'];
const SEEDS = [1, 12345, 987654321];

function dailyLayouts(): unknown {
  return DATES.map((d) => {
    const s = dailyStage(d);
    return { s, g: generateStage(s, DEFAULT_PHYSICS) };
  });
}

function endlessLayouts(): unknown {
  return SEEDS.map((seed) => Array.from({ length: 26 }, (_, chunk) => {
    const s = endlessStage(chunk, seed);
    return { s, g: generateStage(s, DEFAULT_PHYSICS) };
  }));
}

/** fixed input scripts (a tap every 0.37 s with lane wiggles / slides) — scores exercise judging and scoring */
function scripted(mode: 'daily' | 'endless', seed: number, date: string) {
  const inputs: [number, 'T' | 'D' | 'S' | 'U' | 'N'][] = [];
  const codes = ['T', 'T', 'S', 'T', 'U', 'T', 'N', 'D'] as const;
  for (let i = 0, t = 1.9; t < 90; i++, t += 0.37) inputs.push([Math.round(t * 1000) / 1000, codes[i % codes.length]]);
  return { sim: SIM_VERSION, mode, seed, date, inputs, endTime: 90, clientScore: 0 };
}

describe('golden: server-simulated content', () => {
  it('daily layouts are unchanged', () => {
    expect(digest(dailyLayouts())).toBe('d5d151f98d836daa');
  });

  it('endless layouts are unchanged', () => {
    expect(digest(endlessLayouts())).toBe('69d230b6b0b0e393');
  });

  it('replay scores are unchanged (rule changes must update this with a SIM_VERSION bump)', () => {
    const runs = [scripted('daily', 0, '2026-10-28'), scripted('endless', 7, '2026-10-28'), scripted('endless', 2024, '2026-10-28')];
    const out = runs.map((r) => simulateRun(r));
    expect(out.every((o) => o.score > 0)).toBe(true); // the scripts must exercise judging, not die at once
    expect({ sim: SIM_VERSION, digest: digest(out) }).toEqual({ sim: 'le-v7.1', digest: 'c76ef4841af43f0e' });
  });
});

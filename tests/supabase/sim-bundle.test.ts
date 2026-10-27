import { describe, expect, it } from 'vitest';
import type { RunInput, RunRecord } from '../../src/types';
import { createSession, lane, step, swipe, tap } from '../../src/game/session';
import { botAction } from '../../src/game/bot';
import { SIM_VERSION, simulateRun } from '../../src/game/replay';
import * as bundle from '../../supabase/functions/submit-run/sim.js';

/** A bot-played endless run at 60fps, recorded like the app does. */
function botRecord(seed: number, seconds: number): RunRecord {
  let s = createSession('endless', null, { seed });
  const inputs: RunInput[] = [];
  for (let f = 0; f < seconds * 60 && s.status === 'playing'; f++) {
    const a = botAction(s);
    if (a?.lane) {
      inputs.push([s.time, a.lane < 0 ? 'U' : 'N']);
      s = lane(s, a.lane).session;
    } else if (a) {
      inputs.push([s.time, 'T']);
      s = tap(s).session;
      if (a.swipe === 'down') {
        inputs.push([s.time, 'D']);
        s = swipe(s, 'down').session;
      }
    }
    s = step(s, 1 / 60).session;
  }
  return { sim: SIM_VERSION, mode: 'endless', seed, date: '2026-10-27', inputs, endTime: s.time, clientScore: s.score.score };
}

describe('submit-run sim bundle', () => {
  it('is rebuilt for the current SIM_VERSION (run: npx vite build --config vite.sim.config.ts)', () => {
    expect(bundle.SIM_VERSION).toBe(SIM_VERSION);
  });

  it('scores a recorded run exactly like the game code', () => {
    const record = botRecord(1234, 40);
    const fromBundle = bundle.simulateRun(record);
    expect(fromBundle).toEqual(simulateRun(record));
    expect(fromBundle.score).toBe(record.clientScore);
  });
});

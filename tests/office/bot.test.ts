// Office clearability (office spec §12, §13.2): every office stage is cleared by the reference bot on 50 run
// seeds — the office build draws a fresh seed per run, so every layout the generator can make must be fair.
// Office module graph: sessions use the office content, as the office build resolves it.
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { botAction } from '../../src/game/bot';
import { createSession, lane, step, swipe, tap, type Session } from '../../src/game/session';

const SEEDS = 50;
const DT = 1 / 60;
/** generous cap: the longest office stage runs well under two minutes */
const MAX_STEPS = 60 * 300;

/** 50 spread uint32 run seeds (the office draws them with crypto at run start) */
const seeds = Array.from({ length: SEEDS }, (_, i) => (Math.imul(i + 1, 2654435761) >>> 0));

function play(s0: Session): Session {
  let s = s0;
  for (let i = 0; i < MAX_STEPS && s.status === 'playing'; i += 1) {
    const a = botAction(s);
    if (a?.lane) s = lane(s, a.lane).session;
    else if (a) {
      s = tap(s).session;
      if (a.swipe) s = swipe(s, a.swipe).session;
    }
    s = step(s, DT).session;
  }
  return s;
}

describe('office stages are clearable on every run seed', () => {
  it.each(STAGES.map((s) => [s.id, s] as const))('%s: the bot clears 50 seeds', (_id, stage) => {
    const failed = seeds.filter((seed) => play(createSession('stage', { ...stage, seed })).status !== 'cleared');
    expect(failed).toEqual([]);
  });
});

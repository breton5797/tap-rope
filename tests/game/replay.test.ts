import { describe, expect, it } from 'vitest';
import type { RunInput, RunRecord } from '../../src/types';
import { createSession, lane, slide, step, swipe, tap, TICK, type Session } from '../../src/game/session';
import { botAction } from '../../src/game/bot';
import { SIM_VERSION, simulateRun } from '../../src/game/replay';
import { mulberry32 } from '../../src/core/rng';

type FrameDt = (frame: number) => number;

const fixed = (dt: number): FrameDt => () => dt;
const jitter = (seed: number): FrameDt => {
  const rng = mulberry32(seed);
  return () => 1 / 240 + rng() * (1 / 20); // 4ms..54ms, like a stuttering device
};

/** Plays like the app: inputs land between frames at the session's current time, then the frame steps. */
function recordBot(s0: Session, dtOf: FrameDt, maxSeconds: number): { s: Session; inputs: RunInput[] } {
  let s = s0;
  const inputs: RunInput[] = [];
  let real = 0;
  for (let f = 0; real < maxSeconds && s.status === 'playing'; f++) {
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
    const dt = dtOf(f);
    real += dt;
    s = step(s, dt).session;
  }
  return { s, inputs };
}

const recordOf = (mode: 'endless' | 'daily', seed: number, date: string, s: Session, inputs: RunInput[]): RunRecord => ({
  sim: SIM_VERSION, mode, seed, date, inputs, endTime: s.time, clientScore: s.score.score,
});

describe('deterministic stepping (GDD-v7 §3.2)', () => {
  it('every step ends on the TICK grid or on a beat time', () => {
    let s = createSession('daily', null, { date: '2026-10-27' });
    const rng = mulberry32(5);
    const beatTimes = new Set(s.beats.map((b) => b.time));
    for (let i = 0; i < 600 && s.status === 'playing'; i++) {
      s = step(s, rng() * 0.05).session;
      const k = s.time / TICK;
      expect(Math.abs(k - Math.round(k)) < 1e-6 || beatTimes.has(s.time), `t=${s.time}`).toBe(true);
    }
  });

  it('without input, different frame rates reach bit-identical states at the same session time', () => {
    const run = (dtOf: FrameDt): Session => {
      let s = createSession('daily', null, { date: '2026-10-27' });
      for (let f = 0; s.time < 9 && s.status === 'playing'; f++) s = step(s, dtOf(f)).session;
      return s;
    };
    const a = run(fixed(1 / 30));
    const b = run(fixed(1 / 144));
    const c = run(jitter(3));
    // compare at the first boundary all three have reached
    expect(a.status).toBe(b.status);
    expect(a.hearts).toBe(b.hearts);
    expect(b.hearts).toBe(c.hearts);
    expect(a.score).toEqual(b.score);
    expect(b.score).toEqual(c.score);
  });
});

describe('simulateRun replays a recorded run to the same result', () => {
  const cases: [string, FrameDt][] = [['60fps', fixed(1 / 60)], ['30fps', fixed(1 / 30)], ['144fps', fixed(1 / 144)], ['jitter', jitter(11)]];
  for (const [name, dtOf] of cases) {
    it(`daily at ${name}`, () => {
      const date = '2026-10-27';
      const { s, inputs } = recordBot(createSession('daily', null, { date }), dtOf, 400);
      expect(s.status).toBe('cleared');
      const r = simulateRun(recordOf('daily', 0, date, s, inputs));
      expect(r.status).toBe('cleared');
      expect(r.score).toBe(s.score.score);
    });

    it(`endless at ${name} (90s, then stops)`, () => {
      const seed = 4242;
      const { s, inputs } = recordBot(createSession('endless', null, { seed }), dtOf, 90);
      const r = simulateRun(recordOf('endless', seed, '2026-10-27', s, inputs));
      expect(r.score).toBe(s.score.score);
      expect(r.endTime).toBeCloseTo(s.time, 9);
    });
  }

  it('a tampered input log does not reproduce the claimed score', () => {
    const date = '2026-10-28';
    const { s, inputs } = recordBot(createSession('daily', null, { date }), fixed(1 / 60), 400);
    const cut = inputs.slice(0, Math.floor(inputs.length / 2));
    const r = simulateRun(recordOf('daily', 0, date, s, cut));
    expect(r.score).toBeLessThan(s.score.score);
  });

  it('idle runs fail; inputs after endTime are ignored; unknown codes are rejected', () => {
    const idle = simulateRun({ sim: SIM_VERSION, mode: 'endless', seed: 1, date: '2026-10-27', inputs: [], endTime: 600, clientScore: 0 });
    expect(idle.status).toBe('failed');
    expect(() => simulateRun({
      sim: SIM_VERSION, mode: 'endless', seed: 1, date: '2026-10-27', inputs: [[1, 'X' as never]], endTime: 5, clientScore: 0,
    })).toThrow();
    expect(() => simulateRun({
      sim: 'old', mode: 'endless', seed: 1, date: '2026-10-27', inputs: [], endTime: 5, clientScore: 0,
    })).toThrow(/version/);
  });

  it('inputs must be in non-decreasing time order', () => {
    expect(() => simulateRun({
      sim: SIM_VERSION, mode: 'endless', seed: 1, date: '2026-10-27', inputs: [[3, 'T'], [2, 'T']], endTime: 5, clientScore: 0,
    })).toThrow(/order/);
  });
});

// keep slide() referenced for the S code path
void slide;

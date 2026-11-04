// Polish round P1b: on dense stages the attack callout flashed for ~0.28 s (it hid 0.35 s before each beat and
// the next beat's callout only started once the previous beat passed). A started callout now holds ≥ 0.5 s.
import { describe, expect, it } from 'vitest';
import { CALLOUT_END, CALLOUT_MIN, CalloutHold } from '../../src/office/render/callout-hold';

/** frames at 60 fps over beats arriving at `arrivals` (s); the candidate is always the nearest beat ahead */
function simulate(arrivals: readonly number[]): Map<number, number> {
  const hold = new CalloutHold();
  const shown = new Map<number, number>();
  const dt = 1 / 60;
  for (let t = 0; t < arrivals[arrivals.length - 1]; t += dt) {
    const k = arrivals.findIndex((a) => a > t);
    if (hold.show(k, arrivals[k] - t, t)) shown.set(k, (shown.get(k) ?? 0) + dt);
  }
  return shown;
}

const even = (gap: number, n: number): number[] => Array.from({ length: n }, (_, i) => (i + 1) * gap);

describe('CalloutHold', () => {
  it('a dense stage (beats 0.6 s apart) shows every callout for at least 0.5 s', () => {
    const d = simulate(even(0.6, 12));
    expect(d.size).toBe(12);
    for (const s of d.values()) expect(s).toBeGreaterThanOrEqual(CALLOUT_MIN - 1 / 60);
  });

  it('a sparse beat still hides CALLOUT_END before arrival (the "!" and the prop take over)', () => {
    const hold = new CalloutHold();
    expect(hold.show(1, 1.5, 0)).toBe(true);
    expect(hold.show(1, CALLOUT_END + 0.01, 1.14)).toBe(true);
    expect(hold.show(1, CALLOUT_END - 0.01, 1.16)).toBe(false);
  });

  it('never starts a callout inside CALLOUT_END, never shows a beat that has arrived', () => {
    const hold = new CalloutHold();
    expect(hold.show(3, CALLOUT_END - 0.05, 0)).toBe(false);
    expect(hold.show(4, 0.45, 1)).toBe(true);
    expect(hold.show(4, -0.01, 1.47)).toBe(false);
  });

  it('a beat closer than CALLOUT_END behind another is skipped, never flashed; every shown callout holds 0.5 s', () => {
    // pairs: a beat, then one 0.25 s later (a combo-like double), then a 0.9 s gap
    const arrivals = [0.9, 1.15, 2.05, 2.3, 3.2, 3.45, 4.35, 4.6];
    const d = simulate(arrivals);
    expect([...d.keys()]).toEqual([0, 2, 4, 6]);
    for (const s of d.values()) expect(s).toBeGreaterThanOrEqual(CALLOUT_MIN - 1 / 60);
  });
});

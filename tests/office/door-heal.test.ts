// Part 2 balance rule (part-2 spec §4): passing a section door restores 1 heart, up to the character's max —
// the same for every character. Office graph: office stages carry door.heal; v8 / endless doors carry none.
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { advanceTo, createSession, type Session } from '../../src/game/session';

const at = (s: Session, t: number): Session => advanceTo(s, t).session;

describe('door heal', () => {
  const stage = { ...STAGES[0], seed: 12345 };

  it('every office stage door heals one heart', () => {
    for (const st of STAGES) {
      const s = createSession('stage', { ...st, seed: 1 });
      expect(s.doors.length).toBe(2);
      expect(s.doors.every((d) => d.heal === 1)).toBe(true);
    }
  });

  it('restores one heart when the door is passed, capped at the max', () => {
    const s0 = createSession('stage', stage, { skin: 'kid', invincible: true });
    const door = s0.doors[0];
    // a session two hearts down just before the first door (the invincible run takes no other damage)
    const before = { ...at(s0, door.time - 0.05), hearts: s0.maxHearts - 2, status: 'playing' as const };
    const after = at(before, door.time + 0.01);
    expect(after.section).toBe(1);
    expect(after.hearts).toBe(s0.maxHearts - 1);
    const full = at({ ...at(s0, door.time - 0.05), status: 'playing' as const }, door.time + 0.01);
    expect(full.hearts).toBe(s0.maxHearts);
  });

  it('endless doors do not heal', () => {
    const s = createSession('endless', null, { seed: 3 });
    expect(s.doors.every((d) => d.heal === undefined)).toBe(true);
  });
});

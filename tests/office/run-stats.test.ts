// v2.2 four heroes in a run (spec §2): the office flavour feeds the chosen character's stats into the
// session — physics, hearts (the HUD shows the character's max), fever gain and coin multiplier.
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { runStats } from '../../src/flavor';
import { createSession, step } from '../../src/game/session';
import { toHud } from '../../src/game/snapshot';
import { statsFor } from '../../src/office/core/characters';

describe('office run stats', () => {
  it('are the character stats', () => {
    for (const skin of ['kid', 'cat', 'bunny', 'robot'] as const) {
      const s = statsFor(skin);
      expect(runStats(0, skin)).toEqual({ physics: s.physics, hearts: s.hearts, feverGain: s.feverGain, coinMul: s.coinMul });
    }
  });

  it.each([['kid', 3], ['cat', 2], ['bunny', 3], ['robot', 4]] as const)('%s starts with %i hearts on the HUD', (skin, n) => {
    const s = createSession('stage', STAGES[0], { skin });
    expect(s.hearts).toBe(n);
    expect(toHud(s).maxHearts).toBe(n);
    expect(s.cfg).toEqual(statsFor(skin).physics);
  });

  it('caps a heart pickup at the character max', () => {
    const s = createSession('stage', STAGES[0], { skin: 'robot' });
    const beat = { id: 0, time: 0.05, obstacles: [{ kind: 'heart' as const, level: 1 as const, lanes: [1 as const] }], requiredLevel: 0 as const, needsSlide: false, pulse: false, blockedLanes: [], section: 0 };
    const air = { ...s.player, grounded: false, level: 1 as const, height: 30, vy: 300 };
    const out = step({ ...s, beats: [beat], hearts: 3, player: air }, 0.1).session;
    expect(out.hearts).toBe(4);
    const again = step({ ...out, beats: [{ ...beat, time: out.time + 0.05 }], cursor: 0, player: air }, 0.1).session;
    expect(again.hearts).toBe(4);
  });

  it('generates the stage with the character physics', () => {
    const times = (skin: 'kid' | 'bunny') => STAGES.map((st) => createSession('stage', st, { skin }).beats.map((x) => x.time));
    expect(times('bunny')).not.toEqual(times('kid'));
  });
});

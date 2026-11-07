// P2 (pt-casual part 1): after a tutorial stop resumes, the next hazard must leave the player room to breathe.
// A fresh save freezes stage 1 at the first plain jump / slide / lane beat (game/tutorial.ts); a player who only
// follows the prompts must not be hit by a hazard < TUTORIAL_ROOM s after the resume.
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { createSession } from '../../src/game/session';
import { tutorialStops } from '../../src/game/tutorial';
import { HAZARD_KINDS } from '../../src/types';
import { STAGE_MISSIONS } from '../../src/office/core/missions';

const TUTORIAL_ROOM = 1.5;

describe('stage 1 tutorial stops leave room after the resume', () => {
  it(`the next hazard is >= ${TUTORIAL_ROOM} s after every stop (200 seeds)`, () => {
    const bad: string[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const s = createSession('stage', { ...STAGES[0], seed }, { seed });
      for (const st of tutorialStops(s.beats, [], s.cfg)) {
        const i = s.beats.findIndex((b) => b.id === st.beatId);
        const next = s.beats.slice(i + 1).find((b) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind)));
        if (next && next.time - st.at < TUTORIAL_ROOM - 1e-6) bad.push(`seed ${seed} ${st.step}: ${(next.time - st.at).toFixed(2)} s`);
      }
    }
    expect(bad.slice(0, 5), `${bad.length} stops too tight`).toEqual([]);
  });

  it('only stage 1 teaches (its three parts carry teach)', () => {
    for (const s of STAGES) for (const m of STAGE_MISSIONS[s.id]) expect(m.teach === true, s.id).toBe(s.id === 'w1-s10');
  });
});

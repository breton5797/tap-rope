// v8 HUD boss bar: one zone boss and one whole-stage gauge across every section (bossForSection = bossFor).
import { describe, expect, it } from 'vitest';
import { bossFor, bossForSection } from '../../src/core/boss';
import { STAGES, stageById } from '../../src/core/content';
import { createSession } from '../../src/game/session';
import { toHud } from '../../src/game/snapshot';
import type { Beat, StageDef } from '../../src/types';
import { HAZARD_KINDS } from '../../src/types';

const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));

describe('v8 HUD boss bar per section', () => {
  it('bossForSection is bossFor on every stage and section', () => {
    for (const st of STAGES) for (const i of [0, 1, 2]) expect(bossForSection(st, i)).toBe(bossFor(st));
  });

  it('keeps the zone boss and the whole-stage gauge after each door', () => {
    const s = createSession('stage', stageById('w5-s10') as StageDef);
    for (const section of [1, 2]) {
      const time = s.doors[section - 1].time + 0.01;
      const hazardDone = s.beats.filter((b) => isHazard(b) && b.section < section).length;
      const hud = toHud({ ...s, time, section, hazardDone });
      expect(hud.boss).toEqual({ name: '간수장 로봇', codename: 'WARDEN-X', hp: 1 - hazardDone / s.hazardTotal, phase: section });
    }
  });
});

// @vitest-environment jsdom
// Stamp bonus paid once (economy decision, 2026-11-16): MISSION_BONUS (20 × stage) per stamp is paid only the
// first time that stamp (stage × mission) is earned — a replay pays pickup ₵ only. Paid stamps are kept in
// their own office key, written on recorded runs (cleared or failed); legacy saves are seeded from the best
// stamps so nobody is paid twice. The daily mission pays no stamp bonus (its own rewards live in core/live).
import { beforeEach, describe, expect, it } from 'vitest';
import { stageById } from '../../src/core/content';
import { generateStage } from '../../src/core/levels';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import type { GameEvent } from '../../src/game/session';
import { MISSION_BONUS } from '../../src/office/core/missions';
import { commitMissions, missionView, startMissions, trackMissions, type MissionRun } from '../../src/office/game/missions';
import { dailyPlan } from '../../src/office/core/live';
import { HAZARD_KINDS, type Beat, type StageDef } from '../../src/types';

const PAID_KEY = 'officeescape.stampsPaid.v1';
const STAMPS_KEY = 'officeescape.stamps.v1';
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const judge = (beatId: number): GameEvent => ({ type: 'judge', shielded: false, result: { beatId, grade: 'perfect', hit: false, reason: null, collected: [] } });

/** stage n's run with the dodge part (part 0) stamped and the rest missed, ended cleared / failed */
function runStage1(cleared: boolean, def: StageDef = { ...(stageById('w1-s10') as StageDef), seed: 11 }): MissionRun {
  const { beats } = generateStage(def, DEFAULT_PHYSICS, 2);
  let r = startMissions(def, beats) as MissionRun;
  const at = (section: number, time: number) => ({ beats, section, time });
  r = trackMissions(r, at(0, 5), beats.filter((b) => b.part === 0 && isHazard(b)).map((b) => judge(b.id)))!;
  r = trackMissions(r, at(2, 40), [])!;
  return trackMissions(r, at(2, 41), [{ type: 'end', cleared }])!;
}

beforeEach(() => localStorage.clear());

describe('stamp bonus paid once', () => {
  it('MISSION_BONUS is 20 × stage', () => {
    expect([0, 1, 4, 9].map(MISSION_BONUS)).toEqual([20, 40, 100, 200]);
  });

  it('the first recorded run pays the new stamp; a replay earning it again pays nothing', () => {
    const first = commitMissions(runStage1(true), true, true)!;
    expect(first.paid).toEqual([true, false, false]);
    expect(first.stampBonus).toBe(MISSION_BONUS(0));
    const again = commitMissions(runStage1(true), true, true)!;
    expect(again.paid).toEqual([false, false, false]);
    expect(again.stampBonus).toBe(0);
    expect(again.bonus).toBe(0);
    expect(again.stamps).toEqual(first.stamps); // the stamps themselves still show
  });

  it('a failed recorded run pays (and stores) its door stamps too, so a later clear does not pay them again', () => {
    expect(commitMissions(runStage1(false), false, true)!.stampBonus).toBe(MISSION_BONUS(0));
    expect(commitMissions(runStage1(true), true, true)!.stampBonus).toBe(0);
  });

  it('an unrecorded run (autoplay / tester) reports what it would pay but stores nothing', () => {
    expect(commitMissions(runStage1(true), true, false)!.stampBonus).toBe(MISSION_BONUS(0));
    expect(localStorage.getItem(PAID_KEY)).toBeNull();
    expect(commitMissions(runStage1(true), true, true)!.stampBonus).toBe(MISSION_BONUS(0));
  });

  it('legacy saves: stamps already earned (best stamps on the map) are not paid again', () => {
    localStorage.setItem(STAMPS_KEY, JSON.stringify({ 'w1-s10': [true, false, false] }));
    const out = commitMissions(runStage1(true), true, true)!;
    expect(out.paid).toEqual([false, false, false]);
    expect(out.stampBonus).toBe(0);
    expect(JSON.parse(localStorage.getItem(PAID_KEY) ?? '{}')['w1-s10']).toEqual([true, false, false]);
  });

  it('P3: an empty (or partial) paid store still counts the best stamps as paid', () => {
    localStorage.setItem(STAMPS_KEY, JSON.stringify({ 'w1-s10': [true, false, false] }));
    localStorage.setItem(PAID_KEY, '{}');
    expect(commitMissions(runStage1(true), true, true)!.stampBonus).toBe(0);
    localStorage.setItem(PAID_KEY, JSON.stringify({ 'w2-s10': [true, true, true] }));
    expect(commitMissions(runStage1(true), true, true)!.stampBonus).toBe(0);
  });

  it('a corrupt paid store is rebuilt from the best stamps (never pays twice, never throws)', () => {
    localStorage.setItem(STAMPS_KEY, JSON.stringify({ 'w1-s10': [true, false, false] }));
    localStorage.setItem(PAID_KEY, '{oops');
    expect(commitMissions(runStage1(true), true, true)!.stampBonus).toBe(0);
  });

  it('the daily mission pays no stamp bonus (its rewards are the live ones)', () => {
    const plan = dailyPlan('2026-11-16', 3);
    const out = commitMissions(runStage1(true, plan.stage), true, true)!;
    expect(out.stamps[0]).toBe(true);
    expect(out.paid).toEqual([false, false, false]);
    expect(out.stampBonus).toBe(0);
  });

  it('missionView.stampPays: the stamp that just fired pays its bonus (ok, campaign stage, not paid before)', () => {
    const first = runStage1(true);
    expect(missionView(first, 6)?.stampOk).toBe(false); // the last stamp to fire (part 1) was missed
    // the door stamp of part 0: right after it fired
    const def = { ...(stageById('w1-s10') as StageDef), seed: 11 };
    const { beats } = generateStage(def, DEFAULT_PHYSICS, 2);
    const at = (section: number, time: number) => ({ beats, section, time });
    const atDoor = (): MissionRun => trackMissions(
      trackMissions(startMissions(def, beats) as MissionRun, at(0, 5), beats.filter((b) => b.part === 0 && isHazard(b)).map((b) => judge(b.id)))!,
      at(1, 20), [],
    )!;
    expect(missionView(atDoor(), 20)).toMatchObject({ stampOk: true, stampPays: true });
    commitMissions(runStage1(true), true, true); // stamp 0 of stage 1 is now paid
    expect(missionView(atDoor(), 20)).toMatchObject({ stampOk: true, stampPays: false });
    // a missed stamp never pays
    expect(missionView(first, 41)?.stampPays).toBe(false);
  });

  it('missionView.stampPays is false on a daily mission', () => {
    const plan = dailyPlan('2026-11-16', 3);
    const { beats } = generateStage(plan.stage, DEFAULT_PHYSICS, 2);
    const run = trackMissions(
      trackMissions(startMissions(plan.stage, beats) as MissionRun, { beats, section: 0, time: 5 }, beats.filter((b) => b.part === 0 && isHazard(b)).map((b) => judge(b.id)))!,
      { beats, section: 1, time: 20 }, [],
    )!;
    expect(missionView(run, 20)).toMatchObject({ stampOk: true, stampPays: false });
  });
});

// @vitest-environment jsdom
// Office v2 mission tracker (office graph): per-section stats from session events, one stamp per door, the
// stage outcome, a fresh run on retry, and the mission card naming the section's superior.
import { beforeEach, describe, expect, it } from 'vitest';
import { STAGES, stageById } from '../../src/core/content';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import type { GameEvent } from '../../src/game/session';
import {
  commitMissions, loadStamps, missionCardFor, missionView, startMissions, trackMissions, type MissionRun,
} from '../../src/office/game/missions';
import { generateStage } from '../../src/core/levels';
import { HAZARD_KINDS, type Beat, type StageDef } from '../../src/types';

const stage = (n: number) => stageById(`w${n}-s10`) as StageDef;
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const judge = (beatId: number, hit = false, collected: string[] = [], shielded = false): GameEvent => ({
  type: 'judge', shielded, result: { beatId, grade: hit ? 'miss' : 'perfect', hit, reason: hit ? 'low' : null, collected: collected as never[] },
});

function setup(n: number, seed = 11) {
  const def = { ...stage(n), seed };
  const { beats } = generateStage(def, DEFAULT_PHYSICS, 2);
  return { def, beats, run: startMissions(def, beats) as MissionRun };
}
const at = (beats: readonly Beat[], section: number, time = 0) => ({ beats, section, time });

describe('mission tracker', () => {
  beforeEach(() => localStorage.clear());

  it('is null off the office script (endless / demo)', () => {
    expect(startMissions({ ...STAGES[0], id: 'endless-1' }, [])).toBeNull();
  });

  it('counts dodges, hits and items per section', () => {
    const { beats, run } = setup(1);
    const p0 = beats.filter((b) => b.part === 0 && isHazard(b));
    let r = trackMissions(run, at(beats, 0), [judge(p0[0].id), judge(p0[1].id, true), judge(p0[2].id, true, [], true)])!;
    const v = missionView(r, 1)!;
    expect(v.index).toBe(0);
    expect(v.kind).toBe('dodge');
    expect(v.value).toBe(2); // the shielded one counts as dodged
    expect(v.target).toBe(p0.length);
    const coin = beats.find((b) => b.part === 1 && b.obstacles.some((o) => o.kind === 'coin'))!;
    r = trackMissions(r, at(beats, 1, 20), [judge(coin.id, false, ['coin'])])!;
    expect(missionView(r, 20)!.kind).toBe('collect');
    expect(missionView(r, 20)!.value).toBe(1);
  });

  it('stamps each section exactly once, when its door is passed', () => {
    const { beats, run } = setup(1);
    const p0 = beats.filter((b) => b.part === 0 && isHazard(b));
    let r = trackMissions(run, at(beats, 0, 5), p0.map((b) => judge(b.id)))!;
    expect(missionView(r, 5)!.stamps).toEqual([null, null, null]);
    r = trackMissions(r, at(beats, 1, 12), [])!;
    const v = missionView(r, 12)!;
    expect(v.stamps).toEqual([true, null, null]);
    expect(v.stampAt).toBe(12);
    expect(v.stampOk).toBe(true);
    r = trackMissions(r, at(beats, 1, 13), [])!;
    expect(missionView(r, 13)!.stampAt).toBe(12); // no second stamp for the same door
    // nothing collected in part 1: its stamp is a miss at the next door
    r = trackMissions(r, at(beats, 2, 30), [])!;
    expect(missionView(r, 30)!.stamps).toEqual([true, false, null]);
    expect(missionView(r, 30)!.stampOk).toBe(false);
  });

  it('the finale stamps at the end of a cleared run: clean leap and ≤ 2 hits', () => {
    const { beats, run } = setup(1);
    const p2 = beats.filter((b) => b.part === 2 && isHazard(b));
    let r = trackMissions(run, at(beats, 2, 40), [...p2.slice(0, -1).map((b, i) => judge(b.id, i < 2)), judge(p2[p2.length - 1].id)])!;
    r = trackMissions(r, at(beats, 2, 45), [{ type: 'end', cleared: true }])!;
    expect(missionView(r, 45)!.stamps[2]).toBe(true);
    const out = commitMissions(r, true, false)!;
    expect(out.stamps).toEqual([false, false, true]);
    expect(out.grade).toBe('B');
    expect(out.stars).toBe(1);
    expect(out.bonus).toBe(150);
  });

  it('a failed run leaves the current section unstamped and records nothing', () => {
    const { beats, run } = setup(2);
    let r = trackMissions(run, at(beats, 1, 20), [])!;
    r = trackMissions(r, at(beats, 1, 22), [{ type: 'end', cleared: false }])!;
    const out = commitMissions(r, false, true)!;
    expect(out.stamps).toEqual([false, null, null]);
    expect(loadStamps()).toEqual({});
  });

  it('pays the stamps earned at doors even when the run fails later (spec §3.3: the bonus is given at the door)', () => {
    const { beats, run } = setup(1);
    const p0 = beats.filter((b) => b.part === 0 && isHazard(b));
    let r = trackMissions(run, at(beats, 0), p0.map((b) => judge(b.id)))!;
    r = trackMissions(r, at(beats, 2, 30), [])!; // stamp 1 earned, stamp 2 missed
    r = trackMissions(r, at(beats, 2, 33), [{ type: 'end', cleared: false }])!;
    const out = commitMissions(r, false, false)!;
    expect(out.stamps).toEqual([true, false, null]);
    expect(out.stampBonus).toBe(150);
    expect(out.bonus).toBe(150);
  });

  it('counts 금일봉 picked up in the stage-5 finale (+₵20 each), cleared or not', () => {
    // a run seed whose finale has at least two coins (금일봉)
    const seed = Array.from({ length: 60 }, (_, i) => i + 1).find((x) =>
      generateStage({ ...stage(5), seed: x }, DEFAULT_PHYSICS, 2).beats.filter((b) => b.part === 2 && b.obstacles.some((o) => o.kind === 'coin')).length >= 2)!;
    const { beats, run } = setup(5, seed);
    const coins = beats.filter((b) => b.part === 2 && b.obstacles.some((o) => o.kind === 'coin')).slice(0, 2);
    expect(coins.length).toBe(2);
    let r = trackMissions(run, at(beats, 2, 60), coins.map((b) => judge(b.id, false, ['coin'])))!;
    r = trackMissions(r, at(beats, 2, 61), [{ type: 'end', cleared: false }])!;
    const out = commitMissions(r, false, false)!;
    expect(out.items).toBe(2);
    expect(out.bonus).toBe(out.stampBonus + 40);
    // coins elsewhere (not a collect part, no collectible) are plain coins
    const { beats: b1, run: r1 } = setup(1);
    const plain = b1.find((b) => b.part === 0 && b.obstacles.some((o) => o.kind === 'coin'));
    if (plain) expect(commitMissions(trackMissions(r1, at(b1, 0), [judge(plain.id, false, ['coin'])]), false, false)!.items).toBe(0);
  });

  it('missionView is the same object while nothing changed (one build per change, not per frame)', () => {
    const { beats, run } = setup(1);
    expect(missionView(run, 1)).toBe(missionView(run, 2));
    const r = trackMissions(run, at(beats, 0, 3), [])!;
    expect(r).toBe(run);
  });

  it('a retry starts from zero (no stats or stamps carried over)', () => {
    const { def, beats, run } = setup(1);
    const p0 = beats.filter((b) => b.part === 0 && isHazard(b));
    trackMissions(trackMissions(run, at(beats, 0), p0.map((b) => judge(b.id)))!, at(beats, 1, 10), []);
    const fresh = startMissions(def, beats)!;
    expect(missionView(fresh, 0)).toMatchObject({ index: 0, value: 0, stamps: [null, null, null] });
    expect(missionView(fresh, 0)!.stampAt).toBeUndefined();
  });

  it('keeps the best stamps per stage for the map (recorded runs only)', () => {
    const { beats, run } = setup(1);
    const p0 = beats.filter((b) => b.part === 0 && isHazard(b));
    let r = trackMissions(run, at(beats, 0), p0.map((b) => judge(b.id)))!;
    r = trackMissions(r, at(beats, 2, 30), [{ type: 'end', cleared: true }])!;
    commitMissions(r, true, true);
    expect(loadStamps()['w1-s10']).toEqual([true, false, false]);
    // a worse later run never erases a stamp
    const again = trackMissions(startMissions({ ...stage(1), seed: 11 }, beats)!, at(beats, 2, 30), [{ type: 'end', cleared: true }])!;
    commitMissions(again, true, true);
    expect(loadStamps()['w1-s10']).toEqual([true, false, false]);
  });

  it('the chase gauge falls 30% on a hit and gains 5% per dodge', () => {
    const { beats, run } = setup(3);
    const p0 = beats.filter((b) => b.part === 0 && isHazard(b));
    const r = trackMissions(run, at(beats, 0), [judge(p0[0].id), judge(p0[1].id, true)])!;
    expect(missionView(r, 1)!.chase).toBeCloseTo(0.5 + 0.05 - 0.3);
  });
});

describe('missionCardFor', () => {
  it('names the mission and the superior of the section (stage 5: 한전무 → 윤이사 → 사장님)', () => {
    expect([0, 1, 2].map((k) => missionCardFor(stage(5), k)!.superior)).toEqual(['한전무', '윤이사', '사장님']);
    expect(missionCardFor(stage(1), 0)).toMatchObject({ index: 0, total: 3, kind: 'dodge', title: '포스트잇 폭풍', superior: '김대리' });
    expect(missionCardFor({ ...STAGES[0], id: 'endless-1' }, 0)).toBeNull();
  });
});

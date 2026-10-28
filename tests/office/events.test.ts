// Office surprise events and attack variants (office spec §6): re-dresses of beats the v8 generator already
// produced — never new beats — chosen once per run from the run seed (P3).
import { describe, expect, it } from 'vitest';
import { ATTACK_PROPS, BLACKOUT_FADE, OFFICE_PROPS, attackVariant, cartProp, planEvents, type OfficeEvent } from '../../src/office/core/events';
import { stageById } from '../../src/core/content';
import { generateStage } from '../../src/core/levels';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import type { Beat, BossAttackKind, BossId, Obstacle, StageDef } from '../../src/types';
import { HAZARD_KINDS, LANE_HAZARD_KINDS, WARN_LEAD } from '../../src/types';

const beatsFor = (n: number, seed: number): Beat[] =>
  generateStage({ ...(stageById(`w${n}-s10`) as StageDef), seed }, DEFAULT_PHYSICS).beats;
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const isLane = (b: Beat) => b.obstacles.some((o) => LANE_HAZARD_KINDS.includes(o.kind));
const isRear = (b: Beat) => b.obstacles.some((o) => o.from === 'back');
const hasCoin = (b: Beat) => b.obstacles.some((o) => o.kind === 'coin');
const mk = (id: number, time: number, obstacles: Obstacle[]): Beat => ({
  id, time, obstacles, requiredLevel: 0, needsSlide: false, pulse: false, blockedLanes: [], section: 0,
});
const layout = (es: readonly OfficeEvent[]) => es.map((e) => `${e.kind}@${e.beatIndex}`).join(',');
const SEEDS = Array.from({ length: 50 }, (_, i) => i * 7919 + 13);

/** the event re-dresses its beat as the rules say */
function checkEvent(e: OfficeEvent, beats: readonly Beat[]): void {
  const b = beats[e.beatIndex];
  expect(b, `${e.kind} beat ${e.beatIndex}`).toBeDefined();
  expect(e.duration).toBeGreaterThan(0);
  expect(e.time).toBeGreaterThanOrEqual(0);
  if (e.kind === 'cart') expect(isLane(b)).toBe(true);
  if (e.kind === 'fire-drill') expect(isRear(b)).toBe(true);
  if (e.kind === 'highfive') expect(hasCoin(b)).toBe(true);
  if (e.kind === 'cart' || e.kind === 'fire-drill') expect(b.time - e.time).toBeGreaterThanOrEqual(WARN_LEAD - 1e-9);
  if (e.kind === 'blackout') {
    expect(e.duration).toBeCloseTo(1.5, 9);
    const end = e.time + e.duration + BLACKOUT_FADE;
    for (const h of beats.filter(isHazard)) {
      expect(Math.abs(h.time - e.time), `hazard ${h.id}`).toBeGreaterThanOrEqual(WARN_LEAD - 1e-9);
      // the screen is lit again (fade included) before the next hazard's "!" lead starts
      if (h.time > e.time) expect(h.time - WARN_LEAD - end, `hazard ${h.id} after blackout`).toBeGreaterThanOrEqual(-1e-9);
    }
  }
}

describe('planEvents', () => {
  it('is deterministic in (beats, seed) and leaves the beats untouched', () => {
    const beats = beatsFor(3, 42);
    const copy = JSON.stringify(beats);
    expect(planEvents(beats, 5, 2)).toEqual(planEvents(beats, 5, 2));
    expect(JSON.stringify(beats)).toBe(copy);
  });

  it('different seeds give at least 3 distinct layouts over 50 seeds', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const beats = beatsFor(n, 1000 + n);
      const seen = new Set(SEEDS.map((s) => layout(planEvents(beats, s, n - 1))));
      expect(seen.size, `stage ${n}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('stage 1 gets 1 event, later stages 2, each on a beat of the matching kind, sorted by time', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      for (const seed of SEEDS) {
        const beats = beatsFor(n, seed);
        const es = planEvents(beats, seed, n - 1);
        expect(es, `stage ${n} seed ${seed}`).toHaveLength(n === 1 ? 1 : 2);
        expect(new Set(es.map((e) => e.kind)).size).toBe(es.length);
        expect(new Set(es.map((e) => e.beatIndex)).size).toBe(es.length);
        expect([...es].sort((a, b) => a.time - b.time)).toEqual(es);
        for (const e of es) checkEvent(e, beats);
      }
    }
  });

  it('uses every event kind somewhere across seeds on stage 5', () => {
    const kinds = new Set(SEEDS.flatMap((s) => planEvents(beatsFor(5, s), s, 4).map((e) => e.kind)));
    expect([...kinds].sort()).toEqual(['blackout', 'broadcast', 'cart', 'fire-drill', 'highfive']);
  });

  it('never plans an event whose beat kind is missing', () => {
    // only full-width floor lasers 0.5s apart: no lane / rear / coin beat, no 2s hazard-free gap
    const beats = Array.from({ length: 12 }, (_, i) => mk(i, 2 + i * 0.5, [{ kind: 'floor', level: 1 }]));
    for (const seed of SEEDS) {
      const es = planEvents(beats, seed, 3);
      expect(es.every((e) => e.kind === 'broadcast'), layout(es)).toBe(true);
      expect(es).toHaveLength(1); // broadcast once; nothing else fits
    }
    expect(planEvents([], 1, 3)).toEqual([]);
  });

  it('blackout window does not start within WARN_LEAD of a hazard and ends (with its fade) before the next warning', () => {
    let blackouts = 0;
    for (const n of [2, 3, 4, 5]) {
      for (const seed of SEEDS) {
        const beats = beatsFor(n, seed);
        for (const e of planEvents(beats, seed, n - 1).filter((x) => x.kind === 'blackout')) {
          blackouts++;
          checkEvent(e, beats);
        }
      }
    }
    expect(blackouts).toBeGreaterThan(0);
  });

  it('a retry with a new run seed replans from scratch (no leftover state)', () => {
    const beats = beatsFor(2, 9);
    const first = planEvents(beats, 111, 1);
    planEvents(beats, 222, 1);
    expect(planEvents(beats, 111, 1)).toEqual(first);
  });
});

describe('attackVariant', () => {
  const SLOTS: BossId[] = ['warden', 'sewer-eye', 'lab-ai', 'core', 'jailer', 'apc', 'chimera'];
  const KINDS: BossAttackKind[] = ['beam', 'floor', 'ceiling', 'drone', 'lane'];

  it('always returns a known prop compatible with the attack kind', () => {
    for (const slot of SLOTS) {
      for (const kind of KINDS) {
        for (let i = 0; i < 30; i++) {
          const p = attackVariant(slot, kind, 77 + i, i);
          expect(OFFICE_PROPS).toContain(p);
          expect(ATTACK_PROPS[slot]?.[kind] ?? [], `${slot}/${kind}`).toContain(p);
        }
      }
    }
  });

  it('is deterministic and varies with seed / beat where the superior has 2–3 looks', () => {
    expect(attackVariant('warden', 'beam', 5, 3)).toBe(attackVariant('warden', 'beam', 5, 3));
    const looks = (slot: BossId, kind: BossAttackKind) =>
      new Set(Array.from({ length: 40 }, (_, i) => attackVariant(slot, kind, i * 31, i)));
    expect(looks('warden', 'beam').size).toBeGreaterThanOrEqual(2);
    expect(looks('lab-ai', 'beam').size).toBeGreaterThanOrEqual(2);
    expect(looks('chimera', 'beam').size).toBeGreaterThanOrEqual(2);
  });

  it('follows the spec §5 table', () => {
    const only = (slot: BossId, kind: BossAttackKind) => [...new Set(Array.from({ length: 40 }, (_, i) => attackVariant(slot, kind, i, i)))].sort();
    expect(only('warden', 'lane')).toEqual(['postit']);
    expect(only('sewer-eye', 'drone')).toEqual(['paper-plane']);
    expect(only('lab-ai', 'lane')).toEqual(['door']);
    expect(only('lab-ai', 'ceiling')).toEqual(['pointer']);
    expect(only('core', 'floor')).toEqual(['golf']);
    expect(only('core', 'lane')).toEqual(['elevator']);
    expect(only('jailer', 'drone')).toEqual(['doc-tornado']);
    expect(only('apc', 'lane')).toEqual(['corp-card']);
    expect(only('chimera', 'ceiling')).toEqual(['ceo-screen']);
    expect(only('chimera', 'lane')).toEqual(['revolving-door']);
  });

  it('falls back to a generic prop for unused slots', () => {
    expect(attackVariant('gunship', 'lane', 1, 1)).toBe('cart');
    expect(OFFICE_PROPS).toContain(attackVariant('crane', 'drone', 1, 1));
  });

  it('cart events ride a cart or the cleaning robot', () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => cartProp(i, i)));
    expect([...seen].sort()).toEqual(['cart', 'robot']);
  });

  it('every prop in the art contract is used', () => {
    const used = new Set([...Object.values(ATTACK_PROPS).flatMap((k) => Object.values(k ?? {}).flat()), 'cart', 'robot']);
    expect([...used].sort()).toEqual([...OFFICE_PROPS].sort());
  });
});

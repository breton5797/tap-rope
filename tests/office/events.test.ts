// Office surprise events and attack variants (office spec §6): re-dresses of beats the v8 generator already
// produced — never new beats — chosen once per run from the run seed (P3).
import { describe, expect, it } from 'vitest';
import {
  ATTACK_PROPS, BLACKOUT_FADE, OFFICE_PROPS, PART1_PROPS, PART2_PROPS, PROP_ALIASES, PROP_CALLOUTS, PROP_FALLBACK, STAGE_PROPS,
  attackVariant, cartProp, eventCopy, failTipFor, planEvents, propSprite, type OfficeEvent,
} from '../../src/office/core/events';
import type { MoveId } from '../../src/types';
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

  it('part 2 (stages 6-10) is outdoors: no blackout, commute-themed banners', () => {
    for (const n of [6, 7, 8, 9, 10]) {
      for (const seed of SEEDS) expect(planEvents(beatsFor(n, seed), seed, n - 1).map((e) => e.kind), `${n}#${seed}`).not.toContain('blackout');
      const copy = eventCopy(n - 1);
      expect(copy.broadcast).toContain('단톡방');
      expect(copy.fireDrill).toContain('퇴근 인파');
      expect(`${copy.broadcast} ${copy.fireDrill}`).not.toMatch(/사내방송|소방훈련|사장님/);
    }
    // part 1 keeps its indoor events and copy
    expect(eventCopy(0)).toEqual({ broadcast: '사내방송: 사장님 깜짝 순시 중', fireDrill: '소방훈련! 뒤에서 와요', highFive: '하이파이브! 같이 퇴근하자!' });
    const part1 = new Set(SEEDS.flatMap((s) => planEvents(beatsFor(5, s), s, 4).map((e) => e.kind)));
    expect(part1.has('blackout')).toBe(true);
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

  const ATTACK_IDS: readonly string[] = [...OFFICE_PROPS, ...Object.keys(PROP_ALIASES)];
  const looksOf = (slot: BossId, stage?: number) =>
    KINDS.map((kind) => [...new Set(Array.from({ length: 30 }, (_, i) => attackVariant(slot, kind, i * 13, i, stage)))]);

  it('the part-2 superiors (강차장 / 문상무 / 회장님) have their own props, one distinct shape per attack kind', () => {
    for (const slot of ['crane', 'sniper', 'gunship'] as const) {
      expect(ATTACK_PROPS[slot], slot).toBeDefined();
      const looks = looksOf(slot).flat();
      expect(new Set(looks).size, slot).toBeGreaterThanOrEqual(5);
      for (const p of looks) expect(ATTACK_IDS, `${slot} ${p}`).toContain(p);
    }
    expect(looksOf('crane').flat().map((p) => PROP_CALLOUTS[p]).join(' ')).toMatch(/설문.*서명|서명.*설문/);
    expect(looksOf('sniper').flat().map((p) => PROP_CALLOUTS[p]).join(' ')).toMatch(/영수증/);
    expect(looksOf('sniper').flat().map((p) => PROP_CALLOUTS[p]).join(' ')).toMatch(/돋보기/);
    expect(looksOf('gunship').flat().map((p) => PROP_CALLOUTS[p]).join(' ')).toMatch(/지팡이/);
  });

  it('rematches use stage-keyed commute props (no part-1 prop names), distinct per kind; no stage = the part-1 table', () => {
    const rematch: readonly [number, BossId, RegExp][] = [[7, 'sewer-eye', /택시/], [9, 'apc', /꼬치|마이크/], [10, 'lab-ai', /영상통화|스마트폰/], [10, 'jailer', /집 앞/]];
    for (const [stage, slot, words] of rematch) {
      expect(STAGE_PROPS[`${stage}:${slot}`], `${stage}:${slot}`).toBeDefined();
      const looks = looksOf(slot, stage).flat();
      expect(new Set(looks).size, `${stage}:${slot}`).toBeGreaterThanOrEqual(4);
      expect(looks.map((p) => PROP_CALLOUTS[p]).join(' '), `${stage}:${slot}`).toMatch(words);
      for (const p of looks) expect(ATTACK_IDS).toContain(p);
    }
    // stage 9 윤이사 never throws the part-1 넥타이 / 법인카드
    for (const p of looksOf('apc', 9).flat()) expect(['necktie', 'corp-card']).not.toContain(p);
    // the part-1 stage (or no stage) keeps the part-1 look
    expect(attackVariant('apc', 'lane', 1, 1, 6)).toBe('corp-card');
    expect(attackVariant('apc', 'lane', 1, 1)).toBe('corp-card');
    expect(attackVariant('sewer-eye', 'lane', 1, 1, 2)).toBe('paper-jam');
  });

  it('every prop id has a callout and a sprite; new part-2 sprites fall back to a part-1 sprite until the art lands', () => {
    for (const id of ATTACK_IDS) {
      expect(PROP_CALLOUTS[id], id).toMatch(/[가-힣]/);
      const { sprite, fallback } = propSprite(id);
      expect(OFFICE_PROPS, id).toContain(sprite);
      if ((PART2_PROPS as readonly string[]).includes(sprite)) expect(PART1_PROPS, id).toContain(fallback);
      else expect(fallback, id).toBeNull();
    }
    for (const id of PART2_PROPS) expect(PART1_PROPS).toContain(PROP_FALLBACK[id]);
    for (const [alias, sprite] of Object.entries(PROP_ALIASES)) expect(PART1_PROPS, alias).toContain(sprite);
    expect(propSprite('unknown-prop')).toEqual({ sprite: 'papers', fallback: null });
    // round 2: 계산기 / 탬버린 / "진짜 5분" get their own sprites (no longer the corp card, necktie or 라떼 bubble)
    expect(PROP_CALLOUTS.magnifier).toBe('돋보기 "이건 뭐지?!"');
    expect(propSprite('calculator')).toEqual({ sprite: 'calculator', fallback: 'corp-card' });
    expect(propSprite('tambourine')).toEqual({ sprite: 'tambourine', fallback: 'necktie' });
    expect(propSprite('call-bubble')).toEqual({ sprite: 'call-bubble', fallback: 'latte-bubble' });
    // quality round 4: the nine former aliases have their own sprites, the old part-1 look as fallback
    const own: Readonly<Record<string, string>> = {
      'survey-box': 'papers', 'sign-board': 'clipboard', pen: 'pointer', 'audit-board': 'clipboard', 'taxi-receipt': 'paper-plane',
      'excel-sheet': 'paper-jam', 'skewer-tray': 'coffee-tray', mic: 'pointer', 'home-clipboard': 'clipboard',
    };
    for (const [id, fallback] of Object.entries(own)) expect(propSprite(id), id).toEqual({ sprite: id, fallback });
    expect(Object.keys(PROP_ALIASES)).toEqual([]);
  });

  it('fail tips name the stage superior\'s own prop for the move that cost the heart', () => {
    expect(failTipFor(6, 'jump')).toContain('설문 응모함');
    expect(failTipFor(7, 'lane')).toContain('택시');
    expect(failTipFor(9, 'beam')).toContain('꼬치');
    expect(failTipFor(1, 'lane')).toContain('포스트잇');
    const moves: MoveId[] = ['jump', 'beam', 'double', 'triple', 'slide', 'high', 'drone', 'gate', 'rear', 'pulse', 'lane', 'drop', 'chaser', 'lanejump'];
    for (let n = 1; n <= 10; n += 1) {
      for (const m of moves) {
        const tip = failTipFor(n, m);
        expect(tip, `${n} ${m}`).toMatch(/^[^→]+ → \S/);
        expect(tip).not.toMatch(/[!"]/);
      }
    }
    expect(failTipFor(7, 'lane')).toContain('줄 바꾸기');
    for (const m of moves) expect(failTipFor(3, m)).not.toMatch(/슬라이딩|레인|옆으로 비키/);
  });

  it('cart events ride a cart or the cleaning robot indoors, only the delivery cart outdoors (part 2)', () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => cartProp(i, i)));
    expect([...seen].sort()).toEqual(['cart', 'robot']);
    expect(new Set(Array.from({ length: 40 }, (_, i) => cartProp(i, i, 6)))).toEqual(new Set(['cart']));
  });

  it('every prop in the art contract is used', () => {
    const rows = [...Object.values(ATTACK_PROPS), ...Object.values(STAGE_PROPS)];
    const used = new Set([...rows.flatMap((k) => Object.values(k ?? {}).flat()), 'cart', 'robot'].map((id) => propSprite(id).sprite));
    expect([...used].sort()).toEqual([...OFFICE_PROPS].sort());
  });
});

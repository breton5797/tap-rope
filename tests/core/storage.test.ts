import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buySkin,
  defaultSave,
  isStageUnlocked,
  loadSave,
  parseSave,
  recordResult,
  writeSave,
} from '../../src/core/storage';
import { STAGES } from '../../src/core/content';

const KEY = 'taprope.save.v1';

function memStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
  };
}

describe('defaultSave', () => {
  it('has sane defaults', () => {
    expect(defaultSave()).toEqual({
      version: 1, stars: {}, bestScores: {}, coins: 0, ownedSkins: ['kid'], skin: 'kid',
      settings: { sound: true, music: true, vibration: true, reducedMotion: false },
      tutorialDone: false,
    });
  });
});

describe('parseSave', () => {
  it('returns defaults for garbage', () => {
    for (const raw of [null, undefined, 3, 'x', [], { version: 2 }]) expect(parseSave(raw)).toEqual(defaultSave());
  });

  it('round-trips a valid save', () => {
    const s = { ...defaultSave(), stars: { 'w1-s1': 3 }, bestScores: { endless: 900 }, coins: 77,
      ownedSkins: ['kid', 'cat'] as const, skin: 'cat' as const, tutorialDone: true };
    expect(parseSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('validates fields individually', () => {
    const r = parseSave({
      stars: { a: 5, b: -1, c: 1.7, d: 'x', e: 2 },
      bestScores: { a: 100, b: 'no', c: -5, d: Number.NaN },
      coins: -3,
      ownedSkins: ['cat', 'dragon', 7, 'cat'],
      skin: 'robot',
      settings: { sound: false, music: 'yes', vibration: false },
      tutorialDone: 'true',
    });
    expect(r.stars).toEqual({ a: 3, b: 0, c: 1, e: 2 });
    expect(r.bestScores).toEqual({ a: 100, c: 0 });
    expect(r.coins).toBe(0);
    expect(r.ownedSkins).toEqual(['kid', 'cat']);
    expect(r.skin).toBe('kid');
    expect(r.settings).toEqual({ sound: false, music: true, vibration: false, reducedMotion: false });
    expect(r.tutorialDone).toBe(false);
  });

  it('floors coins', () => {
    expect(parseSave({ coins: 12.9 }).coins).toBe(12);
  });
});

describe('loadSave / writeSave', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips through a store', () => {
    const st = memStore();
    const s = { ...defaultSave(), coins: 5 };
    writeSave(s, st);
    expect(JSON.parse(st.data[KEY]).coins).toBe(5);
    expect(loadSave(st)).toEqual(s);
  });

  it('never throws on bad JSON or throwing stores', () => {
    expect(loadSave(memStore({ [KEY]: '{bad' }))).toEqual(defaultSave());
    expect(loadSave({ getItem: () => { throw new Error('x'); } })).toEqual(defaultSave());
    expect(() => writeSave(defaultSave(), { setItem: () => { throw new Error('quota'); } })).not.toThrow();
    expect(loadSave(memStore())).toEqual(defaultSave());
  });

  it('defaults to globalThis.localStorage, or no-ops without it', () => {
    expect(loadSave()).toEqual(defaultSave());
    expect(() => writeSave(defaultSave())).not.toThrow();
    const st = memStore();
    vi.stubGlobal('localStorage', st);
    writeSave({ ...defaultSave(), coins: 9 });
    expect(loadSave().coins).toBe(9);
  });
});

describe('recordResult', () => {
  it('keeps maxima and adds coins immutably', () => {
    const s0 = defaultSave();
    const s1 = recordResult(s0, 'w1-s1', 2, 1000, 10);
    expect(s1.stars['w1-s1']).toBe(2);
    expect(s1.bestScores['w1-s1']).toBe(1000);
    expect(s1.coins).toBe(10);
    const s2 = recordResult(s1, 'w1-s1', 1, 2000, 5);
    expect(s2.stars['w1-s1']).toBe(2);
    expect(s2.bestScores['w1-s1']).toBe(2000);
    expect(s2.coins).toBe(15);
    expect(s0).toEqual(defaultSave());
  });

  it('clamps stars', () => {
    expect(recordResult(defaultSave(), 'w1-s2', 9, 0, 0).stars['w1-s2']).toBe(3);
  });

  it('only records stars for real stage ids', () => {
    const s = recordResult(recordResult(defaultSave(), 'endless', 0, 500, 0), 'daily:2026-10-23', 0, 900, 0);
    expect(Object.keys(s.stars)).toEqual([]);
    expect(s.bestScores.endless).toBe(500);
    expect(s.bestScores['daily:2026-10-23']).toBe(900);
  });

  it('keeps only the latest daily best so saves do not grow every day', () => {
    const d1 = recordResult(defaultSave(), 'daily:2026-10-22', 0, 700, 0);
    const d2 = recordResult(d1, 'daily:2026-10-23', 0, 300, 0);
    expect(d2.bestScores).toEqual({ 'daily:2026-10-23': 300 });
  });
});

describe('isStageUnlocked', () => {
  it('unlocks first stage and successors of starred stages', () => {
    const s = defaultSave();
    expect(isStageUnlocked(s, 0)).toBe(true);
    expect(isStageUnlocked(s, 1)).toBe(false);
    const s1 = recordResult(s, STAGES[0].id, 1, 0, 0);
    expect(isStageUnlocked(s1, 1)).toBe(true);
    expect(isStageUnlocked(s1, 2)).toBe(false);
    expect(isStageUnlocked(s1, 99)).toBe(false);
    expect(isStageUnlocked(s1, -1)).toBe(false);
  });

  it('chains across all 100 stages', () => {
    expect(STAGES).toHaveLength(100);
    const all = STAGES.slice(0, 99).reduce((s, st) => recordResult(s, st.id, 1, 0, 0), defaultSave());
    expect(isStageUnlocked(all, 99)).toBe(true);
    expect(isStageUnlocked(all, 100)).toBe(false);
    const gap = recordResult(all, STAGES[49].id, 0, 0, 0);
    expect(isStageUnlocked({ ...gap, stars: { ...gap.stars, [STAGES[49].id]: 0 } }, 50)).toBe(false);
  });
});

describe('buySkin', () => {
  it('buys when affordable and not owned', () => {
    const rich = { ...defaultSave(), coins: 100 };
    const r = buySkin(rich, 'cat');
    expect(r?.coins).toBe(40);
    expect(r?.ownedSkins).toEqual(['kid', 'cat']);
    expect(buySkin(rich, 'kid')).toBeNull();
    expect(buySkin(rich, 'astro')).toBeNull();
    expect(r && buySkin(r, 'cat')).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NOTICE,
  buySkin,
  loadSaveState,
  requestPersistentStorage,
  resetStorageNotices,
  setStorageNotice,
  watchSave,
  defaultSave,
  isStageUnlocked,
  loadSave,
  markBriefed,
  markCutsceneSeen,
  parseSave,
  recordAchievements,
  recordResult,
  writeSave,
} from '../../src/core/storage';
import { STAGES } from '../../src/core/content';

const KEY = 'laserescape.save.v2';
const LEGACY = 'laserescape.save.v1';

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
      version: 2, stars: {}, bestScores: {}, coins: 0, ownedSkins: ['kid'], skin: 'kid',
      settings: { sound: true, music: true, vibration: true, reducedMotion: false },
      tutorialDone: false, briefed: [], controlsSeen: false,
      seenCutscenes: [], achievements: {}, dailyStreak: { last: null, count: 0 },
      cosmetics: { owned: [], tint: {}, trail: null, ring: null, frame: null }, tutorialSteps: [],
    });
  });
});

describe('v7 save fields', () => {
  it('migrates old saves without them (same key and version)', () => {
    const { seenCutscenes: _a, achievements: _b, dailyStreak: _c, ...old } = { ...defaultSave(), coins: 5, controlsSeen: true };
    expect(parseSave(JSON.parse(JSON.stringify(old)))).toEqual({ ...defaultSave(), coins: 5, controlsSeen: true });
  });

  it('round-trips valid values', () => {
    const s = {
      ...defaultSave(), seenCutscenes: ['op-start', 'boss-1'] as const,
      achievements: { 'first-clear': 1761500000000, 'zone-1': 1761500001000 },
      dailyStreak: { last: '2026-10-27', count: 3 },
    };
    expect(parseSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('validates shapes', () => {
    const r = parseSave({
      seenCutscenes: ['boss-2', 'nope', 'op-start', 'boss-2', 7],
      achievements: { 'first-clear': 5, 'zone-2': 9, 'chain-50': 'x', 'chain-100': -1, 'stars-150': Number.NaN },
      dailyStreak: { last: '2026-10-27', count: 2.7 },
    });
    expect(r.seenCutscenes).toEqual(['op-start', 'boss-2']);
    expect(r.achievements).toEqual({ 'first-clear': 5 });
    expect(r.dailyStreak).toEqual({ last: '2026-10-27', count: 2 });
    expect(parseSave({ dailyStreak: { last: '27-10-2026', count: 4 } }).dailyStreak).toEqual({ last: null, count: 0 });
    expect(parseSave({ dailyStreak: { last: '2026-10-27', count: -3 } }).dailyStreak).toEqual({ last: '2026-10-27', count: 1 });
    expect(parseSave({ dailyStreak: 'x', seenCutscenes: {}, achievements: [] })).toMatchObject({
      dailyStreak: { last: null, count: 0 }, seenCutscenes: [], achievements: {},
    });
  });

  it('markCutsceneSeen / recordAchievements return new saves and ignore repeats', () => {
    const s0 = defaultSave();
    const s1 = markCutsceneSeen(s0, 'boss-3');
    expect(s1.seenCutscenes).toEqual(['boss-3']);
    expect(markCutsceneSeen(markCutsceneSeen(s1, 'op-start'), 'boss-3').seenCutscenes).toEqual(['op-start', 'boss-3']);
    expect(markCutsceneSeen(s1, 'boss-3')).toBe(s1);
    expect(s0.seenCutscenes).toEqual([]);
    const a1 = recordAchievements(s0, ['chain-50'], 100);
    expect(a1.achievements).toEqual({ 'chain-50': 100 });
    const a2 = recordAchievements(a1, ['chain-50', 'chain-100'], 200);
    expect(a2.achievements).toEqual({ 'chain-50': 100, 'chain-100': 200 });
    expect(recordAchievements(a2, [], 300)).toBe(a2);
    expect(s0.achievements).toEqual({});
  });
});

describe('controlsSeen (v5)', () => {
  it('migrates old saves (no field) to false and keeps true', () => {
    const { controlsSeen: _drop, ...old } = { ...defaultSave(), coins: 12, tutorialDone: true };
    expect(parseSave(JSON.parse(JSON.stringify(old)))).toEqual({ ...defaultSave(), coins: 12, tutorialDone: true });
    expect(parseSave({ ...old, controlsSeen: true }).controlsSeen).toBe(true);
    expect(parseSave({ ...old, controlsSeen: 'yes' }).controlsSeen).toBe(false);
  });
});

describe('parseSave', () => {
  it('returns defaults for garbage', () => {
    for (const raw of [null, undefined, 3, 'x', [], { version: 'x' }, { version: 0 }, { version: 1.5 }]) expect(parseSave(raw)).toEqual(defaultSave());
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

describe('briefed chapters', () => {
  it('round-trips and validates briefed (ints 0..9, unique, sorted)', () => {
    expect(parseSave({ briefed: [3, 0, 3, 12, -1, 1.5, 'x', 9] }).briefed).toEqual([0, 3, 9]);
    expect(parseSave({ briefed: 'nope' }).briefed).toEqual([]);
    const s = { ...defaultSave(), briefed: [0, 4] };
    expect(parseSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('markBriefed adds a chapter once, immutably', () => {
    const s0 = defaultSave();
    const s1 = markBriefed(s0, 4);
    expect(s1.briefed).toEqual([4]);
    expect(markBriefed(markBriefed(s1, 0), 4).briefed).toEqual([0, 4]);
    expect(markBriefed(s1, 4)).toBe(s1);
    expect(markBriefed(s1, 10)).toBe(s1);
    expect(s0.briefed).toEqual([]);
  });

  it('ignores the old TAP ROPE save key (fresh game)', () => {
    const old = { getItem: (k: string) => (k === 'taprope.save.v1' ? JSON.stringify({ coins: 999 }) : null) };
    expect(loadSave(old)).toEqual(defaultSave());
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
    expect(r?.coins).toBe(30); // cat = 70 (v8 prices)
    expect(r?.ownedSkins).toEqual(['kid', 'cat']);
    expect(buySkin(rich, 'kid')).toBeNull();
    expect(buySkin(rich, 'astro')).toBeNull();
    expect(r && buySkin(r, 'cat')).toBeNull();
  });
});

describe('v8 save (version 2)', () => {
  afterEach(() => resetStorageNotices());
  const v1 = { version: 1, stars: { 'w1-s1': 3 }, bestScores: {}, coins: 40, ownedSkins: ['kid', 'cat'], skin: 'cat',
    settings: { sound: true, music: false, vibration: true, reducedMotion: false }, tutorialDone: true, briefed: [0],
    controlsSeen: true, seenCutscenes: ['op-start'], achievements: { 'first-clear': 1 }, dailyStreak: { last: '2026-10-27', count: 2 } };

  it('migrates a v1 save from the legacy key to the v2 key (all progress kept) and leaves the old key untouched', () => {
    const old = JSON.stringify(v1);
    const st = memStore({ [LEGACY]: old });
    const { save, status } = loadSaveState(st);
    expect(status).toBe('migrated');
    expect(save).toEqual({ ...v1, version: 2, cosmetics: { owned: [], tint: {}, trail: null, ring: null, frame: null }, tutorialSteps: [] });
    writeSave({ ...save, coins: 99 }, st);
    expect(JSON.parse(st.data[KEY]).version).toBe(2);
    expect(st.data[LEGACY]).toBe(old); // an old build in a stale tab still finds its own save, never ours
    expect(loadSaveState(st)).toEqual({ save: { ...save, coins: 99 }, status: 'ok' });
    expect(loadSaveState(memStore()).status).toBe('new');
  });

  it('prefers the v2 key over the legacy key; a v2-shaped save on the legacy key (pre-split dev builds) still migrates', () => {
    const st = memStore({ [LEGACY]: JSON.stringify({ ...v1, coins: 1 }), [KEY]: JSON.stringify({ ...defaultSave(), coins: 2 }) });
    expect(loadSave(st).coins).toBe(2);
    const dev = memStore({ [LEGACY]: JSON.stringify({ ...defaultSave(), coins: 7 }) });
    expect(loadSaveState(dev)).toMatchObject({ status: 'migrated', save: { coins: 7 } });
  });

  it('keeps a save from a newer build: read leniently, never overwritten, player told once', () => {
    const newer = JSON.stringify({ ...v1, version: 3, futureField: { x: 1 }, coins: 55 });
    const st = memStore({ [KEY]: newer });
    const toasts: string[] = [];
    const { save, status } = loadSaveState(st);
    expect(status).toBe('newer');
    expect(save.coins).toBe(55);
    expect(loadSave(st).stars).toEqual({ 'w1-s1': 3 });
    expect(writeSave({ ...save, coins: 0 }, st)).toBe('protected');
    expect(st.data[KEY]).toBe(newer);
    setStorageNotice((m) => toasts.push(m)); // the queued notice is delivered on registration
    writeSave(save, st);
    expect(toasts).toEqual([NOTICE.newer]);
    expect(parseSave({ version: 3 })).toEqual(defaultSave()); // the strict parse still refuses it
  });

  it('backs up a corrupt save before starting fresh', () => {
    const st = memStore({ [KEY]: '{oops' });
    const toasts: string[] = [];
    setStorageNotice((m) => toasts.push(m));
    expect(loadSave(st)).toEqual(defaultSave());
    expect(st.data['laserescape.save.corrupt']).toBe('{oops');
    expect(toasts).toEqual([NOTICE.corrupt]);
    expect(loadSaveState(memStore({ [KEY]: '[1,2]' })).status).toBe('corrupt');
  });

  it('a quota error is reported once', () => {
    const toasts: string[] = [];
    setStorageNotice((m) => toasts.push(m));
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(writeSave(defaultSave(), full)).toBe('failed');
    expect(writeSave(defaultSave(), full)).toBe('failed');
    expect(toasts).toEqual([NOTICE.quota]);
  });

  it('validates cosmetics: known owned ids only, slots of the right kind/skin', () => {
    const r = parseSave({
      ownedSkins: ['kid'],
      cosmetics: { owned: ['tint:kid:ember', 'trail:amber', 'tint:cat:violet', 'bogus', 7, 'trail:amber'],
        tint: { kid: 'tint:kid:ember', cat: 'tint:cat:violet' }, trail: 'ring:amber', ring: 'ring:amber', frame: 7 },
    });
    expect(r.cosmetics).toEqual({
      owned: ['tint:kid:ember', 'trail:amber', 'tint:cat:violet'], tint: { kid: 'tint:kid:ember' }, trail: null, ring: null, frame: null,
    });
  });

  it('watchSave reports a save written by another tab (and ignores other keys / garbage)', () => {
    const target = new EventTarget();
    const seen: number[] = [];
    const stop = watchSave((s) => seen.push(s.coins), target);
    const fire = (key: string, newValue: string | null) => {
      const e = new Event('storage');
      Object.assign(e, { key, newValue });
      target.dispatchEvent(e);
    };
    fire(KEY, JSON.stringify({ ...defaultSave(), coins: 12 }));
    fire('other', JSON.stringify({ ...defaultSave(), coins: 99 }));
    fire(LEGACY, JSON.stringify({ ...defaultSave(), coins: 98 })); // an old-build tab writing v1 is not our save
    fire(KEY, '{bad');
    fire(KEY, null);
    stop();
    fire(KEY, JSON.stringify({ ...defaultSave(), coins: 13 }));
    expect(seen).toEqual([12]);
  });

  it('tutorialSteps: known steps only, unique, in teaching order; missing → []', () => {
    expect(parseSave({ tutorialSteps: ['lane', 'jump', 'jump', 'fly', 3] }).tutorialSteps).toEqual(['jump', 'lane']);
    expect(parseSave({ tutorialSteps: 'jump' }).tutorialSteps).toEqual([]);
    expect(parseSave({}).tutorialSteps).toEqual([]);
  });

  it('requestPersistentStorage asks the browser once', () => {
    const persist = vi.fn(async () => true);
    requestPersistentStorage({ storage: { persist } });
    requestPersistentStorage({ storage: { persist } });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

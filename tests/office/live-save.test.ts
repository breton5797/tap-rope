// The live save under 'officeescape.live.v1': round-trips, and a missing / corrupt / foreign / refused store
// always yields a usable save (never throws, never breaks the game).
import { describe, expect, it } from 'vitest';
import {
  LIVE_SAVE_KEY, addDays, applyRun, dailyPlan, emptyLive, equipCosmetic, loadLive, parseLive, saveLive, type LiveRunCounts,
} from '../../src/office/core/live';

const ZERO: LiveRunCounts = { coffee: 0, 'dodge-dinner': 0, docs: 0, perfects: 0, jumps: 0, 'part2-clears': 0, clears: 0 };
const MON = '2026-11-16';

function memory(init: Record<string, string> = {}) {
  const data = { ...init };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}

function played() {
  let live = emptyLive();
  for (let d = 0; d < 5; d += 1) live = applyRun(live, { stageId: dailyPlan(addDays(MON, d), 3).stage.id, cleared: true, score: 900 + d }, { ...ZERO, coffee: 4 }, addDays(MON, d), 3).live;
  return equipCosmetic(live, live.owned[0]);
}

describe('live save', () => {
  it('round-trips under its own key', () => {
    const store = memory();
    const live = played();
    expect(saveLive(live, store)).toBe(true);
    expect(Object.keys(store.data)).toEqual([LIVE_SAVE_KEY]);
    expect(loadLive(store)).toEqual(live);
  });

  it('missing, corrupt, foreign or other-version data gives a fresh save', () => {
    expect(loadLive(memory())).toEqual(emptyLive());
    for (const bad of ['{', 'null', '[]', '42', '"x"', JSON.stringify({ v: 2, owned: ['trail-rain'] }), JSON.stringify({ hello: 1 })]) {
      expect(loadLive(memory({ [LIVE_SAVE_KEY]: bad })), bad).toEqual(emptyLive());
    }
  });

  it('storage that throws (private mode, quota) never breaks the game', () => {
    const angry = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(loadLive(angry)).toEqual(emptyLive());
    expect(saveLive(played(), angry)).toBe(false);
  });

  it('parseLive keeps what fits and drops what does not', () => {
    const good = played();
    const messy = {
      ...good,
      maxDate: 'yesterday',
      daily: { ...good.daily, 'not-a-date': { cleared: true, best: 1 }, '2026-11-01': { cleared: 'yes', best: 5 } },
      owned: [...good.owned, 'no-such-item', 42],
      equipped: { ...good.equipped, trail: 'no-such-item', hat: 'x' },
      badges: ['2026-11-16', 'soon'],
      ledger: [...good.ledger, 7],
      history: [{ week: '2026-11-09', stamps: 3 }, { week: 'x', stamps: 2 }, { week: '2026-11-02', stamps: 99 }],
      card: { week: '2026-11-16', stamps: [true, 'x'] },
      goal: { week: '2026-11-16', value: -4, done: 'no' },
      themeSeen: { 'monday-blues': '2026-11-16', 'no-theme': '2026-11-16', 'paper-bomb': 'later' },
    };
    const p = parseLive(messy);
    expect(p.maxDate).toBeNull();
    expect(Object.keys(p.daily).sort()).toEqual(Object.keys(good.daily).sort());
    expect(p.owned).toEqual(good.owned);
    expect(p.equipped).toEqual(Object.fromEntries(Object.entries(good.equipped).filter(([k]) => k !== 'trail')));
    expect(p.badges).toEqual(['2026-11-16']);
    expect(p.ledger).toEqual(good.ledger);
    expect(p.history).toEqual([{ week: '2026-11-09', stamps: 3 }]);
    expect(p.card).toBeNull();
    expect(p.goal).toBeNull();
    expect(p.themeSeen).toEqual({ 'monday-blues': '2026-11-16' });
  });

  it('P3: a card week must be a Monday, and badges are Mondays without duplicates', () => {
    const good = played();
    expect(parseLive({ ...good, card: { ...good.card, week: '2026-11-17' } }).card).toBeNull();
    expect(parseLive({ ...good, card: { ...good.card, week: '2026-11-16' } }).card?.week).toBe('2026-11-16');
    expect(parseLive({ ...good, badges: ['2026-11-16', '2026-11-16', '2026-11-18', '2026-11-09'] }).badges).toEqual(['2026-11-16', '2026-11-09']);
    expect(parseLive({ ...good, history: [{ week: '2026-11-10', stamps: 2 }] }).history).toEqual([]);
  });
});

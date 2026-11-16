// @vitest-environment jsdom
// Office live events: the UI view models built on core/live, and the office title wiring (live block,
// rollover on open, rebuild on a date change).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CARD_POINTS, COSMETIC_PRICES, COSMETICS, LIVE_SAVE_KEY, addDays, applyRun, dailyPlan, emptyLive, equipCosmetic, loadLive, rollover, themeOf,
  weekOf, type DateKey, type LiveSave,
} from '../../src/office/core/live';
import { ZERO_COUNTS } from '../../src/office/game/live/counts';
import { lookOf, mallItems, titleLiveModel, weekCardModel } from '../../src/office/ui/live/model';
import { buildTitle } from '../../src/office/ui/title';
import { liveLook } from '../../src/office/render/live-look';
import { defaultSave } from '../../src/core/storage';
import type { SaveData, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';

const WED = '2026-11-18';
const cleared = { 'w1-s10': 3, 'w2-s10': 2 };
const save = (over: Partial<SaveData> = {}): SaveData => ({ ...defaultSave(), stars: cleared, coins: 1000, ...over });
const clearDaily = (live: LiveSave, date: DateKey): LiveSave =>
  applyRun(rollover(live, date), { stageId: dailyPlan(date, 2).stage.id, cleared: true, score: 1000 }, ZERO_COUNTS, date, 2).live;
/** the Monday of the first week from WED whose theme matches */
const weekWith = (id: string): DateKey => {
  for (let i = 0; i < 12; i++) {
    const d = addDays(weekOf(WED), i * 7);
    if (themeOf(d).id === id) return d;
  }
  throw new Error(id);
};

describe('title model', () => {
  it('a fresh day: unlocked, not done, the boss of the day, an empty card, the goal at 0', () => {
    const m = titleLiveModel(rollover(emptyLive(), WED), save(), WED);
    expect(m.unlocked).toBe(true);
    expect(m.dailyDone).toBe(false);
    expect(m.bossName).toBe(dailyPlan(WED, 2).boss.name);
    expect(m.cardCount).toBe(0);
    expect(m.goal).toEqual({ label: themeOf(weekOf(WED)).goal.label, value: 0, target: themeOf(weekOf(WED)).goal.target, done: false });
    expect(m.themeName).toBe(themeOf(weekOf(WED)).name);
    expect(m.newItems).toBeGreaterThan(0);
  });

  it('after today\'s clear: done and stamped; no points: nothing new to buy', () => {
    const live = clearDaily(emptyLive(), WED);
    const m = titleLiveModel(live, save({ coins: 0 }), WED);
    expect(m.dailyDone).toBe(true);
    expect(m.cardCount).toBe(1);
    expect(m.newItems).toBe(0);
  });

  it('stage 1 not cleared: locked, no boss', () => {
    const m = titleLiveModel(emptyLive(), save({ stars: {} }), WED);
    expect(m.unlocked).toBe(false);
    expect(m.bossName).toBe('');
  });

  it('last week\'s card counts as empty this week', () => {
    const live = clearDaily(emptyLive(), addDays(WED, -7));
    expect(titleLiveModel(rollover(live, WED), save(), WED).cardCount).toBe(0);
  });
});

describe('the weekly goal follows the player (pt-casual P1)', () => {
  it('the rain week asks a part-1 player for any 3 clears, a part-2 player for 3 part-2 clears', () => {
    const rain = weekWith('rainy-commute');
    const live = rollover(emptyLive(), rain);
    expect(titleLiveModel(live, save(), rain).goal.label).toBe('단계 3번 클리어');
    expect(weekCardModel(live, rain, 2).goal.label).toBe('단계 3번 클리어');
    const all = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`w${i + 1}-s10`, 1]));
    expect(titleLiveModel(live, save({ stars: all }), rain).goal.label).toBe(themeOf(rain).goal.label);
  });
});

describe('week card model', () => {
  it('slots, today, milestones with points + the theme item + the badge, and the history after a week', () => {
    const lastWeek = clearDaily(clearDaily(emptyLive(), addDays(WED, -7)), addDays(WED, -6));
    const live = clearDaily(rollover(lastWeek, WED), WED);
    const m = weekCardModel(live, WED, 2);
    expect(m.week).toBe('2026-11-16');
    expect(m.lastDay).toBe('2026-11-22');
    expect(m.today).toBe(2);
    expect(m.stamps).toEqual([false, false, true, false, false, false, false]);
    expect(m.milestones.map((x) => x.points)).toEqual([CARD_POINTS[3], CARD_POINTS[5], CARD_POINTS[7]]);
    const themeItem = COSMETICS.find((c) => c.id === themeOf(m.week).goal.cosmetic)?.name;
    expect(m.milestones[1].cosmetic).toBe(themeItem);
    expect(m.milestones[2].badge).toBe(true);
    expect(m.history).toEqual([{ week: '2026-11-09', stamps: 2 }]);
  });
});

describe('mall items and the look', () => {
  it('a theme item is not for sale in its own theme week; owned / equipped / poor / buy', () => {
    const rainWeek = weekWith('rainy-commute');
    const live0 = rollover(emptyLive(), rainWeek);
    const trails = mallItems(live0, 1000, rainWeek, 'trail');
    expect(trails.find((x) => x.item.id === 'trail-rain')?.state).toBe('not-yet');
    expect(trails.find((x) => x.item.id === 'trail-sparkle')?.state).toBe('buy');
    expect(mallItems(live0, 10, rainWeek, 'trail').find((x) => x.item.id === 'trail-sparkle')?.state).toBe('poor');
    const owned = equipCosmetic({ ...live0, owned: ['trail-sparkle', 'trail-confetti'] }, 'trail-sparkle');
    const states = mallItems(owned, 0, rainWeek, 'trail');
    expect(states.find((x) => x.item.id === 'trail-sparkle')?.state).toBe('equipped');
    expect(states.find((x) => x.item.id === 'trail-confetti')?.state).toBe('owned');
  });

  it('the look: equipped trail / jump art and the week\'s rain / clock flags', () => {
    const rainWeek = weekWith('rainy-commute');
    const live = equipCosmetic(equipCosmetic({ ...emptyLive(), owned: ['trail-confetti', 'jump-petal'] }, 'trail-confetti'), 'jump-petal');
    expect(lookOf(live, rainWeek)).toEqual({ trail: 'trail-confetti', jump: 'jump-petal', rain: true, clock: false });
    expect(lookOf(emptyLive(), weekWith('speed-clockout'))).toEqual({ trail: null, jump: null, rain: false, clock: true });
  });
});

describe('office title', () => {
  const ctx = (cb: Partial<UiCallbacks> = {}): Ctx => ({
    cb: new Proxy(cb, { get: (t, k) => (t as Record<string | symbol, unknown>)[k] ?? (() => undefined) }) as UiCallbacks,
    tap: (fn) => fn, reducedMotion: () => true,
  });
  const nav = () => ({
    toStages: vi.fn(), toArchive: vi.fn(), toAchievements: vi.fn(), toLeaderboard: vi.fn(), toShop: vi.fn(), toSettings: vi.fn(),
    toGuide: vi.fn(), toTitle: vi.fn(), adopt: vi.fn(), mount: vi.fn(),
  });

  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 18, 23, 59, 40));
  });
  afterEach(() => vi.useRealTimers());

  it('shows the live block under 출근하기, rolls the live save into today and sets the renderer look', () => {
    const el = buildTitle(ctx(), save(), nav());
    const block = el.querySelector('.live-title');
    expect(block?.getAttribute('data-today')).toBe(WED);
    expect(el.querySelector('.btn--start')?.nextElementSibling).toBe(block);
    expect(block?.querySelector('.live-new')).not.toBeNull();
    expect(loadLive().maxDate).toBe(WED);
    expect(liveLook().trail).toBeNull();
  });

  it('the 오늘의 미션 button starts the daily; card and mall open as their own screens', () => {
    const onStartDaily = vi.fn();
    const n = nav();
    const el = buildTitle(ctx({ onStartDaily }), save(), n);
    (el.querySelector('.live-daily') as HTMLElement).click();
    expect(onStartDaily).toHaveBeenCalledOnce();
    (el.querySelector('.live-cardchip') as HTMLElement).click();
    expect(n.mount.mock.calls[0][1]).toBe('live-card');
    (el.querySelector('.live-mallbtn') as HTMLElement).click();
    expect(n.mount.mock.calls[1][1]).toBe('live-mall');
    expect((n.mount.mock.calls[1][0] as HTMLElement).querySelectorAll('.mall-item').length).toBeGreaterThan(0);
  });

  it('buying in the mall spends the main save\'s points, owns + equips the item and updates the look', () => {
    const trail = COSMETIC_PRICES.trail;
    let main = save({ coins: trail + 100 });
    const onMetaUpdate = (u: (s: SaveData) => SaveData | null): SaveData | null => {
      const next = u(main);
      if (next) main = next;
      return next;
    };
    const n = nav();
    const el = buildTitle(ctx({ onMetaUpdate }), main, n);
    (el.querySelector('.live-mallbtn') as HTMLElement).click();
    const mall = n.mount.mock.calls[0][0] as HTMLElement;
    const tapTwice = (id: string): void => {
      (mall.querySelector(`.mall-item[data-id="${id}"] button`) as HTMLElement).click();
      (mall.querySelector(`.mall-item[data-id="${id}"] button`) as HTMLElement).click();
    };
    tapTwice('trail-sparkle');
    expect(main.coins).toBe(100);
    expect(n.adopt).toHaveBeenCalledWith(main);
    expect(loadLive().equipped.trail).toBe('trail-sparkle');
    expect(liveLook().trail).toBe('trail-sparkle');
    expect(mall.querySelector('.mall-status')?.textContent).toBe('반짝 잔상 교환 완료!');
    expect(mall.querySelector('.mall-item[data-id="trail-sparkle"]')?.classList.contains('is-equipped')).toBe(true);
    // not enough left for another trail: refused, nothing spent
    (mall.querySelector('.mall-item[data-id="trail-confetti"] button') as HTMLElement).click(); // too few points: refused at the first tap
    expect(main.coins).toBe(100);
    expect(mall.querySelector('.mall-status')?.textContent).toBe('포인트가 모자라요');
  });

  it('a date change while the title is up rebuilds it; the rebuilt title says it is a new day', () => {
    const n = nav();
    const el = buildTitle(ctx(), save(), n);
    document.body.appendChild(el);
    vi.advanceTimersByTime(30_000);
    expect(n.toTitle).toHaveBeenCalledOnce();
    el.remove();
    const next = buildTitle(ctx(), save(), n);
    expect(next.querySelector('.live-title')?.getAttribute('data-today')).toBe('2026-11-19');
    expect(next.querySelector('.live-title__newday')).not.toBeNull();
    // the same day again: no note
    expect(buildTitle(ctx(), save(), n).querySelector('.live-title__newday')).toBeNull();
  });

  it('a corrupt live save never breaks the title', () => {
    localStorage.setItem(LIVE_SAVE_KEY, '{nope');
    const el = buildTitle(ctx(), save(), nav());
    expect(el.querySelector('.btn--start')).not.toBeNull();
    expect(el.querySelector('.live-title')).not.toBeNull();
  });
});

describe('review fixes: purchase atomicity, date watcher cleanup', () => {
  const ctx = (cb: Partial<UiCallbacks> = {}): Ctx => ({
    cb: new Proxy(cb, { get: (t, k) => (t as Record<string | symbol, unknown>)[k] ?? (() => undefined) }) as UiCallbacks,
    tap: (fn) => fn, reducedMotion: () => true,
  });
  const nav = () => ({
    toStages: vi.fn(), toArchive: vi.fn(), toAchievements: vi.fn(), toLeaderboard: vi.fn(), toShop: vi.fn(), toSettings: vi.fn(),
    toGuide: vi.fn(), toTitle: vi.fn(), adopt: vi.fn(), mount: vi.fn(),
  });
  const openMall = (onMetaUpdate: UiCallbacks['onMetaUpdate']) => {
    const n = nav();
    const el = buildTitle(ctx({ onMetaUpdate }), save({ coins: 1000 }), n);
    (el.querySelector('.live-mallbtn') as HTMLElement).click();
    return n.mount.mock.calls[0][0] as HTMLElement;
  };
  const buy = (mall: HTMLElement): void => {
    (mall.querySelector('.mall-item[data-id="trail-sparkle"] button') as HTMLElement).click();
    (mall.querySelector('.mall-item[data-id="trail-sparkle"] button') as HTMLElement).click();
  };

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 18, 12, 0, 0));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('the main save refusing the payment leaves the item unbought', () => {
    const mall = openMall(() => null);
    buy(mall);
    expect(loadLive().owned).not.toContain('trail-sparkle');
    expect(mall.querySelector('.mall-status')?.textContent).toBe('저장할 수 없어요. 저장 공간을 확인해 주세요.');
  });

  it('the live save refusing the item refunds the points', () => {
    let main = save({ coins: 1000 });
    const onMetaUpdate = (u: (s: SaveData) => SaveData | null): SaveData | null => {
      const next = u(main);
      if (next) main = next;
      return next;
    };
    const mall = openMall(onMetaUpdate);
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === LIVE_SAVE_KEY) throw new Error('quota');
      real.call(this, k, v);
    });
    buy(mall);
    expect(main.coins).toBe(1000);
    expect(loadLive().owned).not.toContain('trail-sparkle');
    expect(mall.querySelector('.mall-status')?.textContent).toBe('저장할 수 없어요. 저장 공간을 확인해 주세요.');
  });

  it('leaving the title before the first date check stops the watcher (no timer or listener left behind)', () => {
    const clear = vi.spyOn(window, 'clearInterval');
    const remove = vi.spyOn(document, 'removeEventListener');
    const el = buildTitle(ctx(), save(), nav());
    document.body.appendChild(el);
    el.remove(); // left within 30 s
    vi.advanceTimersByTime(30_000);
    expect(clear).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});

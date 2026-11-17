// Office title (swaps src/ui/title.ts): the v8 title plus the live events block under 출근하기 (spec §5) —
// 오늘의 미션, this week's card, the weekly goal and the 복지몰's new items — and the live screens it opens
// (주간 출근 카드, 사원 복지몰). Opening the title rolls the live save into today (core/live `rollover`); a date
// change while it is up rebuilds it with the new day's mission.
import { buildTitle as v8Title, type TitleNav } from '../../ui/title';
import type { SaveData } from '../../types';
import { h, type Ctx } from '../../ui/dom';
import {
  buyCosmetic, cosmeticById, dailyUnlocked, grantPassItems, themeOf, weekOf, equipCosmetic, loadLive, progressTier, rollover, saveLive, todayKey, type Cosmetic,
  type CosmeticCategory, type DateKey, type LiveSave,
} from '../core/live';
import { setLiveLook } from '../render/live-look';
import { LIVE_COPY, fillLive } from './live/copy';
import { buildMall, type MallActions } from './live/mall';
import { collection, equippedSprite, lookOf, mallItems, titleLiveModel, unequip, weekCardModel } from './live/model';
import { titleLiveBlock } from './live/title-block';
import { monetization } from '../monetization/runtime';
import { passCard } from './monetization/pass-card';
import { buildWeekCardScreen } from './live/week-card';
import '../styles/live.css';

export { artImage, coinChip, type TitleNav } from '../../ui/title';

/** how often the title checks the date while it is up (ms) */
const DATE_CHECK_MS = 30_000;
/** the date the title last showed (a different one = a new day since: say so once) */
let shownDay: DateKey | null = null;

/** a 칼퇴 패스 holder owns the pass cosmetics (granted on the title and after a purchase / restore) */
function syncPassItems(): void {
  if (!monetization().passOwned()) return;
  const cur = loadLive();
  const next = grantPassItems(cur);
  if (next !== cur) saveLive(next);
}

/** the live save rolled into `today` (written back when it changed) */
export function liveFor(today: DateKey): LiveSave {
  const loaded = loadLive();
  const live = rollover(loaded, today);
  if (live !== loaded) saveLive(live);
  return live;
}

function mallActions(ctx: Ctx, nav: TitleNav, today: DateKey, coins: () => number, setCoins: (s: SaveData) => void): MallActions {
  return {
    view: (category: CosmeticCategory) => {
      const live = loadLive();
      const c = collection(live);
      return { coins: coins(), themeName: themeOf(weekOf(today)).name, items: mallItems(live, coins(), today, category, monetization().passAvailable), owned: c.owned, total: c.total };
    },
    buy: (id: string) => {
      // atomic: the points are taken from the main save first (null = refused or not written), then the item
      // goes into the live save; if that write fails the points are given back
      const pending: { live: LiveSave | null; cost: number; refused: string | null } = { live: null, cost: 0, refused: null };
      const next = ctx.cb.onMetaUpdate?.((cur) => {
        const r = buyCosmetic(loadLive(), id, cur.coins, today);
        if (!r.ok) {
          pending.refused = r.reason === 'poor' ? LIVE_COPY.poor : r.reason === 'not-yet' ? fillLive(LIVE_COPY.notYet, { theme: themeOf(weekOf(today)).name }) : '';
          return null;
        }
        pending.live = equipCosmetic(r.live, id);
        pending.cost = r.cost;
        return { ...cur, coins: cur.coins - r.cost };
      }) ?? null;
      if (!next) return pending.refused ?? LIVE_COPY.saveFailed;
      if (!pending.live || !saveLive(pending.live)) {
        const refunded = ctx.cb.onMetaUpdate?.((cur) => ({ ...cur, coins: cur.coins + pending.cost })) ?? next;
        setCoins(refunded);
        nav.adopt?.(refunded);
        return LIVE_COPY.saveFailed;
      }
      setLiveLook(lookOf(pending.live, today));
      setCoins(next);
      nav.adopt?.(next);
      ctx.cb.onUiSfx?.('powerup');
      return fillLive(LIVE_COPY.bought, { name: cosmeticById(id)?.name ?? '' });
    },
    equip: (item: Cosmetic | null, category: CosmeticCategory) => {
      const cur = loadLive();
      const live = item ? equipCosmetic(cur, item.id) : unequip(cur, category);
      if (saveLive(live)) setLiveLook(lookOf(live, today));
    },
  };
}

export function buildTitle(ctx: Ctx, save: SaveData, nav: TitleNav, today: DateKey = todayKey(new Date())): HTMLElement {
  const el = v8Title(ctx, save, nav, today);
  try {
    addLive(el, ctx, save, nav, today);
  } catch (e) {
    // the title always works: a live-events failure only hides its block (reported, never thrown at boot)
    console.error('live events: title block unavailable', e);
  }
  return el;
}

function addLive(el: HTMLElement, ctx: Ctx, save: SaveData, nav: TitleNav, today: DateKey): void {
  // the first title starts the ad consent flow and the pass check (monetization runtime); pass items follow the pass
  syncPassItems();
  void monetization().ready.then(syncPassItems);
  const live = liveFor(today);
  setLiveLook(lookOf(live, today));
  const newDay = shownDay !== null && shownDay !== today;
  shownDay = today;
  let coins = save.coins;
  const unlocked = dailyUnlocked(progressTier(save.stars));
  const back = (): void => nav.toTitle?.();
  const openCard = (): void => {
    const screen = buildWeekCardScreen(ctx, weekCardModel(loadLive(), today, progressTier(save.stars)), {
      stampKey: equippedSprite(loadLive(), 'stamp'), dailyOpen: unlocked, onPlay: () => ctx.cb.onStartDaily(), onBack: back,
    });
    nav.mount?.(screen, 'live-card');
  };
  const openMall = (): void => {
    const actions = mallActions(ctx, nav, today, () => coins, (s) => { coins = s.coins; });
    const footer = (rerender: () => void): HTMLElement | null => passCard(ctx, { m: monetization(), onOwned: () => { syncPassItems(); rerender(); } });
    nav.mount?.(buildMall(ctx, actions, back, 'trail', footer), 'live-mall');
  };
  const block = titleLiveBlock(ctx, titleLiveModel(live, save, today), {
    onDaily: () => ctx.cb.onStartDaily(), onCard: openCard, onMall: openMall,
  });
  if (newDay) block.prepend(h('p', { cls: 'live-title__newday', attrs: { role: 'status' }, text: LIVE_COPY.newDay }));
  const start = el.querySelector('.btn--start');
  if (start) start.after(block);
  else el.querySelector('.title__menu')?.appendChild(block);
  watchDate(el, today, back);
}

/** while the title is up: a new local date rebuilds it (checked every DATE_CHECK_MS and when the app comes back) */
function watchDate(el: HTMLElement, today: DateKey, rebuild: () => void): void {
  const check = (): void => {
    // the title was left (or replaced): stop watching, so no timer, listener or detached title stays alive
    if (!el.isConnected) {
      stop();
      return;
    }
    if (todayKey(new Date()) !== today) {
      stop();
      rebuild();
    }
  };
  const onVisible = (): void => {
    if (!document.hidden) check();
  };
  const timer = window.setInterval(check, DATE_CHECK_MS);
  document.addEventListener('visibilitychange', onVisible);
  const stop = (): void => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

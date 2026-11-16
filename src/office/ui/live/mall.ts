// Office live events: 사원 복지몰 (spec §4) — cosmetics for 칼퇴 포인트 at fixed prices (no randomness), one
// equipped per category, and the 도감 count. Purchases and equips go through `MallActions` (the title wires
// them to core/live + the main save); the screen redraws itself from `view` after each one.
import { button, formatNumber, h, header, type Ctx } from '../../../ui/dom';
import { icons } from '../../../ui/icons';
import { coinChip } from '../../../ui/title';
import type { Cosmetic, CosmeticCategory } from '../../core/live';
import { CATEGORY_NAMES, LIVE_COPY, fillLive } from './copy';
import type { MallItem } from './model';
import { SHOP_HEADER, liveArt, stampMark } from './parts';

export const MALL_TABS: readonly CosmeticCategory[] = ['trail', 'jump', 'stamp', 'cardTheme'];

export interface MallView {
  readonly coins: number;
  /** this week's theme (its event item is sold from next week) */
  readonly themeName: string;
  readonly items: readonly MallItem[];
  readonly owned: number;
  readonly total: number;
}

export interface MallActions {
  view(category: CosmeticCategory): MallView;
  /** null = done, else the message to show */
  buy(id: string): string | null;
  equip(item: Cosmetic | null, category: CosmeticCategory): void;
}

function swatch(c: Cosmetic): HTMLElement {
  if (c.category === 'stamp') return stampMark(c.sprite, 'mall-item__stamp');
  const box = h('span', { cls: `mall-item__art mall-art--${c.category} mall-art--${c.sprite}`, attrs: { 'aria-hidden': 'true' } });
  const img = h('img', { attrs: { src: `./art/cosmetic/${c.sprite}.webp`, alt: '', decoding: 'async', draggable: 'false' } });
  img.addEventListener('load', () => box.classList.add('has-art'));
  img.addEventListener('error', () => img.remove());
  box.appendChild(img);
  return box;
}

interface Pick {
  /** the item asked about (the first tap on its price): the second tap exchanges */
  selected: string | null;
}

function action(ctx: Ctx, it: MallItem, v: MallView, pick: Pick, act: (fn: () => string | null | void) => void, actions: MallActions): HTMLElement {
  const c = it.item;
  switch (it.state) {
    case 'equipped':
      return button({ label: LIVE_COPY.unequip, variant: 'glass', size: 'sm', aria: `${c.name} ${LIVE_COPY.unequip}`, onPress: ctx.tap(() => act(() => actions.equip(null, c.category))) });
    case 'owned':
      return button({ label: LIVE_COPY.equip, variant: 'mint', size: 'sm', aria: `${c.name} ${LIVE_COPY.equip}`, onPress: ctx.tap(() => act(() => actions.equip(c, c.category))) });
    case 'not-yet':
      return h('span', { cls: 'mall-item__later', text: fillLive(LIVE_COPY.notYet, { theme: v.themeName }) });
    default: {
      const poor = it.state === 'poor';
      if (pick.selected === c.id && !poor) {
        const confirm = button({
          label: fillLive(LIVE_COPY.exchange, { price: formatNumber(c.price) }), variant: 'sun', size: 'sm', cls: 'mall-item__confirm',
          aria: fillLive(LIVE_COPY.buyAria, { name: c.name, price: c.price }),
          onPress: ctx.tap(() => act(() => {
            pick.selected = null;
            return actions.buy(c.id);
          })),
        });
        confirm.dataset.autofocus = '';
        return confirm;
      }
      return button({
        label: formatNumber(c.price), variant: poor ? 'glass' : 'sun', size: 'sm', icon: icons.coin(), cls: poor ? 'is-poor' : '',
        aria: `${c.name} ₵${c.price}`,
        onPress: ctx.tap(() => act(() => {
          if (poor) return LIVE_COPY.poor;
          pick.selected = c.id;
          return null;
        })),
      });
    }
  }
}

export function buildMall(ctx: Ctx, actions: MallActions, onBack: () => void, first: CosmeticCategory = 'trail'): HTMLElement {
  let tab = first;
  const pick: Pick = { selected: null };
  const chip = h('div', { cls: 'shop__chip' });
  const tabs = h('div', { cls: 'mall-tabs', attrs: { role: 'tablist' } });
  const list = h('ul', { cls: 'mall-list', attrs: { role: 'tabpanel' } });
  const dex = h('div', { cls: 'mall-dex mono' });
  const status = h('p', { cls: 'mall-status', attrs: { role: 'status', 'aria-live': 'polite' } });
  const render = (): void => {
    const v = actions.view(tab);
    chip.replaceChildren(coinChip(v.coins));
    dex.textContent = fillLive(LIVE_COPY.mallCollection, { n: v.owned, total: v.total });
    tabs.replaceChildren(...MALL_TABS.map((t) => {
      const b = button({ label: CATEGORY_NAMES[t], variant: t === tab ? 'sun' : 'glass', size: 'sm', cls: `mall-tab${t === tab ? ' is-on' : ''}`, onPress: ctx.tap(() => { tab = t; pick.selected = null; status.textContent = ''; render(); }) });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t === tab));
      b.dataset.tab = t;
      return b;
    }));
    list.replaceChildren(...v.items.map((it) => h('li', {
      cls: `mall-item card is-${it.state}${it.item.theme ? ' is-theme' : ''}${pick.selected === it.item.id ? ' is-selected' : ''}`, attrs: { 'data-id': it.item.id },
    }, [
      swatch(it.item),
      h('span', { cls: 'mall-item__name', text: it.item.name }),
      it.item.theme ? h('span', { cls: 'mall-item__tag', text: LIVE_COPY.themeItem }) : null,
      it.state === 'equipped' ? h('span', { cls: 'mall-item__on' }, [icons.check(), h('span', { text: LIVE_COPY.equipped })]) : null,
      action(ctx, it, v, pick, act, actions),
    ])));
  };
  const act = (fn: () => string | null | void): void => {
    status.textContent = fn() ?? '';
    render();
  };
  render();
  return h('section', { cls: 'screen screen--mall', attrs: { 'aria-label': LIVE_COPY.mallTitle } }, [
    header(ctx, LIVE_COPY.mallTitle, onBack, [chip], icons.back()),
    h('div', { cls: 'scroll mall' }, [
      liveArt(SHOP_HEADER, 'mall-banner'),
      h('p', { cls: 'mall-hint', text: LIVE_COPY.mallHint }),
      dex,
      tabs,
      status,
      list,
    ]),
  ]);
}

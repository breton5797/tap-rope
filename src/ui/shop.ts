// Loadout room (장비실): the deployed operator plus a grid of operators to acquire with funds (₵).
import { SKINS } from '../core/content';
import type { SaveData, SkinMeta } from '../types';
import { button, formatNumber, h, header, type Ctx } from './dom';
import { avatar } from './avatar';
import { icons } from './icons';
import { coinChip } from './title';

function priceAction(ctx: Ctx, save: SaveData, skin: SkinMeta): HTMLElement {
  const owned = save.ownedSkins.includes(skin.id);
  if (save.skin === skin.id) {
    return h('div', { cls: 'skin__state', attrs: { 'aria-label': '배치 중' } }, [icons.check(), h('span', { text: '배치 중' })]);
  }
  if (owned) {
    return button({ label: '배치', variant: 'mint', size: 'sm', aria: `${skin.name} 배치`, onPress: ctx.tap(() => ctx.cb.onSelectSkin(skin.id)) });
  }
  const affordable = save.coins >= skin.price;
  return button({
    label: formatNumber(skin.price),
    aria: `${skin.name} 자금 ${skin.price}으로 확보`,
    variant: affordable ? 'sun' : 'glass',
    size: 'sm',
    icon: icons.coin(),
    cls: affordable ? '' : 'is-poor',
    onPress: ctx.tap(() => ctx.cb.onBuySkin(skin.id)),
  });
}

function skinCard(ctx: Ctx, save: SaveData, skin: SkinMeta): HTMLElement {
  const owned = save.ownedSkins.includes(skin.id);
  const selected = save.skin === skin.id;
  return h('article', { cls: `skin card${selected ? ' is-selected' : ''}${owned ? ' is-owned' : ' is-locked'}` }, [
    h('div', { cls: 'skin__art' }, [avatar(skin.id), owned ? null : h('span', { cls: 'skin__lock' }, [icons.lock()])]),
    h('div', { cls: 'skin__name', text: skin.name }),
    priceAction(ctx, save, skin),
  ]);
}

export function buildShop(ctx: Ctx, save: SaveData, onBack: () => void): HTMLElement {
  const current = SKINS.find((s) => s.id === save.skin) ?? SKINS[0];
  const owned = SKINS.filter((s) => save.ownedSkins.includes(s.id)).length;
  return h('section', { cls: 'screen screen--shop', attrs: { 'aria-label': '장비실' } }, [
    header(ctx, '장비실', onBack, [coinChip(save.coins)], icons.back()),
    h('div', { cls: 'scroll' }, [
      h('div', { cls: 'shop__hero card' }, [
        h('div', { cls: 'shop__stage' }, [current ? avatar(current.id, false) : null, h('div', { cls: 'shop__floor' })]),
        h('div', { cls: 'shop__info' }, [
          h('div', { cls: 'kicker', text: 'DEPLOYED OPERATOR' }),
          h('div', { cls: 'shop__name', text: current?.name ?? '' }),
          h('div', { cls: 'shop__count mono', text: `ROSTER ${owned}/${SKINS.length}` }),
        ]),
      ]),
      h('div', { cls: 'shop__grid' }, SKINS.map((s) => skinCard(ctx, save, s))),
      h('p', { cls: 'shop__hint', text: '작전 성공 시 자금(₵) 지급. 자금으로 요원을 확보한다.' }),
    ]),
  ]);
}

// Loadout room (장비실): the deployed operator plus a grid of operators to acquire with funds (₵).
// v8: big operator portraits (./art/op-<skin>.webp, vector avatar fallback) and cosmetics — colour variants
// per operator, laser-trail / landing-ring colours and result-card frames (core/economy).
import { SKINS } from '../core/content';
import { watchSave } from '../core/storage';
import { COSMETICS, buyCosmetic, equipCosmetic, type Cosmetic, type CosmeticKind } from '../core/economy';
import { FEATURES } from '../flavor';
import type { SaveData, SkinMeta } from '../types';
import { button, formatNumber, h, header, type Ctx } from './dom';
import { avatar } from './avatar';
import { icons } from './icons';
import { coinChip } from './title';

/** portrait photo over the vector avatar: the avatar shows while loading or when the file is missing */
function portrait(id: SkinMeta['id'], cls: string): HTMLElement {
  const img = h('img', { cls: 'portrait__img', attrs: { src: `./art/op-${id}.webp`, alt: '', decoding: 'async', draggable: 'false' } });
  const box = h('div', { cls: `portrait ${cls}` }, [avatar(id, false), img]);
  img.addEventListener('load', () => box.classList.add('has-photo'));
  img.addEventListener('error', () => img.remove());
  return box;
}

function priceAction(ctx: Ctx, save: SaveData, skin: SkinMeta): HTMLElement | null {
  const owned = save.ownedSkins.includes(skin.id);
  if (save.skin === skin.id) {
    return h('div', { cls: 'skin__state', attrs: { 'aria-label': '배치 중' } }, [icons.check(), h('span', { text: '배치 중' })]);
  }
  if (owned) {
    return button({ label: '배치', variant: 'mint', size: 'sm', aria: `${skin.name} 배치`, onPress: ctx.tap(() => ctx.cb.onSelectSkin(skin.id)) });
  }
  if (!FEATURES.shop && skin.price > 0) return null; // builds without purchases only hand out free operators
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
    h('div', { cls: 'skin__art' }, [portrait(skin.id, 'portrait--card'), owned ? null : h('span', { cls: 'skin__lock' }, [icons.lock()])]),
    h('div', { cls: 'skin__name', text: skin.name }),
    priceAction(ctx, save, skin),
  ]);
}

interface CosmeticSection {
  readonly kind: CosmeticKind;
  readonly title: string;
  readonly hint: string;
}

const SECTIONS: readonly CosmeticSection[] = [
  { kind: 'tint', title: '색상 변형', hint: '배치 중인 요원의 장비 포인트 색' },
  { kind: 'trail', title: '레이저 잔상', hint: '점프·이동 잔상 색' },
  { kind: 'ring', title: '착지 링', hint: '착지할 때 퍼지는 링 색' },
  { kind: 'frame', title: '보고서 프레임', hint: '작전 보고서·공유 카드 테두리' },
];

const equippedId = (save: SaveData, kind: CosmeticKind): string | null =>
  kind === 'tint' ? save.cosmetics.tint[save.skin] ?? null : save.cosmetics[kind];

/** a cosmetic change as a function of the CURRENT save (null = not affordable) */
type Update = (current: SaveData) => SaveData | null;

function cosmeticItem(ctx: Ctx, save: SaveData, c: Cosmetic, apply: (update: Update) => void): HTMLElement {
  const owned = save.cosmetics.owned.includes(c.id);
  const on = equippedId(save, c.kind) === c.id;
  const action = on
    ? button({ label: '해제', variant: 'glass', size: 'sm', aria: `${c.name} 해제`, onPress: ctx.tap(() => apply((cur) => equipCosmetic(cur, null, c.kind, c.skin))) })
    : owned
      ? button({ label: '장착', variant: 'mint', size: 'sm', aria: `${c.name} 장착`, onPress: ctx.tap(() => apply((cur) => equipCosmetic(cur, c.id))) })
      : button({
        label: formatNumber(c.price), variant: save.coins >= c.price ? 'sun' : 'glass', size: 'sm', icon: icons.coin(),
        cls: save.coins >= c.price ? '' : 'is-poor', aria: `${c.name} 자금 ${c.price}으로 구매`,
        onPress: ctx.tap(() => apply((cur) => {
          const bought = buyCosmetic(cur, c.id);
          return bought ? equipCosmetic(bought, c.id) : null;
        })),
      });
  return h('li', { cls: `cos${on ? ' is-on' : ''}` }, [
    h('span', { cls: `cos__swatch cos__swatch--${c.kind}`, style: { '--swatch': c.color }, attrs: { 'aria-hidden': 'true' } }),
    h('span', { cls: 'cos__name', text: c.name }),
    action,
  ]);
}

function cosmetics(ctx: Ctx, save: SaveData, apply: (update: Update) => void): HTMLElement {
  return h('div', { cls: 'cosmetics' }, SECTIONS.map((s) => {
    const items = COSMETICS.filter((c) => c.kind === s.kind && (s.kind !== 'tint' || c.skin === save.skin));
    return h('section', { cls: 'cos-group card', attrs: { 'aria-label': s.title } }, [
      h('div', { cls: 'cos-group__head' }, [
        h('h2', { cls: 'cos-group__title', text: s.title }),
        h('span', { cls: 'cos-group__hint', text: s.hint }),
      ]),
      h('ul', { cls: 'cos-list' }, items.map((c) => cosmeticItem(ctx, save, c, apply))),
    ]);
  }));
}

/** onLocalChange keeps the menu's copy of the save current (like buildSettings) */
export function buildShop(ctx: Ctx, initial: SaveData, onBack: () => void, onLocalChange?: (s: SaveData) => void): HTMLElement {
  const chip = h('div', { cls: 'shop__chip' });
  const body = h('div', { cls: 'scroll' });
  const status = h('p', { cls: 'shop__status', attrs: { role: 'status', 'aria-live': 'polite' } });
  const section = h('section', { cls: 'screen screen--shop', attrs: { 'aria-label': '장비실' } });
  const adopt = (next: SaveData): void => {
    onLocalChange?.(next);
    render(next);
  };
  const render = (save: SaveData): void => {
    const current = SKINS.find((s) => s.id === save.skin) ?? SKINS[0];
    const owned = SKINS.filter((s) => save.ownedSkins.includes(s.id)).length;
    // the change runs against the app's CURRENT save (UiCallbacks.onMetaUpdate), never this screen's copy,
    // so progress another tab wrote meanwhile is kept; we redraw in place with the result
    const apply = (update: Update): void => {
      const next = ctx.cb.onMetaUpdate ? ctx.cb.onMetaUpdate(update) : update(save);
      if (!next) {
        status.textContent = '자금이 부족해요';
        return;
      }
      status.textContent = '';
      adopt(next);
    };
    chip.replaceChildren(coinChip(save.coins));
    body.replaceChildren(
      h('div', { cls: 'shop__hero card' }, [
        h('div', { cls: 'shop__stage' }, [portrait(current.id, 'portrait--hero'), h('div', { cls: 'shop__floor' })]),
        h('div', { cls: 'shop__info' }, [
          h('div', { cls: 'kicker', text: 'DEPLOYED OPERATOR' }),
          h('div', { cls: 'shop__name', text: current.name }),
          h('div', { cls: 'shop__count mono', text: `ROSTER ${owned}/${SKINS.length}` }),
        ]),
      ]),
      h('div', { cls: 'shop__grid' }, SKINS.map((s) => skinCard(ctx, save, s))),
      ...(FEATURES.shop ? [
        h('h2', { cls: 'shop__section kicker', text: 'COSMETICS // 외형' }),
        status,
        cosmetics(ctx, save, apply),
        h('p', { cls: 'shop__hint', text: '첫 클리어·새 별·업적·연속 일일 작전으로 자금(₵)을 받는다. 외형은 성능에 영향이 없다.' }),
      ] : []),
    );
  };
  render(initial);
  // another tab wrote the save: show its coins / roster (stops listening once this screen is gone)
  const stop = watchSave((s) => {
    if (section.isConnected) adopt(s);
    else stop();
  });
  section.append(header(ctx, '장비실', onBack, [chip], icons.back()), body);
  return section;
}

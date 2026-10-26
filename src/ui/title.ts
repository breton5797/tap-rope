// Title screen: key art (./art/title.webp, dark gradient fallback), wordmark and the operations menu.
import type { SaveData } from '../types';
import { button, formatNumber, h, type Ctx } from './dom';
import { icons } from './icons';

export interface TitleNav {
  readonly toStages: () => void;
  readonly toShop: () => void;
  readonly toSettings: () => void;
  readonly toGuide: () => void;
}

/** "₵ 1,280" funds chip. */
export function coinChip(coins: number, extraCls = ''): HTMLElement {
  return h('div', { cls: `chip chip--coin ${extraCls}`.trim(), attrs: { 'aria-label': `자금 ${coins}` } }, [
    icons.coin(),
    h('span', { cls: 'chip__value', text: formatNumber(coins) }),
  ]);
}

/**
 * Photographic art behind a screen or card. The gradient underneath shows while it loads, and stays
 * (the <img> removes itself) when the file is missing.
 */
export function artImage(src: string, cls: string): HTMLElement {
  const img = h('img', { cls: 'art__img', attrs: { src, alt: '', decoding: 'async', draggable: 'false' } });
  img.addEventListener('load', () => img.classList.add('is-loaded'));
  img.addEventListener('error', () => img.remove());
  return h('div', { cls: `art ${cls}`, attrs: { 'aria-hidden': 'true' } }, [img]);
}

function logo(): HTMLElement {
  return h('div', { cls: 'logo', attrs: { role: 'img', 'aria-label': 'LASER ESCAPE 레이저 탈출작전' } }, [
    h('div', { cls: 'logo__code mono', text: 'OP. LE-06 // CLASSIFIED' }),
    h('div', { cls: 'logo__word mono' }, [h('span', { text: 'LASER' }), h('span', { cls: 'logo__word2', text: 'ESCAPE' })]),
    h('div', { cls: 'logo__ko', text: '레이저 탈출작전' }),
    h('i', { cls: 'logo__beam' }),
  ]);
}

function modeButtons(ctx: Ctx, save: SaveData): HTMLElement {
  const endlessBest = save.bestScores['endless'] ?? 0;
  return h('div', { cls: 'title__modes' }, [
    button({ label: '일일 작전', sub: '24시간 단일 임무', variant: 'glass', icon: icons.calendar(), cls: 'btn--card', onPress: ctx.tap(() => ctx.cb.onStartDaily()) }),
    button({
      label: '무한 침투',
      sub: endlessBest > 0 ? `최고 ${formatNumber(endlessBest)}` : '제한 없음',
      variant: 'glass',
      icon: icons.infinity(),
      cls: 'btn--card',
      onPress: ctx.tap(() => ctx.cb.onStartEndless()),
    }),
  ]);
}

export function buildTitle(ctx: Ctx, save: SaveData, nav: TitleNav): HTMLElement {
  return h('section', { cls: 'screen screen--title', attrs: { 'aria-label': '타이틀' } }, [
    artImage('./art/title.webp', 'art--title'),
    h('div', { cls: 'title__top' }, [
      button({ label: '작전 교범', variant: 'glass', size: 'sm', icon: icons.book(), cls: 'btn--guide', onPress: ctx.tap(nav.toGuide) }),
      coinChip(save.coins),
    ]),
    h('div', { cls: 'title__hero' }, [logo()]),
    h('div', { cls: 'title__menu' }, [
      button({ label: '작전 개시', variant: 'sun', size: 'lg', icon: icons.play(), cls: 'btn--start', onPress: ctx.tap(nav.toStages) }),
      modeButtons(ctx, save),
      h('div', { cls: 'row' }, [
        button({ label: '장비실', variant: 'glass', icon: icons.bag(), onPress: ctx.tap(nav.toShop) }),
        button({ label: '설정', variant: 'glass', icon: icons.gear(), onPress: ctx.tap(nav.toSettings) }),
      ]),
    ]),
  ]);
}

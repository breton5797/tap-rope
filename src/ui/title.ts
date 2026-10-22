// Title screen: animated logo, rope motif and the main menu.
import type { SaveData } from '../types';
import { button, formatNumber, h, svg, type Ctx } from './dom';
import { icons } from './icons';

export interface TitleNav {
  readonly toStages: () => void;
  readonly toShop: () => void;
  readonly toSettings: () => void;
}

export function coinChip(coins: number, extraCls = ''): HTMLElement {
  return h('div', { cls: `chip chip--coin ${extraCls}`.trim(), attrs: { 'aria-label': `코인 ${coins}` } }, [
    icons.coin(),
    h('span', { cls: 'chip__value', text: formatNumber(coins) }),
  ]);
}

function ropeMotif(): SVGElement {
  const grad = svg('linearGradient', { id: 'rope-grad', x1: 0, y1: 0, x2: 1, y2: 0 }, [
    svg('stop', { offset: 0, 'stop-color': '#ff5da2' }),
    svg('stop', { offset: 0.5, 'stop-color': '#ffc93c' }),
    svg('stop', { offset: 1, 'stop-color': '#4fd8ff' }),
  ]);
  return svg('svg', { class: 'logo__rope', viewBox: '0 0 320 200', 'aria-hidden': 'true' }, [
    svg('defs', {}, [grad]),
    svg('g', { class: 'logo__rope-arc' }, [
      svg('path', { d: 'M22 100 Q160 250 298 100', fill: 'none', stroke: 'rgba(0,0,0,.18)', 'stroke-width': 9, 'stroke-linecap': 'round', transform: 'translate(0 6)' }),
      svg('path', { d: 'M22 100 Q160 250 298 100', fill: 'none', stroke: 'url(#rope-grad)', 'stroke-width': 7, 'stroke-linecap': 'round' }),
    ]),
    svg('rect', { x: 10, y: 86, width: 16, height: 30, rx: 8, fill: '#fff', class: 'logo__handle' }),
    svg('rect', { x: 294, y: 86, width: 16, height: 30, rx: 8, fill: '#fff', class: 'logo__handle' }),
  ]);
}

function logo(): HTMLElement {
  const letters = Array.from('탭탭 줄넘기').map((ch, i) =>
    ch === ' '
      ? h('span', { cls: 'logo__space' })
      : h('span', { cls: 'logo__char', text: ch, style: { '--i': String(i) } }),
  );
  return h('div', { cls: 'logo', attrs: { role: 'img', 'aria-label': '탭탭 줄넘기 TAP ROPE' } }, [
    ropeMotif(),
    h('div', { cls: 'logo__word' }, letters),
    h('div', { cls: 'logo__sub' }, [h('span', { text: 'TAP' }), h('i', { cls: 'logo__dot' }), h('span', { text: 'ROPE' })]),
  ]);
}

function modeButtons(ctx: Ctx, save: SaveData): HTMLElement {
  const endlessBest = save.bestScores['endless'] ?? 0;
  return h('div', { cls: 'title__modes' }, [
    button({
      label: '오늘의 도전',
      sub: '매일 새로운 패턴',
      variant: 'pink',
      icon: icons.calendar(),
      cls: 'btn--card',
      onPress: ctx.tap(() => ctx.cb.onStartDaily()),
    }),
    button({
      label: '엔드리스',
      sub: endlessBest > 0 ? `최고 ${formatNumber(endlessBest)}` : '끝없이 도전!',
      variant: 'violet',
      icon: icons.infinity(),
      cls: 'btn--card',
      onPress: ctx.tap(() => ctx.cb.onStartEndless()),
    }),
  ]);
}

export function buildTitle(ctx: Ctx, save: SaveData, nav: TitleNav): HTMLElement {
  return h('section', { cls: 'screen screen--title', attrs: { 'aria-label': '타이틀' } }, [
    h('div', { cls: 'title__top' }, [h('span', { cls: 'title__ver', text: 'v1.0' }), coinChip(save.coins)]),
    h('div', { cls: 'title__hero' }, [logo()]),
    h('div', { cls: 'title__menu scrim' }, [
      button({ label: '시작하기', variant: 'sun', size: 'lg', icon: icons.play(), cls: 'btn--start', onPress: ctx.tap(nav.toStages) }),
      modeButtons(ctx, save),
      h('div', { cls: 'title__row' }, [
        button({ label: '상점', variant: 'glass', icon: icons.bag(), onPress: ctx.tap(nav.toShop) }),
        button({ label: '설정', variant: 'glass', icon: icons.gear(), onPress: ctx.tap(nav.toSettings) }),
      ]),
    ]),
  ]);
}

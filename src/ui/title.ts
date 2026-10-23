// Title screen: neon logo over a laser grid, the agent mascot and the mission menu.
import type { SaveData } from '../types';
import { button, formatNumber, h, svg, type Ctx } from './dom';
import { avatar } from './avatar';
import { icons } from './icons';

export interface TitleNav {
  readonly toStages: () => void;
  readonly toShop: () => void;
  readonly toSettings: () => void;
  readonly toGuide: () => void;
}

export function coinChip(coins: number, extraCls = ''): HTMLElement {
  return h('div', { cls: `chip chip--coin ${extraCls}`.trim(), attrs: { 'aria-label': `코인 ${coins}` } }, [
    icons.coin(),
    h('span', { cls: 'chip__value', text: formatNumber(coins) }),
  ]);
}

/** Laser grid behind the logo: emitters on both walls, beams sweeping up and down. */
function laserMotif(): SVGElement {
  const beam = (y: number, i: number): SVGElement =>
    svg('g', { class: `logo__beam logo__beam--${i}` }, [
      svg('path', { d: `M18 ${y} H302`, stroke: '#ff3b5c', 'stroke-width': 9, opacity: 0.28, 'stroke-linecap': 'round' }),
      svg('path', { d: `M18 ${y} H302`, stroke: '#ffb0bc', 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
    ]);
  const emitter = (x: number): SVGElement[] =>
    [44, 100, 156].map((y) => svg('rect', { x, y: y - 7, width: 12, height: 14, rx: 3, fill: '#2b3866', stroke: '#6fdcff', 'stroke-opacity': 0.5 }));
  return svg('svg', { class: 'logo__lasers', viewBox: '0 0 320 200', 'aria-hidden': 'true' }, [
    beam(44, 0),
    beam(100, 1),
    beam(156, 2),
    ...emitter(6),
    ...emitter(302),
  ]);
}

function logo(save: SaveData): HTMLElement {
  const word = (text: string, cls: string, offset: number): HTMLElement =>
    h('div', { cls: `logo__line ${cls}` }, Array.from(text).map((ch, i) => h('span', { cls: 'logo__char', text: ch, style: { '--i': String(i + offset) } })));
  return h('div', { cls: 'logo', attrs: { role: 'img', 'aria-label': '레이저 탈출작전 LASER ESCAPE' } }, [
    laserMotif(),
    word('레이저', 'logo__line--red', 0),
    word('탈출작전', 'logo__line--white', 3),
    h('div', { cls: 'logo__sub' }, [h('i', { cls: 'logo__dot' }), h('span', { text: 'LASER ESCAPE' })]),
    h('div', { cls: 'logo__agent' }, [avatar(save.skin, false), h('i', { cls: 'logo__shadow' })]),
  ]);
}

function modeButtons(ctx: Ctx, save: SaveData): HTMLElement {
  const endlessBest = save.bestScores['endless'] ?? 0;
  return h('div', { cls: 'title__modes' }, [
    button({
      label: '오늘의 작전',
      sub: '매일 새로운 임무',
      variant: 'violet',
      icon: icons.calendar(),
      cls: 'btn--card',
      onPress: ctx.tap(() => ctx.cb.onStartDaily()),
    }),
    button({
      label: '무한 탈출',
      sub: endlessBest > 0 ? `최고 ${formatNumber(endlessBest)}` : '어디까지 갈까?',
      variant: 'sky',
      icon: icons.infinity(),
      cls: 'btn--card',
      onPress: ctx.tap(() => ctx.cb.onStartEndless()),
    }),
  ]);
}

export function buildTitle(ctx: Ctx, save: SaveData, nav: TitleNav): HTMLElement {
  return h('section', { cls: 'screen screen--title', attrs: { 'aria-label': '타이틀' } }, [
    h('div', { cls: 'title__top' }, [
      button({ label: '기술 도감', variant: 'glass', size: 'sm', icon: icons.book(), cls: 'btn--guide', onPress: ctx.tap(nav.toGuide) }),
      coinChip(save.coins),
    ]),
    h('div', { cls: 'title__hero' }, [logo(save)]),
    h('div', { cls: 'title__menu scrim' }, [
      button({ label: '작전 시작', variant: 'sun', size: 'lg', icon: icons.play(), cls: 'btn--start', onPress: ctx.tap(nav.toStages) }),
      modeButtons(ctx, save),
      h('div', { cls: 'title__row' }, [
        button({ label: '장비실', variant: 'glass', icon: icons.bag(), onPress: ctx.tap(nav.toShop) }),
        button({ label: '설정', variant: 'glass', icon: icons.gear(), onPress: ctx.tap(nav.toSettings) }),
      ]),
    ]),
  ]);
}

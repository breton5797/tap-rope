// 기술 도감: an informational bottom sheet listing every move with its gesture art.
import { button, h, swallowInput, type Ctx } from './dom';
import { icons } from './icons';
import { moveArt } from './move-art';
import { MOVE_ORDER, MOVES, moveGlyph, ROPE_MODE_LABEL } from './moves';

function moveCard(id: (typeof MOVE_ORDER)[number], i: number): HTMLElement {
  const m = MOVES[id];
  return h('article', { cls: `guide__item tone--${m.tone}`, style: { 'animation-delay': `${0.05 + i * 0.04}s` } }, [
    moveArt(id),
    h('div', { cls: 'guide__body' }, [
      h('div', { cls: 'guide__row' }, [
        h('h3', { cls: 'guide__name', text: m.name }),
        h('span', { cls: 'guide__gesture' }, [moveGlyph(id), h('span', { text: m.gesture })]),
      ]),
      h('p', { cls: 'guide__hint', text: m.hint }),
      h('div', { cls: 'guide__modes' }, m.modes.map((mode) => h('span', { cls: `pill pill--${mode}`, text: ROPE_MODE_LABEL[mode] }))),
    ]),
  ]);
}

export function buildGuide(ctx: Ctx, onClose: () => void): HTMLElement {
  const close = ctx.tap(onClose);
  const scrim = h('div', { cls: 'sheet__scrim' });
  scrim.addEventListener('click', close);
  const sheet = h('div', { cls: 'sheet', attrs: { role: 'dialog', 'aria-label': '기술 도감' } }, [
    h('div', { cls: 'sheet__grip' }),
    h('header', { cls: 'sheet__head' }, [
      h('div', {}, [h('div', { cls: 'sheet__kicker', text: 'MOVE GUIDE' }), h('h2', { cls: 'sheet__title', text: '기술 도감' })]),
      button({ label: '닫기', variant: 'glass', size: 'icon', icon: icons.close(), onPress: close }),
    ]),
    h('p', { cls: 'sheet__lead', text: '탭은 바로 점프, 스와이프는 그 점프에 기술을 더해요.' }),
    h('div', { cls: 'sheet__list' }, MOVE_ORDER.map(moveCard)),
  ]);
  const screen = h('section', { cls: 'screen screen--sheet', attrs: { 'aria-label': '기술 도감' } }, [scrim, sheet]);
  swallowInput(screen);
  return screen;
}

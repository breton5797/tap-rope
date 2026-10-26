// 기술 도감: an informational bottom sheet listing every move with its gesture art.
import { controlsDiagram } from './controls';
import { button, h, swallowInput, type Ctx } from './dom';
import { icons } from './icons';
import { moveArt } from './move-art';
import { STAGES } from '../core/content';
import type { MoveId } from '../types';
import { MOVE_ORDER, MOVES, moveGlyph } from './moves';

/** "작전 2-4부터" — where the move first appears in the campaign. */
function firstSeen(id: MoveId): HTMLElement | null {
  const stage = STAGES.find((s) => (s.moves ?? []).includes(id));
  if (!stage) return null;
  return h('div', { cls: 'guide__modes' }, [h('span', { cls: 'pill', text: `작전 ${stage.chapter + 1}-${stage.index + 1}부터` })]);
}

function moveCard(id: (typeof MOVE_ORDER)[number], i: number): HTMLElement {
  const m = MOVES[id];
  return h('article', { cls: `guide__item tone--${m.tone}${m.warn ? ' is-warn' : ''}`, style: { 'animation-delay': `${0.05 + i * 0.04}s` } }, [
    moveArt(id),
    h('div', { cls: 'guide__body' }, [
      h('div', { cls: 'guide__row' }, [
        h('h3', { cls: 'guide__name', text: m.name }),
        h('span', { cls: 'guide__gesture' }, [moveGlyph(id), h('span', { text: m.gesture })]),
      ]),
      h('p', { cls: 'guide__hint', text: m.hint }),
      firstSeen(id),
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
      h('div', {}, [h('div', { cls: 'sheet__kicker', text: 'AGENT MANUAL' }), h('h2', { cls: 'sheet__title', text: '기술 도감' })]),
      button({ label: '닫기', variant: 'glass', size: 'icon', icon: icons.close(), onPress: close }),
    ]),
    h('p', { cls: 'sheet__lead', text: `왼손은 레인 이동, 오른손은 점프·슬라이딩! 요원 필수 기술 ${MOVE_ORDER.length}가지.` }),
    h('div', { cls: 'sheet__list' }, [controlsDiagram(true), ...MOVE_ORDER.map(moveCard)]),
  ]);
  const screen = h('section', { cls: 'screen screen--sheet', attrs: { 'aria-label': '기술 도감' } }, [scrim, sheet]);
  swallowInput(screen);
  return screen;
}

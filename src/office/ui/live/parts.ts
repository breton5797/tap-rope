// Office live events: small DOM parts shared by the title block, the week card, the mall and the result.
import { h } from '../../../ui/dom';
import { LIVE_COPY, fillLive } from './copy';
import type { GoalModel } from './model';

/** the weekly goal: label and a progress bar (role=progressbar) */
export function goalBar(goal: GoalModel, head: string): HTMLElement {
  const k = goal.target > 0 ? Math.min(1, goal.value / goal.target) : 0;
  return h('div', { cls: `live-goal${goal.done ? ' is-done' : ''}` }, [
    h('div', { cls: 'live-goal__head' }, [
      h('span', { cls: 'live-goal__kicker', text: head }),
      h('span', { cls: 'live-goal__value mono', text: goal.done ? LIVE_COPY.goalDone : `${goal.value}/${goal.target}` }),
    ]),
    h('div', { cls: 'live-goal__label', text: goal.label }),
    h('div', {
      cls: 'live-goal__bar',
      attrs: {
        role: 'progressbar', 'aria-label': goal.label, 'aria-valuemin': '0', 'aria-valuemax': String(goal.target),
        'aria-valuenow': String(goal.value),
      },
    }, [h('i', { cls: 'live-goal__fill', style: { transform: `scaleX(${k.toFixed(3)})` } })]),
  ]);
}

/**
 * A stamp in the equipped design: art/cosmetic/<key>.webp over a CSS stamp (the CSS one shows while it loads
 * and stays when the file is missing). key null = the office's own 칼퇴 stamp.
 */
export function stampMark(key: string | null, cls = ''): HTMLElement {
  const box = h('span', { cls: `live-stamp live-stamp--${key ?? 'default'} ${cls}`.trim(), attrs: { 'aria-hidden': 'true' } }, [
    h('span', { cls: 'live-stamp__ink', text: '칼퇴' }),
  ]);
  if (key) {
    const img = h('img', { cls: 'live-stamp__img', attrs: { src: `./art/cosmetic/${key}.webp`, alt: '', decoding: 'async', draggable: 'false' } });
    img.addEventListener('load', () => box.classList.add('has-art'));
    img.addEventListener('error', () => img.remove());
    box.appendChild(img);
  }
  return box;
}

/** "NEW" badge */
export function newBadge(): HTMLElement {
  return h('span', { cls: 'live-new', text: LIVE_COPY.newBadge });
}

export function countBadge(n: number): HTMLElement | null {
  return n > 0 ? h('span', { cls: 'live-count', text: fillLive(LIVE_COPY.mallNew, { n }) }) : null;
}

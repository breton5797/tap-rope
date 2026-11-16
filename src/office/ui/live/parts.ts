// Office live events: small DOM parts shared by the title block, the week card, the mall and the result.
import { h } from '../../../ui/dom';
import type { ThemeId } from '../../core/live';
import { LIVE_COPY } from './copy';
import type { GoalModel } from './model';

/** the weekly theme badges and the 개근 badge (public-office/art/live/<name>.webp) */
export const THEME_BADGES: Readonly<Record<ThemeId, string>> = {
  'monday-blues': 'badge-monday',
  'dodge-dinner': 'badge-dodge-dinner',
  'paper-bomb': 'badge-approval-bomb',
  'speed-clockout': 'badge-speed-out',
  'sports-day': 'badge-sports-day',
  'rainy-commute': 'badge-rainy',
};
export const ATTENDANCE_BADGE = 'badge-attendance';
export const SHOP_HEADER = 'shop-header';
export type Deco = 'deco-clip' | 'deco-tape' | 'deco-pin' | 'deco-note';
/** every live UI art file (art-files test) */
export const LIVE_UI_ART: readonly string[] = [
  ...Object.values(THEME_BADGES), ATTENDANCE_BADGE, SHOP_HEADER, 'deco-clip', 'deco-tape', 'deco-pin', 'deco-note',
];

/** decorative live UI art (alt=""); removes itself when the file is missing */
export function liveArt(name: string, cls: string): HTMLElement {
  const img = h('img', { cls, attrs: { src: `./art/live/${name}.webp`, alt: '', decoding: 'async', draggable: 'false', 'aria-hidden': 'true' } });
  img.addEventListener('error', () => img.remove());
  return img;
}

/** the weekly goal: label and a progress bar (role=progressbar), with the week's theme badge */
export function goalBar(goal: GoalModel, head: string, theme?: ThemeId): HTMLElement {
  const k = goal.target > 0 ? Math.min(1, goal.value / goal.target) : 0;
  return h('div', { cls: `live-goal${goal.done ? ' is-done' : ''}${theme ? ' has-badge' : ''}` }, [
    theme ? liveArt(THEME_BADGES[theme], 'live-goal__badge') : null,
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

/** the weekly goal as a thin bar (inside the title's card button) */
export function goalBarThin(goal: GoalModel): HTMLElement {
  const k = goal.target > 0 ? Math.min(1, goal.value / goal.target) : 0;
  return h('span', {
    cls: 'live-thinbar',
    attrs: {
      role: 'progressbar', 'aria-label': goal.label, 'aria-valuemin': '0', 'aria-valuemax': String(goal.target),
      'aria-valuenow': String(goal.value),
    },
  }, [h('i', { cls: 'live-thinbar__fill', style: { transform: `scaleX(${k.toFixed(3)})` } })]);
}

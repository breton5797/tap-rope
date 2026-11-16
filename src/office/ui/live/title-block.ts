// Office live events on the title (spec §5): 오늘의 미션 (NEW until cleared today), this week's card n/7, the
// weekly goal bar and how many cosmetics the player could buy now. Signals only — no timers, no streaks.
import { button, h, type Ctx } from '../../../ui/dom';
import { icons } from '../../../ui/icons';
import { LIVE_COPY, fillLive } from './copy';
import type { TitleLiveModel } from './model';
import { THEME_BADGES, goalBarThin, liveArt, newBadge } from './parts';

export interface LiveNav {
  readonly onDaily: () => void;
  readonly onCard: () => void;
  readonly onMall: () => void;
}

function dailySub(m: TitleLiveModel): string {
  if (!m.unlocked) return LIVE_COPY.dailyLocked;
  return m.dailyDone ? LIVE_COPY.dailyDone : fillLive(LIVE_COPY.dailyBoss, { boss: m.bossName });
}

export function titleLiveBlock(ctx: Ctx, m: TitleLiveModel, nav: LiveNav): HTMLElement {
  const fresh = m.unlocked && !m.dailyDone;
  const daily = button({
    label: LIVE_COPY.dailyButton,
    sub: dailySub(m),
    variant: fresh ? 'pink' : 'glass',
    icon: icons.calendar(),
    cls: `btn--card live-daily${fresh ? ' is-new' : ''}${m.dailyDone ? ' is-done' : ''}${m.unlocked ? '' : ' is-locked'}`,
    aria: `${LIVE_COPY.dailyButton}, ${dailySub(m)}${fresh ? `, ${LIVE_COPY.newBadge}` : ''}`,
    onPress: ctx.tap(() => {
      if (m.unlocked) nav.onDaily();
    }),
  });
  if (!m.unlocked) daily.setAttribute('aria-disabled', 'true');
  if (fresh) daily.appendChild(newBadge());
  // art review: the weekly goal rides in the card button (sub line + thin bar), one row less on the title
  const goalText = m.goal.done ? `${LIVE_COPY.goalWord} ${LIVE_COPY.goalDone}` : `${m.goal.label} ${m.goal.value}/${m.goal.target}`;
  const card = button({
    label: fillLive(LIVE_COPY.cardChip, { n: m.cardCount }),
    sub: goalText,
    variant: 'glass', size: 'sm', cls: `live-cardchip${m.goal.done ? ' is-goal-done' : ''}`,
    aria: `${fillLive(LIVE_COPY.cardChip, { n: m.cardCount })}, ${fillLive(LIVE_COPY.goalHead, { theme: m.themeName })} ${goalText}`,
    onPress: ctx.tap(nav.onCard),
  });
  card.prepend(liveArt(THEME_BADGES[m.themeId], 'live-cardchip__badge'));
  card.appendChild(goalBarThin(m.goal));
  const mall = button({
    label: LIVE_COPY.mallButton,
    variant: 'glass', size: 'sm', icon: icons.gift(), cls: 'live-mallbtn',
    aria: m.newItems > 0 ? `${LIVE_COPY.mallButton}, ${fillLive(LIVE_COPY.mallNew, { n: m.newItems })}` : LIVE_COPY.mallButton,
    onPress: ctx.tap(nav.onMall),
  });
  if (m.newItems > 0) mall.appendChild(h('span', { cls: 'live-count live-count--corner', text: String(m.newItems), attrs: { 'aria-hidden': 'true' } }));
  return h('div', { cls: 'live-title', attrs: { 'data-today': m.today } }, [
    daily,
    h('div', { cls: 'row live-title__row' }, [card, mall]),
  ]);
}

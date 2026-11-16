// Office live events on the title (spec §5): 오늘의 미션 (NEW until cleared today), this week's card n/7, the
// weekly goal bar and how many cosmetics the player could buy now. Signals only — no timers, no streaks.
import { button, h, type Ctx } from '../../../ui/dom';
import { icons } from '../../../ui/icons';
import { LIVE_COPY, fillLive } from './copy';
import type { TitleLiveModel } from './model';
import { countBadge, goalBar, newBadge } from './parts';

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
  const card = button({
    label: fillLive(LIVE_COPY.cardChip, { n: m.cardCount }),
    variant: 'glass', size: 'sm', ...(m.cardCount > 0 ? { icon: icons.check() } : {}), cls: 'live-cardchip',
    onPress: ctx.tap(nav.onCard),
  });
  const mall = button({
    label: LIVE_COPY.mallButton,
    variant: 'glass', size: 'sm', icon: icons.gift(), cls: 'live-mallbtn',
    aria: m.newItems > 0 ? `${LIVE_COPY.mallButton}, ${fillLive(LIVE_COPY.mallNew, { n: m.newItems })}` : LIVE_COPY.mallButton,
    onPress: ctx.tap(nav.onMall),
  });
  const badge = countBadge(m.newItems);
  if (badge) mall.appendChild(badge);
  return h('div', { cls: 'live-title', attrs: { 'data-today': m.today } }, [
    daily,
    h('div', { cls: 'row live-title__row' }, [card, mall]),
    goalBar(m.goal, fillLive(LIVE_COPY.goalHead, { theme: m.themeName }), m.themeId),
  ]);
}

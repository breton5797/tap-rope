// Office live events: the 주간 출근 카드 screen (spec §2) — seven day slots Mon–Sun, the 3 / 5 / 7 stamp rewards,
// the weekly goal and the 출근 기록부 of past weeks. Nothing is lost for a missed day.
import { button, formatNumber, h, header, type Ctx } from '../../../ui/dom';
import { icons } from '../../../ui/icons';
import { LIVE_COPY, WEEKDAYS, fillLive, shortDate } from './copy';
import type { MilestoneModel, WeekCardModel } from './model';
import { ATTENDANCE_BADGE, goalBar, liveArt, stampMark } from './parts';

function slot(m: CardView, i: number, stampKey: string | null): HTMLElement {
  const on = m.stamps[i] === true;
  const state = on ? '도장' : i < m.today ? '빈 칸' : i === m.today ? '오늘' : '';
  return h('li', {
    cls: `wcard__slot${on ? ' is-on' : ''}${i === m.today ? ' is-today' : ''}${i > m.today ? ' is-future' : ''}`,
    attrs: { 'aria-label': `${WEEKDAYS[i]}요일${state ? `, ${state}` : ''}`, 'data-day': String(i) },
  }, [
    h('span', { cls: 'wcard__day', text: WEEKDAYS[i] }),
    h('span', { cls: 'wcard__box' }, [on ? stampMark(stampKey) : null]),
  ]);
}

function milestone(m: MilestoneModel): HTMLElement {
  const parts = [
    fillLive(LIVE_COPY.rewardPoints, { n: formatNumber(m.points) }),
    m.cosmetic,
    m.badge ? LIVE_COPY.rewardBadge : null,
  ].filter((x): x is string => Boolean(x));
  return h('li', { cls: `wcard__ms${m.reached ? ' is-reached' : ''}`, attrs: { 'data-at': String(m.at) } }, [
    h('span', { cls: 'wcard__ms-at', text: fillLive(LIVE_COPY.milestone, { n: m.at }) }),
    h('span', { cls: 'wcard__ms-reward', text: parts.join(' + ') }),
    m.badge ? liveArt(ATTENDANCE_BADGE, 'wcard__ms-badge') : null,
    m.reached ? h('span', { cls: 'wcard__ms-done' }, [icons.check(), h('span', { text: LIVE_COPY.milestoneDone })]) : null,
  ]);
}

/** the card itself (also shown small on the result): 7 slots in the equipped card theme */
/** the parts of the model the card itself shows */
export type CardView = Pick<WeekCardModel, 'week' | 'lastDay' | 'stamps' | 'today' | 'count' | 'cardTheme'>;

export function weekCard(m: CardView, stampKey: string | null): HTMLElement {
  return h('div', {
    cls: `wcard card wcard--${m.cardTheme ?? 'plain'}`,
    attrs: { role: 'group', 'aria-label': `${LIVE_COPY.cardTitle} ${m.count}/7` },
    // the theme's art (art/cosmetic/<key>.webp) over its placeholder colour
    style: m.cardTheme ? { 'background-image': `url("./art/cosmetic/${m.cardTheme}.webp")` } : {},
  }, [
    h('div', { cls: 'wcard__head' }, [
      h('span', { cls: 'wcard__title', text: LIVE_COPY.cardTitle }),
      h('span', { cls: 'wcard__dates mono', text: fillLive(LIVE_COPY.cardWeek, { from: shortDate(m.week), to: shortDate(m.lastDay) }) }),
    ]),
    h('ol', { cls: 'wcard__slots' }, m.stamps.map((_, i) => slot(m, i, stampKey))),
  ]);
}

function history(m: WeekCardModel): HTMLElement {
  return h('section', { cls: 'wcard-history card', attrs: { 'aria-label': LIVE_COPY.historyTitle } }, [
    liveArt('deco-clip', 'live-deco live-deco--clip'),
    h('h2', { cls: 'wcard-history__title', text: LIVE_COPY.historyTitle }),
    m.history.length === 0
      ? h('p', { cls: 'wcard-history__empty', text: LIVE_COPY.historyEmpty })
      : h('ul', { cls: 'wcard-history__list' }, m.history.map((e) => h('li', { cls: `wcard-history__row${e.stamps >= 7 ? ' is-full' : ''}` }, [
        h('span', { text: fillLive(LIVE_COPY.historyRow, { from: shortDate(e.week) }) }),
        h('span', { cls: 'wcard-history__dots', attrs: { 'aria-hidden': 'true' } }, Array.from({ length: 7 }, (_, i) => h('i', { cls: i < e.stamps ? 'is-on' : '' }))),
        h('span', { cls: 'mono', text: fillLive(LIVE_COPY.historyStamps, { n: e.stamps }) }),
        e.stamps >= 7 ? liveArt(ATTENDANCE_BADGE, 'wcard-history__badge') : null,
      ]))),
  ]);
}

export interface WeekCardScreenOpts {
  readonly stampKey: string | null;
  readonly dailyOpen: boolean;
  readonly onPlay: () => void;
  readonly onBack: () => void;
}

export function buildWeekCardScreen(ctx: Ctx, m: WeekCardModel, o: WeekCardScreenOpts): HTMLElement {
  return h('section', { cls: 'screen screen--wcard', attrs: { 'aria-label': LIVE_COPY.cardTitle } }, [
    header(ctx, LIVE_COPY.cardTitle, o.onBack, [], icons.back()),
    h('div', { cls: 'scroll wcard-screen' }, [
      h('div', { cls: 'wcard-wrap' }, [weekCard(m, o.stampKey), liveArt('deco-tape', 'live-deco live-deco--tape')]),
      h('p', { cls: 'wcard__hint', text: LIVE_COPY.cardHint }),
      h('ol', { cls: 'wcard__milestones card' }, m.milestones.map(milestone)),
      h('div', { cls: 'card wcard__goal' }, [goalBar(m.goal, fillLive(LIVE_COPY.goalHead, { theme: m.themeName }), m.themeId)]),
      o.dailyOpen ? button({ label: LIVE_COPY.playDaily, variant: 'sun', icon: icons.play(), cls: 'wcard__play', onPress: ctx.tap(o.onPlay) }) : null,
      history(m),
    ]),
  ]);
}

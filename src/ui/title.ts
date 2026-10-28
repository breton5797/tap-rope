// Title screen: key art (./art/title.webp, dark gradient fallback), wordmark and the operations menu.
// v8: a "다음 목표" strip and the daily streak on the 일일 작전 card.
import { streakReward } from '../core/economy';
import { localDate, nextGoal, streakStatus } from '../core/goals';
import { COPY, FEATURES } from '../flavor';
import type { SaveData } from '../types';
import { button, formatNumber, h, type Ctx } from './dom';
import { icons } from './icons';

export interface TitleNav {
  readonly toStages: () => void;
  readonly toArchive: () => void;
  readonly toAchievements: () => void;
  readonly toLeaderboard: () => void;
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
  return h('div', { cls: 'logo', attrs: { role: 'img', 'aria-label': COPY.titleLogoAria } }, [
    h('div', { cls: 'logo__code mono', text: COPY.titleLogoCode }),
    h('div', { cls: 'logo__word mono' }, [h('span', { text: COPY.titleLogoWord1 }), h('span', { cls: 'logo__word2', text: COPY.titleLogoWord2 })]),
    h('div', { cls: 'logo__ko', text: COPY.titleLogoKo }),
    h('i', { cls: 'logo__beam' }),
  ]);
}

/** v8: the daily card shows the live streak and whether today is done */
function dailySub(save: SaveData, today: string): { readonly sub: string; readonly cls: string } {
  const st = streakStatus(save, today);
  if (st.doneToday) return { sub: `완료 ✓ · 연속 ${st.count}일`, cls: ' is-done' };
  if (st.atRisk) return { sub: `연속 ${st.count}일 · 오늘 미완료`, cls: ' is-risk' };
  return { sub: `오늘 미완료 · ₵${streakReward(1)}`, cls: '' };
}

/** daily / endless cards; null when the build offers neither */
function modeButtons(ctx: Ctx, save: SaveData, today: string): HTMLElement | null {
  if (!FEATURES.daily && !FEATURES.endless) return null;
  const endlessBest = save.bestScores['endless'] ?? 0;
  const daily = dailySub(save, today);
  return h('div', { cls: 'title__modes' }, [
    FEATURES.daily ? button({ label: '일일 작전', sub: daily.sub, variant: 'glass', icon: icons.calendar(), cls: `btn--card btn--daily${daily.cls}`, onPress: ctx.tap(() => ctx.cb.onStartDaily()) }) : null,
    FEATURES.endless ? button({
      label: '무한 침투',
      sub: endlessBest > 0 ? `최고 ${formatNumber(endlessBest)}` : '제한 없음',
      variant: 'glass',
      icon: icons.infinity(),
      cls: 'btn--card',
      onPress: ctx.tap(() => ctx.cb.onStartEndless()),
    }) : null,
  ]);
}

/** v8: "다음 목표" — the one nearest objective */
function goalStrip(save: SaveData, today: string): HTMLElement {
  const goal = nextGoal(save, today);
  return h('div', { cls: `title__goal is-${goal.kind}`, attrs: { role: 'note' } }, [
    h('span', { cls: 'title__goal-label mono', text: 'NEXT' }),
    h('span', { cls: 'title__goal-text', text: goal.text }),
  ]);
}

export function buildTitle(ctx: Ctx, save: SaveData, nav: TitleNav, today: string = localDate()): HTMLElement {
  return h('section', { cls: 'screen screen--title', attrs: { 'aria-label': '타이틀' } }, [
    artImage('./art/title.webp', 'art--title'),
    h('div', { cls: 'title__top' }, [
      button({ label: COPY.titleGuide, variant: 'glass', size: 'sm', icon: icons.help(), cls: 'btn--guide', onPress: ctx.tap(nav.toGuide) }),
      coinChip(save.coins),
    ]),
    h('div', { cls: 'title__hero' }, [logo()]),
    h('div', { cls: 'title__menu' }, [
      goalStrip(save, today),
      button({ label: COPY.titleStart, variant: 'sun', size: 'lg', icon: icons.play(), cls: 'btn--start', onPress: ctx.tap(nav.toStages) }),
      modeButtons(ctx, save, today),
      // v7: archive · achievements · rankings
      h('div', { cls: 'row title__records' }, [
        button({ label: '기록 보관소', variant: 'glass', size: 'sm', icon: icons.book(), onPress: ctx.tap(nav.toArchive) }),
        button({ label: '업적', variant: 'glass', size: 'sm', icon: icons.star(), onPress: ctx.tap(nav.toAchievements) }),
        FEATURES.leaderboard ? button({ label: '랭킹', variant: 'glass', size: 'sm', icon: icons.crown(), onPress: ctx.tap(nav.toLeaderboard) }) : null,
      ]),
      h('div', { cls: 'row' }, [
        button({ label: COPY.titleShop, variant: 'glass', icon: icons.bag(), onPress: ctx.tap(nav.toShop) }),
        button({ label: '설정', variant: 'glass', icon: icons.gear(), onPress: ctx.tap(nav.toSettings) }),
      ]),
    ]),
  ]);
}
